/**
 * API Route: Start Veriff Verification
 * POST /api/verify/start
 *
 * Creates a new Veriff verification session and returns the hosted URL
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createVeriffSession } from '@/lib/veriff'

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const supabase = await createClient()
    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser()

    if (authError || !user) {
      console.error('[Verify] Authentication failed:', authError)
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    console.log('[Verify] Starting verification for user:', user.id)

    // Create Veriff session
    const { url, sessionId } = await createVeriffSession(user.id)

    // Store session ID in profiles table for tracking
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        veriff_session_id: sessionId,
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id)

    if (updateError) {
      console.error('[Verify] Failed to store session ID:', updateError)
      // Don't fail the request - user can still verify
    }

    console.log('[Verify] Session created successfully:', {
      userId: user.id,
      sessionId,
      url: url.substring(0, 50) + '...'
    })

    return NextResponse.json(
      {
        success: true,
        url,
        sessionId
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('[Verify] Error starting verification:', error)

    return NextResponse.json(
      {
        error: 'Failed to start verification',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
