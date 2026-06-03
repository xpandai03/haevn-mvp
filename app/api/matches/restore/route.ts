import { NextRequest, NextResponse } from 'next/server'
import { restoreMatch } from '@/lib/actions/hiddenMatches'

export async function POST(request: NextRequest) {
  let matchPartnershipId: string
  try {
    const body = await request.json()
    matchPartnershipId = body.matchPartnershipId
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON' },
      { status: 400 }
    )
  }
  if (!matchPartnershipId || typeof matchPartnershipId !== 'string') {
    return NextResponse.json(
      { success: false, error: 'matchPartnershipId required' },
      { status: 400 }
    )
  }
  const result = await restoreMatch(matchPartnershipId)
  return NextResponse.json(result, { status: result.success ? 200 : 400 })
}
