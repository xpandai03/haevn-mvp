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

  // Run all queries in parallel
  const [matchResult, answersA, answersB, partnershipsResult] = await Promise.all([
    supabase
      .from('computed_matches')
      .select('score, tier, breakdown, engine_version, computed_at')
      .or(`and(partnership_a.eq.${a},partnership_b.eq.${b}),and(partnership_a.eq.${b},partnership_b.eq.${a})`)
      .single(),

    supabase
      .from('user_survey_responses')
      .select('answers_json')
      .eq('partnership_id', a)
      .single(),

    supabase
      .from('user_survey_responses')
      .select('answers_json')
      .eq('partnership_id', b)
      .single(),

    supabase
      .from('partnerships')
      .select('id, display_name, latitude, longitude')
      .in('id', [a, b]),
  ])

  if (matchResult.error || !matchResult.data) {
    return NextResponse.json({ error: 'Match not found', detail: matchResult.error?.message }, { status: 404 })
  }

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
