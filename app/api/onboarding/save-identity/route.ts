import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  console.log('[API /onboarding/save-identity] ===== SAVE IDENTITY REQUEST =====')

  try {
    // Authenticate user using getUser() for server-side validation
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (!user || authError) {
      console.error('[API /onboarding/save-identity] ❌ AUTHENTICATION FAILED')
      console.error('[API /onboarding/save-identity] Error:', authError?.message)
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      )
    }

    console.log('[API /onboarding/save-identity] ✅ User authenticated:', user.id)

    // Parse request body
    const body = await request.json()
    console.log('[API /onboarding/save-identity] Incoming payload:', body)

    const { profileType, relationshipOrientation, city = 'Austin' } = body

    if (!profileType || !relationshipOrientation) {
      console.error('[API /onboarding/save-identity] Missing required fields')
      return NextResponse.json(
        { success: false, error: 'Missing required fields: profileType and relationshipOrientation' },
        { status: 400 }
      )
    }

    // Use admin client to bypass RLS
    const adminClient = createAdminClient()
    console.log('[API /onboarding/save-identity] Using adminClient for DB operations')

    // Check if partnership already exists
    console.log('[API /onboarding/save-identity] Checking for existing partnership...')
    const { data: existingPartnership, error: selectError } = await adminClient
      .from('partnerships')
      .select('id')
      .eq('owner_id', user.id)
      .maybeSingle()

    if (selectError) {
      console.error('[API /onboarding/save-identity] Error checking partnership:', selectError)
      return NextResponse.json(
        { success: false, error: `Database error: ${selectError.message}` },
        { status: 500 }
      )
    }

    if (existingPartnership) {
      // UPDATE existing partnership
      console.log('[API /onboarding/save-identity] ✍️ Updating existing partnership:', existingPartnership.id)
      const { error: updateError } = await adminClient
        .from('partnerships')
        .update({
          profile_type: profileType,
          relationship_orientation: [relationshipOrientation], // Store as array
          updated_at: new Date().toISOString()
        })
        .eq('id', existingPartnership.id)

      if (updateError) {
        console.error('[API /onboarding/save-identity] Update failed:', updateError)
        return NextResponse.json(
          { success: false, error: `Update failed: ${updateError.message}` },
          { status: 500 }
        )
      }

      console.log('[API /onboarding/save-identity] ✅ Partnership updated successfully')
      return NextResponse.json({
        success: true,
        partnershipId: existingPartnership.id,
        action: 'updated'
      })
    } else {
      // INSERT new partnership
      console.log('[API /onboarding/save-identity] ✍️ Creating new partnership')
      const { data: newPartnership, error: insertError } = await adminClient
        .from('partnerships')
        .insert({
          owner_id: user.id,
          city: city,
          profile_type: profileType,
          relationship_orientation: [relationshipOrientation], // Store as array
          membership_tier: 'free',
          advocate_mode: false
        })
        .select('id')
        .single()

      if (insertError) {
        console.error('[API /onboarding/save-identity] Insert failed:', insertError)
        return NextResponse.json(
          { success: false, error: `Insert failed: ${insertError.message}` },
          { status: 500 }
        )
      }

      if (!newPartnership) {
        console.error('[API /onboarding/save-identity] Partnership created but no data returned')
        return NextResponse.json(
          { success: false, error: 'Partnership creation returned no data' },
          { status: 500 }
        )
      }

      console.log('[API /onboarding/save-identity] ✅ Partnership created:', newPartnership.id)

      // Create partnership_member record for the owner
      console.log('[API /onboarding/save-identity] ✍️ Creating partnership_member record')
      const { error: memberError } = await adminClient
        .from('partnership_members')
        .insert({
          partnership_id: newPartnership.id,
          user_id: user.id,
          role: 'owner'
        })

      if (memberError) {
        console.error('[API /onboarding/save-identity] Membership insert failed:', memberError)
        // Don't fail the request - partnership is created, membership can be fixed later
        console.warn('[API /onboarding/save-identity] ⚠️ Continuing despite membership error')
      } else {
        console.log('[API /onboarding/save-identity] ✅ Partnership member created')
      }

      return NextResponse.json({
        success: true,
        partnershipId: newPartnership.id,
        action: 'created'
      })
    }
  } catch (error) {
    console.error('[API /onboarding/save-identity] Unexpected error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to save identity data'
      },
      { status: 500 }
    )
  }
}
