import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  // Dev-only guard
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'This endpoint is only available in development' },
      { status: 403 }
    )
  }

  try {
    const body = await request.json()
    const { city, isLive } = body

    // Validate input
    if (!city || typeof city !== 'string') {
      return NextResponse.json(
        { error: 'City name is required' },
        { status: 400 }
      )
    }

    if (typeof isLive !== 'boolean') {
      return NextResponse.json(
        { error: 'isLive must be a boolean' },
        { status: 400 }
      )
    }

    // Use service role client to upsert city status
    const supabase = createServiceRoleClient()

    const { data, error } = await supabase
      .from('city_status')
      .upsert(
        {
          city: city.trim(),
          is_live: isLive
        },
        {
          onConflict: 'city'
        }
      )
      .select()
      .single()

    if (error) {
      console.error('Error updating city status:', error)
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: `City '${city}' is now ${isLive ? 'LIVE' : 'WAITLIST'}`,
      data
    })

  } catch (error) {
    console.error('Unexpected error in flip-city:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
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
    endpoint: '/api/dev/flip-city',
    method: 'POST',
    description: 'Toggle city live/waitlist status (DEV ONLY)',
    body: {
      city: 'string - City name',
      isLive: 'boolean - Set to true for live, false for waitlist'
    },
    example: {
      city: 'Austin',
      isLive: true
    }
  })
}