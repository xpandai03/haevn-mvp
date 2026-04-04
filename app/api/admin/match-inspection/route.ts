import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isAdminUser } from '@/lib/admin/allowlist'

export async function GET(req: NextRequest) {
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

  // Try both orderings — computed_matches stores (partnership_a, partnership_b) in one direction only
  const [matchAB, matchBA, answersA, answersB, partnershipsResult] = await Promise.all([
    supabase
      .from('computed_matches')
      .select('score, tier, breakdown, engine_version, computed_at')
      .eq('partnership_a', a)
      .eq('partnership_b', b)
      .maybeSingle(),

    supabase
      .from('computed_matches')
      .select('score, tier, breakdown, engine_version, computed_at')
      .eq('partnership_a', b)
      .eq('partnership_b', a)
      .maybeSingle(),

    supabase
      .from('user_survey_responses')
      .select('answers_json')
      .eq('partnership_id', a)
      .maybeSingle(),

    supabase
      .from('user_survey_responses')
      .select('answers_json')
      .eq('partnership_id', b)
      .maybeSingle(),

    supabase
      .from('partnerships')
      .select('id, display_name, latitude, longitude')
      .in('id', [a, b]),
  ])

  const matchData = matchAB.data || matchBA.data

  if (!matchData) {
    // Debug: check if either partnership has ANY matches at all
    const { count: countA } = await supabase
      .from('computed_matches')
      .select('id', { count: 'exact', head: true })
      .or(`partnership_a.eq.${a},partnership_b.eq.${a}`)

    const { count: countB } = await supabase
      .from('computed_matches')
      .select('id', { count: 'exact', head: true })
      .or(`partnership_a.eq.${b},partnership_b.eq.${b}`)

    const partAExists = partnershipsResult.data?.some((p: any) => p.id === a) ?? false
    const partBExists = partnershipsResult.data?.some((p: any) => p.id === b) ?? false

    return NextResponse.json({
      error: 'Match not found. Only persisted matches (score >= 80, outcome=stored) can be inspected. Below-threshold and constraint-failed pairs are not stored in computed_matches.',
      debug: {
        pidA: a,
        pidB: b,
        partnershipAExists: partAExists,
        partnershipBExists: partBExists,
        answersAExists: !!answersA.data,
        answersBExists: !!answersB.data,
        matchesForA: countA ?? 0,
        matchesForB: countB ?? 0,
        lookupTried: ['A→B', 'B→A'],
        errorAB: matchAB.error?.message,
        errorBA: matchBA.error?.message,
      },
    }, { status: 404 })
  }

  const matchResult = { data: matchData }

  const partnershipA = partnershipsResult.data?.find((p: any) => p.id === a)
  const partnershipB = partnershipsResult.data?.find((p: any) => p.id === b)

  return NextResponse.json({
    match: {
      score: matchResult.data.score,
      tier: matchResult.data.tier,
      engineVersion: matchResult.data.engine_version,
      computedAt: matchResult.data.computed_at,
      categories: matchResult.data.breakdown ?? [],
    },
    userA: {
      partnershipId: a,
      displayName: partnershipA?.display_name ?? 'Unknown',
      answers: answersA.data?.answers_json ?? {},
      latitude: partnershipA?.latitude ?? null,
      longitude: partnershipA?.longitude ?? null,
    },
    userB: {
      partnershipId: b,
      displayName: partnershipB?.display_name ?? 'Unknown',
      answers: answersB.data?.answers_json ?? {},
      latitude: partnershipB?.latitude ?? null,
      longitude: partnershipB?.longitude ?? null,
    },
  })
}
