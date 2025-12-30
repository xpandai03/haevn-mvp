import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    const partnershipId = formData.get('partnershipId') as string
    const photoType = formData.get('photoType') as 'public' | 'private'

    if (!file || !partnershipId || !photoType) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Validate photo type
    if (!['public', 'private'].includes(photoType)) {
      return NextResponse.json(
        { error: 'Invalid photo type' },
        { status: 400 }
      )
    }

    // Use admin client for membership verification to bypass RLS
    // This matches the pattern in uploadProfilePhoto server action
    const adminSupabase = createAdminClient()

    // Verify user owns the partnership
    const { data: membership, error: membershipError } = await adminSupabase
      .from('partnership_members')
      .select('partnership_id')
      .eq('partnership_id', partnershipId)
      .eq('user_id', user.id)
      .single()

    if (membershipError || !membership) {
      console.error('[photo-upload] Membership verification failed:', {
        userId: user.id,
        partnershipId,
        error: membershipError
      })
      return NextResponse.json(
        { error: 'Unauthorized: You do not own this partnership' },
        { status: 403 }
      )
    }

    // Check file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 5MB' },
        { status: 400 }
      )
    }

    // Check file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed' },
        { status: 400 }
      )
    }

    // Generate unique filename
    const fileExt = file.name.split('.').pop()
    const fileName = `${partnershipId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
    const bucketName = photoType === 'public' ? 'public-photos' : 'private-photos'

    // adminSupabase already created above for membership verification

    // Convert File to ArrayBuffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = new Uint8Array(arrayBuffer)

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await adminSupabase.storage
      .from(bucketName)
      .upload(fileName, buffer, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: false
      })

    if (uploadError) {
      console.error('Storage upload error:', uploadError)
      return NextResponse.json(
        { error: 'Failed to upload file' },
        { status: 500 }
      )
    }

    // Get public URL
    const { data: { publicUrl } } = adminSupabase.storage
      .from(bucketName)
      .getPublicUrl(fileName)

    // Get next order index (using admin client for consistency)
    const { data: existingPhotos } = await adminSupabase
      .from('partnership_photos')
      .select('order_index')
      .eq('partnership_id', partnershipId)
      .eq('photo_type', photoType)
      .order('order_index', { ascending: false })
      .limit(1)

    const nextOrderIndex = existingPhotos && existingPhotos.length > 0
      ? (existingPhotos[0].order_index || 0) + 1
      : 0

    // Save metadata to database (using admin client)
    const { data: photoRecord, error: dbError } = await adminSupabase
      .from('partnership_photos')
      .insert({
        partnership_id: partnershipId,
        photo_url: publicUrl,
        photo_type: photoType,
        order_index: nextOrderIndex
      })
      .select()
      .single()

    if (dbError) {
      // Clean up uploaded file if database insert fails
      await adminSupabase.storage.from(bucketName).remove([fileName])
      console.error('Database insert error:', dbError)
      return NextResponse.json(
        { error: 'Failed to save photo metadata' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      photoId: photoRecord.id,
      url: publicUrl,
      photo: photoRecord
    })
  } catch (error) {
    console.error('Photo upload error:', error)
    return NextResponse.json(
      { error: 'Failed to upload photo' },
      { status: 500 }
    )
  }
}

// DELETE endpoint for removing photos
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const photoId = searchParams.get('photoId')
    const partnershipId = searchParams.get('partnershipId')

    if (!photoId || !partnershipId) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      )
    }

    // Use admin client for all database operations (consistent with POST handler)
    const adminSupabase = createAdminClient()

    // Verify user owns the partnership
    const { data: membership, error: membershipError } = await adminSupabase
      .from('partnership_members')
      .select('partnership_id')
      .eq('partnership_id', partnershipId)
      .eq('user_id', user.id)
      .single()

    if (membershipError || !membership) {
      console.error('[photo-delete] Membership verification failed:', {
        userId: user.id,
        partnershipId,
        error: membershipError
      })
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      )
    }

    // Get photo details first
    const { data: photo, error: fetchError } = await adminSupabase
      .from('partnership_photos')
      .select('photo_url, photo_type')
      .eq('id', photoId)
      .eq('partnership_id', partnershipId)
      .single()

    if (fetchError || !photo) {
      return NextResponse.json(
        { error: 'Photo not found' },
        { status: 404 }
      )
    }

    // Extract file path from URL
    const urlParts = photo.photo_url.split('/')
    const bucketName = photo.photo_type === 'public' ? 'public-photos' : 'private-photos'
    const fileName = `${partnershipId}/${urlParts[urlParts.length - 1]}`

    // Delete from database first
    const { error: deleteError } = await adminSupabase
      .from('partnership_photos')
      .delete()
      .eq('id', photoId)
      .eq('partnership_id', partnershipId)

    if (deleteError) {
      return NextResponse.json(
        { error: 'Failed to delete photo record' },
        { status: 500 }
      )
    }

    // Then delete from storage
    const { error: storageError } = await adminSupabase.storage
      .from(bucketName)
      .remove([fileName])

    if (storageError) {
      console.error('Storage deletion error (non-critical):', storageError)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Photo deletion error:', error)
    return NextResponse.json(
      { error: 'Failed to delete photo' },
      { status: 500 }
    )
  }
}