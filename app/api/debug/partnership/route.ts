import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({
        error: 'Not authenticated',
        details: userError
      }, { status: 401 })
    }

    // Check if user has a profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .single()

    // Check existing partnership membership
    const { data: membership, error: membershipError } = await supabase
      .from('partnership_members')
      .select('*, partnerships(*)')
      .eq('user_id', user.id)
      .single()

    // Check if user owns any partnerships
    const { data: ownedPartnerships, error: ownedError } = await supabase
      .from('partnerships')
      .select('*')
      .eq('owner_id', user.id)

    // Check survey responses
    let surveyResponse = null
    if (membership?.partnership_id) {
      const { data, error } = await supabase
        .from('survey_responses')
        .select('*')
        .eq('partnership_id', membership.partnership_id)
        .single()

      surveyResponse = { data, error }
    }

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email
      },
      profile: {
        data: profile,
        error: profileError
      },
      membership: {
        data: membership,
        error: membershipError?.code === 'PGRST116' ? null : membershipError
      },
      ownedPartnerships: {
        data: ownedPartnerships,
        error: ownedError
      },
      surveyResponse
    })

  } catch (error) {
    return NextResponse.json({
      error: 'Server error',
      details: error
    }, { status: 500 })
  }
}

export async function POST() {
  try {
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({
        error: 'Not authenticated',
        details: userError
      }, { status: 401 })
    }

    // Try to create a partnership
    console.log('Creating partnership for user:', user.id)

    const { data: partnership, error: createError } = await supabase
      .from('partnerships')
      .insert({
        owner_id: user.id,
        city: 'Test City',
        membership_tier: 'free'
      })
      .select()
      .single()

    if (createError) {
      return NextResponse.json({
        error: 'Failed to create partnership',
        details: createError,
        query: {
          owner_id: user.id,
          city: 'Test City',
          membership_tier: 'free'
        }
      }, { status: 400 })
    }

    // Add user as member
    const { data: member, error: memberError } = await supabase
      .from('partnership_members')
      .insert({
        partnership_id: partnership.id,
        user_id: user.id,
        role: 'owner'
      })
      .select()
      .single()

    if (memberError) {
      return NextResponse.json({
        error: 'Failed to add user as member',
        partnership_created: partnership,
        details: memberError
      }, { status: 400 })
    }

    // Create survey response
    const { data: survey, error: surveyError } = await supabase
      .from('survey_responses')
      .insert({
        partnership_id: partnership.id,
        answers_json: {},
        completion_pct: 0
      })
      .select()
      .single()

    return NextResponse.json({
      success: true,
      partnership,
      member,
      survey: {
        data: survey,
        error: surveyError
      }
    })

  } catch (error) {
    return NextResponse.json({
      error: 'Server error',
      details: error
    }, { status: 500 })
  }
}