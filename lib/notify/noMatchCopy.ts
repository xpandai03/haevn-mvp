/**
 * "No match yet" Match Monday ping — copy. Edit here.
 *
 * TWO VARIANTS, and why. The obvious single message — "no match yet, we're
 * building in your city" — is FALSE for half the audience: 226 of the 456
 * recipients are in Austin, which is live. Telling an Austin founding member we
 * are still building in Austin reads as "HAEVN has not launched here yet".
 *
 *   A — live market      : the network is live where they are; there is simply
 *                          no good match this week. No growth promise.
 *   B — pre-launch market: HAEVN genuinely is still building there, and the
 *                          member can help by spreading the word.
 *
 * Variant selection is isCityLive() — the SAME resolver the release gate and the
 * metrics scope already use. There is no second city-matching implementation and
 * no city literal anywhere in this file.
 *
 * CITY-LESS FALLBACK. `{city}` interpolates partnerships.city. A member with no
 * city gets a sentence with NO city clause at all — never "in null", never
 * "in ", and never a hardcoded fallback city. Today that is 0 members; the
 * branch exists because the contract requires it, not because the count does.
 *
 * CONFIGURABLE, NOT HARDCODED. NO_MATCH_COPY_VARIANT_A / _B override the body
 * text at runtime so the client can reword without a deploy. An override is used
 * verbatim (with {city} interpolated the same way), so a reword can never
 * accidentally reintroduce the wrong-market problem the variants exist to fix.
 */

export type NoMatchVariant = 'live_market' | 'pre_launch'

/** Which variant a member gets. Live market -> A, everything else -> B. */
export function variantForMarket(cityIsLive: boolean): NoMatchVariant {
  return cityIsLive ? 'live_market' : 'pre_launch'
}

// ─── Default body copy ───────────────────────────────────────────────────────
// Short, warm, no hype, no "algorithm" talk. Every sentence is true for every
// member who can receive it. Two forms each: with a city, and without one.

interface Body {
  withCity: string
  withoutCity: string
}

const DEFAULT_BODY: Record<NoMatchVariant, Body> = {
  // A — live market. Says nothing about launching or building; that would be
  // false. Says why silence is deliberate, which is the honest reason.
  live_market: {
    withCity:
      "No new match for you this Monday. We'd rather send you nothing than send you someone who isn't right, so we're holding until there's someone in {city} worth introducing you to.",
    withoutCity:
      "No new match for you this Monday. We'd rather send you nothing than send you someone who isn't right, so we're holding until there's someone worth introducing you to.",
  },
  // B — pre-launch market. The growth promise is true here, and the
  // spread-the-word line the client asked for belongs only in this variant.
  pre_launch: {
    withCity:
      "No match for you yet. HAEVN is still building its network in {city} — the more people nearby who join, the sooner we can introduce you to someone worth meeting. If you know someone who'd belong here, sending them our way genuinely helps.",
    withoutCity:
      "No match for you yet. HAEVN is still building its network in your area — the more people nearby who join, the sooner we can introduce you to someone worth meeting. If you know someone who'd belong here, sending them our way genuinely helps.",
  },
}

const ENV_KEY: Record<NoMatchVariant, string> = {
  live_market: 'NO_MATCH_COPY_VARIANT_A',
  pre_launch: 'NO_MATCH_COPY_VARIANT_B',
}

/**
 * The body sentence for a variant + city.
 *
 * An env override replaces BOTH forms: the client writes one sentence, and if
 * they include {city} while the member has none, the clause is removed rather
 * than left dangling — see stripCityClause.
 */
export function noMatchBody(
  variant: NoMatchVariant,
  city: string | null | undefined,
  env: NodeJS.ProcessEnv = process.env
): string {
  const trimmed = (city ?? '').trim()
  const override = (env[ENV_KEY[variant]] ?? '').trim()

  if (override) {
    return trimmed ? override.replaceAll('{city}', trimmed) : stripCityClause(override)
  }
  const body = DEFAULT_BODY[variant]
  return trimmed ? body.withCity.replaceAll('{city}', trimmed) : body.withoutCity
}

/**
 * Remove `{city}` from an override when the member has no city, without leaving
 * "in ." behind. Drops a directly preceding preposition ("in"/"near"/"around")
 * and any doubled spaces. Deliberately conservative: an override we cannot make
 * read cleanly still never renders the placeholder or an empty slot.
 */
export function stripCityClause(template: string): string {
  return template
    .replace(/\s*\b(?:in|near|around)\s+\{city\}/gi, '')
    .replaceAll('{city}', '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([.,!?])/g, '$1')
    .trim()
}

// ─── Rendered messages ───────────────────────────────────────────────────────

/** SMS. One sentence plus the sign-in link; no identities, no scores. */
export function noMatchSms(
  variant: NoMatchVariant,
  city: string | null | undefined,
  signInUrl: string,
  env: NodeJS.ProcessEnv = process.env
): string {
  return `HAEVN: ${noMatchBody(variant, city, env)} Tap to sign in and update what you're looking for: ${signInUrl}`
}

/** Email — subject + HTML. Mirrors the re-notify email's shape and footer. */
export function noMatchEmail(
  variant: NoMatchVariant,
  city: string | null | undefined,
  signInUrl: string,
  unsubUrl?: string,
  env: NodeJS.ProcessEnv = process.env
): { subject: string; html: string } {
  const body = noMatchBody(variant, city, env)

  const html = `
  <div style="font-family:Outfit,Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#1E2A4A;">
    <h1 style="font-size:20px;margin:0 0 8px;color:#008080;">No match this week</h1>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.5;color:#31312C;">
      ${escapeHtml(body)}
    </p>
    <p style="margin:0 0 8px;">
      <a href="${signInUrl}"
         style="display:inline-block;background:#008080;color:#fff;text-decoration:none;
                padding:12px 24px;border-radius:8px;font-weight:600;font-size:15px;">
        Sign in to HAEVN
      </a>
    </p>
    <p style="margin:24px 0 0;font-size:12px;color:#9C9C91;">
      Keeping your profile and preferences current gives us more to work with.
    </p>
    ${unsubUrl
      ? `<p style="margin:12px 0 0;font-size:12px;color:#9C9C91;">
           Don't want these Monday updates?
           <a href="${unsubUrl}" style="color:#9C9C91;text-decoration:underline;">Unsubscribe</a>.
           You'll still be notified when you actually have a match.
         </p>`
      : ''}
  </div>`.trim()

  return { subject: 'Your HAEVN Monday update', html }
}

/** The body is member-configurable, so it is escaped before it enters the HTML. */
function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string))
}
