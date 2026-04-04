import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdminUser } from '@/lib/admin/allowlist'
import { calculateCompatibilityFromRaw } from '@/lib/matching/calculateCompatibility'

export async function GET(req: NextRequest) {
  // Auth check uses regular client (cookie-based session)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user?.email || !isAdminUser(user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const a = req.nextUrl.searchParams.get('a')
  const b = req.nextUrl.searchParams.get('b')

  if (!a || !b) {
    return NextResponse.json({ error: 'Missing a or b partnership IDs' }, { status: 400 })
  }

  // Data queries use admin client to bypass RLS (same pattern as system-status route)
  const admin = createAdminClient()

  // Fetch everything in parallel: persisted match (both orderings), answers, partnerships
  const [matchAB, matchBA, answersA, answersB, partnershipsResult] = await Promise.all([
    admin
      .from('computed_matches')
      .select('score, tier, breakdown, engine_version, computed_at')
      .eq('partnership_a', a)
      .eq('partnership_b', b)
      .maybeSingle(),

    admin
      .from('computed_matches')
      .select('score, tier, breakdown, engine_version, computed_at')
      .eq('partnership_a', b)
      .eq('partnership_b', a)
      .maybeSingle(),

    admin
      .from('user_survey_responses')
      .select('answers_json')
      .eq('partnership_id', a)
      .maybeSingle(),

    admin
      .from('user_survey_responses')
      .select('answers_json')
      .eq('partnership_id', b)
      .maybeSingle(),

    admin
      .from('partnerships')
      .select('id, display_name, latitude, longitude, profile_type')
      .in('id', [a, b]),
  ])

  const partnershipA = partnershipsResult.data?.find((p: any) => p.id === a)
  const partnershipB = partnershipsResult.data?.find((p: any) => p.id === b)
  const rawA = answersA.data?.answers_json as Record<string, any> | undefined
  const rawB = answersB.data?.answers_json as Record<string, any> | undefined

  // Resolve display names: partnership.display_name → profile.full_name → profile.email → "User"
  async function resolveName(partnershipId: string, partnership: any): Promise<string> {
    if (partnership?.display_name) return partnership.display_name
    // Look up the owner's profile
    const { data: member } = await admin
      .from('partnership_members')
      .select('user_id')
      .eq('partnership_id', partnershipId)
      .eq('role', 'owner')
      .maybeSingle()
    if (member?.user_id) {
      const { data: profile } = await admin
        .from('profiles')
        .select('full_name, email')
        .eq('user_id', member.user_id)
        .maybeSingle()
      if (profile?.full_name) return profile.full_name
      if (profile?.email) return profile.email.split('@')[0]
    }
    return partnershipId.slice(0, 8)
  }

  const [nameA, nameB] = await Promise.all([
    resolveName(a, partnershipA),
    resolveName(b, partnershipB),
  ])

  // Check if we can proceed at all
  if (!rawA || !rawB) {
    return NextResponse.json({
      error: 'Cannot inspect: missing survey answers',
      debug: {
        pidA: a,
        pidB: b,
        partnershipAExists: !!partnershipA,
        partnershipBExists: !!partnershipB,
        answersAExists: !!rawA,
        answersBExists: !!rawB,
      },
    }, { status: 404 })
  }

  // Try persisted match first
  const matchData = matchAB.data || matchBA.data
  const mode = matchData ? 'persisted' : 'debug'

  let matchPayload: {
    score: number
    tier: string
    engineVersion: string
    computedAt: string
    categories: any[]
    constraints?: any
  }

  if (matchData) {
    // Persisted match — use stored breakdown
    matchPayload = {
      score: matchData.score,
      tier: matchData.tier,
      engineVersion: matchData.engine_version,
      computedAt: matchData.computed_at,
      categories: matchData.breakdown ?? [],
    }
  } else {
    // Debug mode — compute on demand from raw answers
    const isACouple = partnershipA?.profile_type === 'couple'
    const isBCouple = partnershipB?.profile_type === 'couple'

    // Inject location metadata (same as computeMatches.ts does)
    const rawAWithLocation = { ...rawA }
    const rawBWithLocation = { ...rawB }
    if (partnershipA?.latitude != null) {
      rawAWithLocation._latitude = partnershipA.latitude
      rawAWithLocation._longitude = partnershipA.longitude
    }
    if (partnershipB?.latitude != null) {
      rawBWithLocation._latitude = partnershipB.latitude
      rawBWithLocation._longitude = partnershipB.longitude
    }

    const result = calculateCompatibilityFromRaw(rawAWithLocation, rawBWithLocation, isACouple, isBCouple)

    matchPayload = {
      score: result.overallScore,
      tier: result.tier,
      engineVersion: 'live-debug',
      computedAt: new Date().toISOString(),
      categories: result.categories,
      constraints: result.constraints,
    }
  }

  return NextResponse.json({
    mode,
    match: matchPayload,
    userA: {
      partnershipId: a,
      displayName: nameA,
      answers: rawA,
      latitude: partnershipA?.latitude ?? null,
      longitude: partnershipA?.longitude ?? null,
    },
    userB: {
      partnershipId: b,
      displayName: nameB,
      answers: rawB,
      latitude: partnershipB?.latitude ?? null,
      longitude: partnershipB?.longitude ?? null,
    },
  })
}
