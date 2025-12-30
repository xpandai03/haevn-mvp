import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * DEV ONLY: Populate a partnership with test profile data
 *
 * POST /api/dev/populate-test-profile
 * Body: { partnershipId: string }
 */
export async function POST(request: Request) {
  // Only allow in development
  if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_DEV_ENDPOINTS) {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { partnershipId } = body

    if (!partnershipId) {
      return NextResponse.json({ error: 'partnershipId required' }, { status: 400 })
    }

    const adminClient = createAdminClient()

    // Sample profile data
    const profileData = {
      short_bio: "We're Chris & Sam - adventurous spirits who love hiking, trying new restaurants, and cozy nights in. Looking to meet like-minded couples for genuine connections.",
      long_bio: "Together for 5 years, we've always been curious about ethical non-monogamy. We communicate openly, respect boundaries, and believe in building real friendships first. Chris is a software engineer who loves cooking, Sam is a yoga instructor passionate about wellness. We're based in LA but travel often for outdoor adventures.",
      intentions: ['Long-term relationship', 'Friendship', 'Exploring'],
      lifestyle_tags: ['Active', 'Foodie', 'Travel', 'Outdoorsy', 'Social', 'Fitness'],
      structure: { type: 'couple', open_to: ['couples', 'singles'] },
      age: 32,
      profile_state: 'live'
    }

    // Update partnership
    const { data: partnership, error: updateError } = await adminClient
      .from('partnerships')
      .update(profileData)
      .eq('id', partnershipId)
      .select()
      .single()

    if (updateError) {
      console.error('[populate-test-profile] Update error:', updateError)
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // Add placeholder photos using Unsplash
    const photoUrls = [
      'https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?w=800&q=80', // Couple hiking
      'https://images.unsplash.com/photo-1522673607200-164d1b6ce486?w=800&q=80', // Couple laughing
      'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=800&q=80', // Portrait
    ]

    // Check if photos already exist
    const { data: existingPhotos } = await adminClient
      .from('partnership_photos')
      .select('id')
      .eq('partnership_id', partnershipId)

    if (!existingPhotos || existingPhotos.length === 0) {
      // Insert placeholder photos
      const photosToInsert = photoUrls.map((url, index) => ({
        partnership_id: partnershipId,
        photo_url: url,
        photo_type: 'public' as const,
        is_primary: index === 0,
        order_index: index,
      }))

      const { error: photoError } = await adminClient
        .from('partnership_photos')
        .insert(photosToInsert)

      if (photoError) {
        console.error('[populate-test-profile] Photo insert error:', photoError)
        // Don't fail the whole request, profile data was saved
      }
    }

    return NextResponse.json({
      success: true,
      partnership,
      message: 'Test profile data populated successfully'
    })

  } catch (error: any) {
    console.error('[populate-test-profile] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
