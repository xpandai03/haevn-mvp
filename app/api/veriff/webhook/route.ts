/**
 * API Route: Veriff Webhook Handler
 * POST /api/veriff/webhook
 *
 * Receives verification events from Veriff and updates user verification status
 * Validates webhook signature for security
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyVeriffSignature, isVerificationApproved, getVeriffStatusMessage } from '@/lib/veriff'

// Use service role key for admin operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    // Get signature from headers
    const signature = request.headers.get('x-hmac-signature') || request.headers.get('x-signature')

    if (!signature) {
      console.error('[Webhook] No signature provided')
      return NextResponse.json(
        { error: 'No signature' },
        { status: 401 }
      )
    }

    // Get raw body for signature verification
    const body = await request.text()

    // Verify signature
    if (!verifyVeriffSignature(signature, body)) {
      console.error('[Webhook] Invalid signature')
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      )
    }

    // Parse webhook payload
    const payload = JSON.parse(body)

    console.log('[Webhook] Received event:', {
      action: payload.action,
      id: payload.id,
      code: payload.code
    })

    // Handle verification completion
    if (payload.action === 'verification.session.completed') {
      const { id: sessionId, vendorData: userId, code } = payload

      console.log('[Webhook] Processing completion:', {
        sessionId,
        userId,
        code,
        message: getVeriffStatusMessage(code)
      })

      // Check if verification was approved (code 9001)
      if (code === 9001) {
        console.log('[Webhook] ✅ Verification approved for user:', userId)

        // Update profile to mark as verified
        // Note: This requires migration 015_add_veriff_fields.sql to be run
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            verified: true,
            verification_status: 'approved',
            verification_date: new Date().toISOString()
          })
          .eq('user_id', userId)

        if (updateError) {
          console.error('[Webhook] Failed to update profile:', updateError)
          // Try to continue - webhook should still acknowledge
        } else {
          console.log('[Webhook] Profile updated successfully')
        }
      } else {
        // Verification not approved
        console.log('[Webhook] ❌ Verification not approved:', {
          userId,
          code,
          message: getVeriffStatusMessage(code)
        })

        // Update profile with rejection status
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            verified: false,
            verification_status: 'declined',
            verification_date: new Date().toISOString()
          })
          .eq('user_id', userId)

        if (updateError) {
          console.error('[Webhook] Failed to update profile with decline:', updateError)
        }
      }
    }

    // Acknowledge receipt
    return NextResponse.json(
      { success: true },
      { status: 200 }
    )
  } catch (error) {
    console.error('[Webhook] Error processing webhook:', error)

    return NextResponse.json(
      {
        error: 'Webhook processing failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
