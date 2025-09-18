import { NextResponse } from 'next/server'
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
    const supabase = createServiceRoleClient()

    // Create public photos bucket
    const { data: publicBucket, error: publicError } = await supabase
      .storage
      .createBucket('public-photos', {
        public: false, // We'll control access via RLS
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
        fileSizeLimit: 5242880 // 5MB
      })

    // Create private photos bucket
    const { data: privateBucket, error: privateError } = await supabase
      .storage
      .createBucket('private-photos', {
        public: false,
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
        fileSizeLimit: 5242880 // 5MB
      })

    // Note: In production, you would set up RLS policies for these buckets
    // via the Supabase dashboard. For now, we'll handle access control
    // in our API routes

    const results = {
      publicBucket: publicError ? publicError.message : 'Created or already exists',
      privateBucket: privateError ? privateError.message : 'Created or already exists'
    }

    return NextResponse.json({
      message: 'Storage buckets configured',
      results
    })
  } catch (error) {
    console.error('Storage setup error:', error)
    return NextResponse.json(
      { error: 'Failed to setup storage buckets' },
      { status: 500 }
    )
  }
}