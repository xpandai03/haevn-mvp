import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'

// Generate signed upload URL for photo uploads
export async function POST(request: NextRequest) {
  try {
    const { partnershipId, photoType, fileName } = await request.json()

    if (!partnershipId || !photoType || !fileName) {
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

    // For development - return a mock signed URL
    const mockPhotoId = uuidv4()
    const mockUrl = `https://placeholder.photos/${partnershipId}/${mockPhotoId}.jpg`

    return NextResponse.json({
      url: mockUrl,
      photoId: mockPhotoId
    })

    // Production: Use Supabase Storage with service role
    const supabase = createServiceRoleClient()

    // Check if user owns the partnership
    const { data: partnership, error: partnershipError } = await supabase
      .from('partnerships')
      .select('owner_id')
      .eq('id', partnershipId)
      .single()

    if (partnershipError || !partnership) {
      return NextResponse.json(
        { error: 'Partnership not found' },
        { status: 404 }
      )
    }

    // TODO: Verify current user is the owner
    // const { data: { user } } = await supabase.auth.getUser()
    // if (user?.id !== partnership.owner_id) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    // }

    // Generate unique file path
    const fileExt = fileName.split('.').pop()
    const photoId = uuidv4()
    const filePath = `${partnershipId}/${photoId}.${fileExt}`

    // Get signed upload URL
    const bucketName = photoType === 'public' ? 'public-photos' : 'private-photos'
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(bucketName)
      .createSignedUploadUrl(filePath)

    if (uploadError) {
      console.error('Upload error:', uploadError)
      return NextResponse.json(
        { error: 'Failed to create upload URL' },
        { status: 500 }
      )
    }

    // Store photo metadata in database
    const { error: dbError } = await supabase
      .from('partnership_photos')
      .insert({
        id: photoId,
        partnership_id: partnershipId,
        photo_url: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${bucketName}/${filePath}`,
        photo_type: photoType,
        order_index: 0 // Will be updated by client
      })

    if (dbError) {
      console.error('Database error:', dbError)
      return NextResponse.json(
        { error: 'Failed to store photo metadata' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      uploadUrl: uploadData.signedUrl,
      photoId,
      token: uploadData.token,
      path: filePath
    })

  } catch (error) {
    console.error('Photo upload error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}