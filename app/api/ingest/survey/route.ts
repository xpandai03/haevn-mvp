/**
 * POST /api/ingest/survey — receiver for the marketing survey's
 * "survey.completed" (completion_v1) webhook.
 *
 * Turns a survey completion into a real, magic-link main-app user.
 *
 * CONTRACT / SECURITY
 *   Headers: X-HAEVN-Signature: sha256=<hmac>, X-HAEVN-Timestamp: <unix secs>
 *   HMAC-SHA256 over `${timestamp}.${RAW_BODY}` with HAEVN_INGEST_SECRET (must
 *   match the sender's). We verify against the RAW bytes read via request.text()
 *   — re-serializing JSON changes the bytes and breaks the HMAC. We parse only
 *   AFTER the signature verifies. 5-minute replay window.
 *
 * IDEMPOTENCY (non-negotiable — the sender retries on non-2xx)
 *   survey_ingest_log.submission_id is the PRIMARY KEY. We claim it with an
 *   atomic insert; a conflict means "already ingested" -> 200 duplicate, no
 *   second user. Auth email uniqueness is layer 2 (same human, new
 *   submission_id -> update in place).
 *
 * STATUS CODES (the sender's retry only means something if these are honest)
 *   200 created|updated|duplicate  · 400 malformed/unmappable (logged, no retry
 *   would help) · 401 bad signature / stale timestamp · 5xx real failure (retry).
 *
 * GATING: we set partnerships.city and let the live city gate decide who is
 * released. We never filter by city here — importing a Portland/Tampa user is
 * safe; they're withheld at release until their market goes live.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createHmac, timingSafeEqual, randomBytes } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { adaptCompletionV1, type CompletionV1, UNKNOWN_CITY } from '@/lib/ingest/completionV1'
import { loadMarketIndex, isCityLive } from '@/lib/markets/releaseGate'

export const maxDuration = 60

const REPLAY_WINDOW_SECONDS = 5 * 60
const PUBLIC_BUCKET = 'public-photos' // matches app/api/photos/upload/route.ts

type IngestResult = 'created' | 'updated' | 'duplicate' | 'rejected' | 'error'

/** Users are passwordless — they only ever log in via magic link. Mirrors the
 *  manual importer, which also sets an unknowable random password. */
function unusablePassword(): string {
  return randomBytes(32).toString('base64url')
}

function verifySignature(rawBody: string, signatureHeader: string | null, timestampHeader: string | null): string | null {
  const secret = process.env.HAEVN_INGEST_SECRET
  if (!secret) return 'HAEVN_INGEST_SECRET not configured'
  if (!signatureHeader) return 'missing X-HAEVN-Signature'
  if (!timestampHeader) return 'missing X-HAEVN-Timestamp'

  const ts = Number(timestampHeader)
  if (!Number.isFinite(ts)) return 'malformed X-HAEVN-Timestamp'
  const skew = Math.abs(Math.floor(Date.now() / 1000) - ts)
  if (skew > REPLAY_WINDOW_SECONDS) return `stale timestamp (${skew}s outside ${REPLAY_WINDOW_SECONDS}s window)`

  // Signed payload is `<timestamp>.<raw body>` — raw bytes, never re-serialized.
  const expected = createHmac('sha256', secret).update(`${timestampHeader}.${rawBody}`).digest('hex')
  const provided = signatureHeader.startsWith('sha256=') ? signatureHeader.slice(7) : signatureHeader
  const a = Buffer.from(expected, 'utf8')
  const b = Buffer.from(provided, 'utf8')
  if (a.length !== b.length || !timingSafeEqual(a, b)) return 'signature mismatch'
  return null
}

/**
 * EMAIL DEDUP — does a partnership already exist for this email?
 *
 * The submission_id check (survey_ingest_log PK) only catches submissions this
 * receiver has seen. But ~511 partnerships were created BEFORE the webhook (the
 * manual import) and have NO survey_ingest_log row and NO submission_id — so a
 * backfill or re-completion for one of them would slip past the submission_id
 * check. Email is the only key that catches them: verified 512/512 owners have a
 * unique email in both profiles and auth, 1:1 with partnerships, no shares/nulls.
 *
 * We resolve email -> profile(s) -> owned partnership. Case-insensitive; the
 * incoming email is already normalized (lowercased/trimmed by the mapper).
 * Returns the existing partnership (id + owner) or null.
 */
async function findPartnershipByEmail(
  admin: ReturnType<typeof createAdminClient>,
  email: string
): Promise<{ id: string; owner_id: string } | null> {
  // profiles.email is the reliable, populated store (matches auth exactly).
  const { data: profs } = await admin
    .from('profiles')
    .select('user_id')
    .ilike('email', email) // no wildcards => case-insensitive equality
  const ownerIds = (profs ?? []).map((p: { user_id: string }) => p.user_id).filter(Boolean)
  if (ownerIds.length === 0) return null

  const { data: part } = await admin
    .from('partnerships')
    .select('id, owner_id')
    .in('owner_id', ownerIds)
    .limit(1)
    .maybeSingle()
  return (part as { id: string; owner_id: string } | null) ?? null
}

/** Audit every ingest. Never throws — logging must not fail an ingest. */
async function logIngest(
  admin: ReturnType<typeof createAdminClient>,
  row: Record<string, any>
) {
  try {
    await admin.from('survey_ingest_log').upsert(row, { onConflict: 'submission_id' })
  } catch (e) {
    console.error('[ingest] audit log failed:', e)
  }
}

/**
 * Fetch tokenized survey-app photos into our storage NOW (never lazily — the
 * tokens expire and the submission may be deleted upstream). Non-fatal: a photo
 * failure must never cost us the user.
 */
async function importPhotos(
  admin: ReturnType<typeof createAdminClient>,
  partnershipId: string,
  photos: CompletionV1['photos']
): Promise<{ imported: number; failed: number }> {
  let imported = 0
  let failed = 0
  for (const [i, photo] of (photos ?? []).entries()) {
    if (!photo?.url) { failed++; continue }
    try {
      const res = await fetch(photo.url)
      if (!res.ok) throw new Error(`fetch ${res.status}`)
      const contentType = res.headers.get('content-type') || 'image/jpeg'
      const bytes = Buffer.from(await res.arrayBuffer())

      const ext = (contentType.split('/')[1] || 'jpg').split(';')[0].replace('jpeg', 'jpg')
      const path = `${partnershipId}/${Date.now()}_${photo.photo_id || `photo${i}`}.${ext}`

      const { error: upErr } = await admin.storage
        .from(PUBLIC_BUCKET)
        .upload(path, bytes, { contentType, upsert: true })
      if (upErr) throw new Error(`upload: ${upErr.message}`)

      const { data: { publicUrl } } = admin.storage.from(PUBLIC_BUCKET).getPublicUrl(path)

      // Mirrors app/api/photos/upload — photo_url holds the full public URL.
      const { error: insErr } = await admin.from('partnership_photos').upsert(
        {
          partnership_id: partnershipId,
          photo_url: publicUrl,
          photo_type: 'public',
          is_primary: !!photo.is_primary,
          order_index: i,
        },
        { onConflict: 'partnership_id,photo_url' }
      )
      if (insErr) throw new Error(`row: ${insErr.message}`)
      imported++
    } catch (e: any) {
      failed++
      console.warn(`[ingest] photo ${i} failed (non-fatal):`, e?.message)
    }
  }
  return { imported, failed }
}

export async function POST(request: NextRequest) {
  const startedAt = Date.now()
  const admin = createAdminClient()

  // 1. RAW body first — required for a correct HMAC.
  const rawBody = await request.text()

  // 2. Signature + replay window. Reject before parsing anything.
  const sigError = verifySignature(
    rawBody,
    request.headers.get('x-haevn-signature'),
    request.headers.get('x-haevn-timestamp')
  )
  if (sigError) {
    console.warn('[ingest] 401:', sigError)
    return NextResponse.json({ error: 'unauthorized', detail: sigError }, { status: 401 })
  }

  // 3. Parse (only after verifying).
  let payload: CompletionV1
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'bad_request', detail: 'invalid JSON' }, { status: 400 })
  }

  const submissionId = payload?.submission_id
  const adapted = adaptCompletionV1(payload)

  if (!adapted.ok || !adapted.mapped) {
    // Malformed/unmappable: 400 + logged. A retry cannot help, so don't ask for one.
    console.warn('[ingest] 400:', adapted.error, 'submission:', submissionId)
    if (submissionId) {
      await logIngest(admin, {
        submission_id: submissionId,
        event_id: payload?.event_id ?? null,
        result: 'rejected' as IngestResult,
        reason: adapted.error,
        email: payload?.identity?.email ?? null,
        duration_ms: Date.now() - startedAt,
      })
    }
    return NextResponse.json({ error: 'bad_request', detail: adapted.error }, { status: 400 })
  }

  const mapped = adapted.mapped
  const email = mapped.email

  // 4. ATOMIC DEDUPE — claim the submission_id. A conflict = already ingested.
  const claim = await admin
    .from('survey_ingest_log')
    .insert({
      submission_id: submissionId,
      event_id: payload.event_id ?? null,
      result: 'error' as IngestResult, // provisional; overwritten on success
      reason: 'in-flight',
      email,
      resolved_city: adapted.resolvedCity,
      source_market: adapted.sourceMarket,
      needs_review: !!adapted.needsReview,
      review_reason: adapted.reviewReason ?? null,
    })
    .select('submission_id')
    .single()

  if (claim.error) {
    // 23505 = unique violation => we've seen this submission_id before.
    if ((claim.error as any).code === '23505') {
      const { data: prior } = await admin
        .from('survey_ingest_log')
        .select('result, user_id, partnership_id')
        .eq('submission_id', submissionId)
        .maybeSingle()
      const priorResult = (prior as any)?.result

      // Only a SUCCEEDED prior attempt is a true duplicate. If the last attempt
      // errored, the sender is legitimately retrying — re-attempt rather than
      // permanently swallowing the submission behind a false "duplicate".
      if (priorResult === 'created' || priorResult === 'updated') {
        console.log('[ingest] duplicate submission_id:', submissionId)
        return NextResponse.json({
          status: 'duplicate',
          submission_id: submissionId,
          member_id: (prior as any)?.partnership_id ?? null,
          user_id: (prior as any)?.user_id ?? null,
        })
      }
      console.log(`[ingest] re-attempting ${submissionId} (prior result: ${priorResult})`)
      // fall through and retry the create
    } else {
      // Table missing / DB down => real failure. 5xx so the sender retries.
      console.error('[ingest] dedupe claim failed:', claim.error.message)
      return NextResponse.json(
        { error: 'server_error', detail: `ingest log unavailable: ${claim.error.message}` },
        { status: 503 }
      )
    }
  }

  // 4b. EMAIL DEDUP — before creating anything, treat an email that already
  //     belongs to a partnership as a duplicate. This is what catches the ~511
  //     pre-webhook / manual-import users (no submission_id). DEFAULT = no-op:
  //     we do NOT create and do NOT overwrite the existing user's data (their
  //     city drives gating; a blind update could silently change eligibility).
  try {
    const existingByEmail = await findPartnershipByEmail(admin, email)
    if (existingByEmail) {
      console.log(`[ingest] duplicate by email: ${email} -> existing partnership ${existingByEmail.id}`)
      await admin
        .from('survey_ingest_log')
        .update({
          result: 'duplicate' as IngestResult,
          reason: 'email_exists',
          user_id: existingByEmail.owner_id,
          partnership_id: existingByEmail.id,
        })
        .eq('submission_id', submissionId)
      return NextResponse.json({
        status: 'duplicate',
        dedupe: 'email_exists',
        submission_id: submissionId,
        member_id: existingByEmail.id,
        user_id: existingByEmail.owner_id,
      })
    }
  } catch (e: any) {
    // A dedup-lookup failure must FAIL CLOSED (5xx), never fall through to create
    // — failing open here is exactly how a duplicate user would be born.
    console.error('[ingest] email dedup lookup failed:', e?.message)
    await logIngest(admin, {
      submission_id: submissionId, event_id: payload.event_id ?? null,
      result: 'error' as IngestResult, reason: `email dedup lookup failed: ${e?.message}`,
      email, duration_ms: Date.now() - startedAt,
    })
    return NextResponse.json({ error: 'server_error', detail: 'dedup lookup failed' }, { status: 503 })
  }

  // 5. Create (or adopt) the user.
  try {
    let userId: string | null = null
    let result: IngestResult = 'created'

    const created = await admin.auth.admin.createUser({
      email,
      password: unusablePassword(), // never shared — magic link is the only way in
      email_confirm: true,
      user_metadata: {
        full_name: mapped.fullName,
        first_name: mapped.firstName,
        source: 'survey_ingest',
        submission_id: submissionId,
      },
    })

    if (created.error) {
      const dup = /already|exists|registered|duplicate/i.test(created.error.message || '')
      if (!dup) throw new Error(`createUser: ${created.error.message}`)
      // Layer-2 dedupe: same human, new submission_id -> adopt, update in place.
      result = 'updated'
      let page = 1
      while (!userId) {
        const { data } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
        userId = data.users.find((u) => u.email?.toLowerCase() === email)?.id ?? null
        if (data.users.length < 1000) break
        page++
      }
      if (!userId) throw new Error('existing auth user not found for email')
    } else {
      userId = created.data.user.id
    }

    // profiles (additive upsert — never clobber an existing real name/city with null)
    await admin.from('profiles').upsert(
      {
        user_id: userId,
        email,
        full_name: mapped.profile.full_name,
        city: mapped.profile.city,
        msa_status: mapped.profile.msa_status,
        survey_complete: mapped.profile.survey_complete,
      },
      { onConflict: 'user_id' }
    )

    // partnerships — reuse an existing owned partnership rather than duplicate.
    const { data: existingPart } = await admin
      .from('partnerships')
      .select('id')
      .eq('owner_id', userId)
      .limit(1)
      .maybeSingle()

    // One field set for BOTH insert and update. Writing the mandatory columns
    // (phone, profile_type, identity, display_name) in the INSERT — rather than
    // only in a follow-up enrich — means a later enrich failure can't silently
    // cost us the phone. That two-step is exactly how the manual importer lost
    // 501/511 phone numbers.
    const partnershipFields = {
      city: mapped.partnership.city, // the gate resolves off this
      membership_tier: 'free' as const,
      advocate_mode: false,
      profile_state: mapped.partnership.profile_state,
      display_name: mapped.partnership.display_name,
      state: mapped.partnership.state,
      zip_code: mapped.partnership.zip_code,
      age: mapped.partnership.age,
      identity: mapped.partnership.identity, // STRUCTURE value, never gender
      phone: mapped.partnership.phone,
      profile_type: mapped.partnership.profile_type,
      orientation: mapped.partnership.orientation,
      structure: mapped.partnership.structure,
      intentions: mapped.partnership.intentions,
    }

    let partnershipId = (existingPart as { id?: string } | null)?.id ?? null
    if (!partnershipId) {
      const { data: part, error: partErr } = await admin
        .from('partnerships')
        .insert({ owner_id: userId, ...partnershipFields })
        .select('id')
        .single()
      if (partErr || !part) throw new Error(`partnership insert: ${partErr?.message}`)
      partnershipId = part.id
    } else {
      // Existing partnership (same human, new submission) -> update in place.
      const { error: updErr } = await admin
        .from('partnerships')
        .update(partnershipFields)
        .eq('id', partnershipId)
      if (updErr) throw new Error(`partnership update: ${updErr.message}`)
    }

    // Phone is mandatory (match notifications depend on it) — verify it actually
    // landed rather than trusting the write. A silent drop here is precisely the
    // failure that produced the phoneless cohort.
    const { data: check } = await admin
      .from('partnerships')
      .select('phone, profile_type')
      .eq('id', partnershipId)
      .maybeSingle()
    if (mapped.partnership.phone && !(check as any)?.phone) {
      throw new Error('phone failed to persist on partnership — refusing a phoneless ingest')
    }

    // owner membership (idempotent)
    const { data: mem } = await admin
      .from('partnership_members')
      .select('partnership_id')
      .eq('partnership_id', partnershipId)
      .eq('user_id', userId)
      .maybeSingle()
    if (!mem) {
      const { error: memErr } = await admin
        .from('partnership_members')
        .insert({ partnership_id: partnershipId, user_id: userId, role: 'owner' })
      if (memErr) throw new Error(`member insert: ${memErr.message}`)
    }

    // survey answers (mapped HAEVN keys)
    const { error: surveyErr } = await admin.from('user_survey_responses').upsert(
      {
        user_id: userId,
        partnership_id: partnershipId,
        answers_json: mapped.answers,
        completion_pct: mapped.completionPct,
        current_step: 0,
      },
      { onConflict: 'user_id' }
    )
    if (surveyErr) throw new Error(`survey upsert: ${surveyErr.message}`)

    // photos — now, not later (tokenized URLs expire). Non-fatal.
    const photoStats = await importPhotos(admin, partnershipId!, payload.photos)

    // Did this member land in a live market? (audit only — we never filter here)
    const idx = await loadMarketIndex()
    const marketResolved = isCityLive(mapped.partnership.city, idx)

    await logIngest(admin, {
      submission_id: submissionId,
      event_id: payload.event_id ?? null,
      result,
      reason: null,
      user_id: userId,
      partnership_id: partnershipId,
      email,
      resolved_city: adapted.resolvedCity,
      market_resolved: marketResolved,
      source_market: adapted.sourceMarket,
      needs_review: !!adapted.needsReview,
      review_reason: adapted.reviewReason ?? null,
      photos_imported: photoStats.imported,
      photos_failed: photoStats.failed,
      duration_ms: Date.now() - startedAt,
    })

    if (adapted.needsReview) {
      console.warn(`[ingest] NEEDS REVIEW ${submissionId}: ${adapted.reviewReason}`)
    }
    console.log(
      `[ingest] ${result} ${email} partnership=${partnershipId} city="${adapted.resolvedCity}" ` +
      `market_live=${marketResolved} photos=${photoStats.imported}/${photoStats.imported + photoStats.failed} ` +
      `${Date.now() - startedAt}ms`
    )

    // NOTE: no magic-link email here — by design. These members receive their
    // per-user sign-in link through the existing notify path when their matches
    // release (and only if their market is live), exactly like the imported
    // cohort. Sending one here would be new, unrequested behavior.
    return NextResponse.json({
      status: result,
      submission_id: submissionId,
      member_id: partnershipId,
      user_id: userId,
      city: adapted.resolvedCity,
      market_live: marketResolved,
      needs_review: !!adapted.needsReview,
      photos_imported: photoStats.imported,
    })
  } catch (e: any) {
    // Real failure -> 5xx so the sender's retry is meaningful.
    //
    // The audit row PERSISTS with result='error' (we never delete it — the log
    // is the record that this ingest was attempted and failed). The submission
    // is NOT permanently swallowed: the dedupe branch above treats a prior
    // 'error' as retryable, so the sender's next attempt re-runs the create.
    console.error('[ingest] 500:', e?.message)
    await logIngest(admin, {
      submission_id: submissionId,
      event_id: payload.event_id ?? null,
      result: 'error' as IngestResult,
      reason: e?.message?.slice(0, 500) ?? 'unknown error',
      email,
      resolved_city: adapted.resolvedCity,
      duration_ms: Date.now() - startedAt,
    })
    return NextResponse.json({ error: 'server_error', detail: e?.message }, { status: 500 })
  }
}
