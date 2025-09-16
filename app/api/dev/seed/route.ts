import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/server'

export async function POST() {
  // Dev-only guard
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'This endpoint is only available in development' },
      { status: 403 }
    )
  }

  try {
    // Get authenticated user
    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json(
        { error: 'You must be logged in to seed data' },
        { status: 401 }
      )
    }

    // Use service role for admin operations
    const adminSupabase = createServiceRoleClient()

    // 1. Ensure user has a profile
    const { data: profile } = await adminSupabase
      .from('profiles')
      .upsert({
        user_id: user.id,
        full_name: user.email?.split('@')[0] || 'Test User',
        city: 'New York',
        msa_status: 'live',
        survey_complete: false
      }, {
        onConflict: 'user_id'
      })
      .select()
      .single()

    // 2. Create user's partnership
    const { data: userPartnership, error: partnershipError } = await adminSupabase
      .from('partnerships')
      .insert({
        owner_id: user.id,
        city: 'New York',
        membership_tier: 'plus'
      })
      .select()
      .single()

    if (partnershipError) {
      // Check if partnership already exists
      const { data: existingPartnership } = await adminSupabase
        .from('partnerships')
        .select()
        .eq('owner_id', user.id)
        .single()

      if (existingPartnership) {
        // Use existing partnership
        Object.assign(userPartnership, existingPartnership)
      } else {
        throw partnershipError
      }
    }

    // 3. Add user as partnership member
    const { data: memberData } = await adminSupabase
      .from('partnership_members')
      .upsert({
        partnership_id: userPartnership!.id,
        user_id: user.id,
        role: 'owner'
      }, {
        onConflict: 'partnership_id,user_id'
      })
      .select()

    // 4. Create survey response
    const { data: surveyData } = await adminSupabase
      .from('survey_responses')
      .upsert({
        partnership_id: userPartnership!.id,
        answers_json: {
          identity: {
            gender: 'Male',
            orientation: 'Straight',
            relationship_type: ['Monogamous']
          }
        },
        completion_pct: 25
      }, {
        onConflict: 'partnership_id'
      })
      .select()

    // 5. Create demo partnership "B-Unit" (not owned by current user)
    // First, create a demo user
    const demoEmail = `demo_${Date.now()}@haevn.test`
    const { data: demoAuth, error: demoAuthError } = await adminSupabase.auth.admin.createUser({
      email: demoEmail,
      password: 'demo_password_123',
      email_confirm: true
    })

    if (demoAuthError) {
      console.error('Error creating demo user:', demoAuthError)
      // Continue without demo partnership
    }

    let demoPartnership = null
    if (demoAuth?.user) {
      // Create demo user profile
      await adminSupabase
        .from('profiles')
        .insert({
          user_id: demoAuth.user.id,
          full_name: 'B-Unit Demo',
          city: 'New York',
          msa_status: 'live',
          survey_complete: true
        })

      // Create demo partnership
      const { data: demoP } = await adminSupabase
        .from('partnerships')
        .insert({
          owner_id: demoAuth.user.id,
          city: 'New York',
          membership_tier: 'plus'
        })
        .select()
        .single()

      demoPartnership = demoP

      if (demoP) {
        // Add demo user as member
        await adminSupabase
          .from('partnership_members')
          .insert({
            partnership_id: demoP.id,
            user_id: demoAuth.user.id,
            role: 'owner'
          })

        // Create demo survey response (100% complete)
        await adminSupabase
          .from('survey_responses')
          .insert({
            partnership_id: demoP.id,
            answers_json: {
              identity: {
                gender: 'Female',
                orientation: 'Bisexual',
                relationship_type: ['Open', 'Polyamorous']
              },
              intentions: {
                looking_for: ['Dating', 'Friendship'],
                timeline: 'Within a week'
              },
              boundaries: {
                privacy_level: 'Open',
                photo_sharing: 'After handshake'
              },
              logistics: {
                location_radius: '25 miles',
                availability: ['Weekday evenings', 'Weekends'],
                lifestyle: ['Social', 'Active']
              }
            },
            completion_pct: 100
          })
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Dev data seeded successfully',
      data: {
        user: {
          id: user.id,
          email: user.email,
          profile_id: profile?.user_id
        },
        userPartnership: {
          id: userPartnership?.id,
          owner_id: userPartnership?.owner_id,
          membership_tier: userPartnership?.membership_tier
        },
        demoPartnership: demoPartnership ? {
          id: demoPartnership.id,
          owner_id: demoPartnership.owner_id,
          name: 'B-Unit Demo'
        } : null,
        memberData,
        surveyData
      }
    })

  } catch (error) {
    console.error('Error seeding data:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to seed data' },
      { status: 500 }
    )
  }
}

// Document the endpoint
export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'This endpoint is only available in development' },
      { status: 403 }
    )
  }

  return NextResponse.json({
    endpoint: '/api/dev/seed',
    method: 'POST',
    description: 'Seed development data for current user (DEV ONLY)',
    body: 'No body required - uses current authenticated user',
    creates: [
      'User profile',
      'Partnership (owned by user)',
      'Partnership membership',
      'Survey response (25% complete)',
      'Demo partnership "B-Unit" (for testing discovery)'
    ]
  })
}