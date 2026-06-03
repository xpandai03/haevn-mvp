import { NextResponse } from 'next/server'
import { getHiddenMatches } from '@/lib/actions/hiddenMatches'

export async function GET() {
  const matches = await getHiddenMatches()
  return NextResponse.json({ success: true, matches })
}
