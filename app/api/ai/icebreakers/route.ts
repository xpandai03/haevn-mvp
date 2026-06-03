import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { selectBestPartnership } from '@/lib/partnership/selectPartnership'
import {
  generateIcebreakers,
  FALLBACK_ICEBREAKERS,
} from '@/lib/ai/generateIcebreakers'

/**
 * POST { handshakeId } → { lines: string[] }
 *
 * Generates 3 conversation starters for the matched pair. Always returns 3
 * lines (falls back to generic starters on any failure). Generated on demand;
 * not persisted (gpt-4o-mini cost is negligible per chat open).
 */
export async function POST(request: NextRequest) {
  try {
    const { handshakeId } = await request.json().catch(() => ({}))

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ lines: FALLBACK_ICEBREAKERS })
    }

    const admin = createAdminClient()
    const viewer = await selectBestPartnership(admin, user.id)

    // Resolve the other partnership from the handshake to personalize context.
    let matchName: string | undefined
    let about: string | undefined
    if (handshakeId && viewer) {
      const { data: hs } = await admin
        .from('handshakes')
        .select('a_partnership, b_partnership')
        .eq('id', handshakeId)
        .maybeSingle()
      if (hs) {
        const otherId =
          hs.a_partnership === viewer.partnership_id
            ? hs.b_partnership
            : hs.a_partnership
        const { data: other } = await admin
          .from('partnerships')
          .select('display_name, connection_summary')
          .eq('id', otherId)
          .maybeSingle()
        matchName = other?.display_name?.split(' ')[0]
        about = other?.connection_summary || undefined
      }
    }

    const lines = await generateIcebreakers({ matchName, about })
    return NextResponse.json({ lines })
  } catch (e) {
    console.error('[icebreakers] route error:', e)
    return NextResponse.json({ lines: FALLBACK_ICEBREAKERS })
  }
}
