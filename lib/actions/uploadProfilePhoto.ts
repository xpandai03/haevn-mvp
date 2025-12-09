'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_SIZE = 5 * 1024 * 1024 // 5MB

export interface UploadProfilePhotoResult {
  success: boolean
  photoUrl?: string
  error?: string
}

/**
 * Upload a profile photo and set it as the primary avatar
 */
export async function uploadProfilePhoto(formData: FormData): Promise<UploadProfilePhotoResult> {
  try {
    // Get file from FormData
    const file = formData.get('file') as File | null
    if (!file) {
      return { success: false, error: 'No file provided' }
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return { success: false, error: 'Invalid file type. Please upload a JPG, PNG, or WebP image.' }
    }

    // Validate file size
    if (file.size > MAX_SIZE) {
      return { success: false, error: 'File too large. Maximum size is 5MB.' }
    }

    // Get authenticated user
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Not authenticated' }
    }

    // Get user's partnership
    const adminClient = await createAdminClient()
    const { data: membership, error: membershipError } = await adminClient
      .from('partnership_members')
      .select('partnership_id')
      .eq('user_id', user.id)
      .single()

    if (membershipError || !membership) {
      return { success: false, error: 'No partnership found' }
    }

    const partnershipId = membership.partnership_id

    // Generate unique filename
    const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const fileName = `${partnershipId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
    const bucketName = 'public-photos'

    // Convert File to ArrayBuffer for server-side upload
    const arrayBuffer = await file.arrayBuffer()
    const fileBuffer = new Uint8Array(arrayBuffer)

    // Upload to Supabase Storage using admin client
    const { data: uploadData, error: uploadError } = await adminClient.storage
      .from(bucketName)
      .upload(fileName, fileBuffer, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: false
      })

    if (uploadError) {
      console.error('Upload error:', uploadError)
      return { success: false, error: 'Failed to upload image' }
    }

    // Get public URL
    const { data: { publicUrl } } = adminClient.storage
      .from(bucketName)
      .getPublicUrl(fileName)

    // First, unset any existing primary photos
    await adminClient
      .from('partnership_photos')
      .update({ is_primary: false })
      .eq('partnership_id', partnershipId)
      .eq('is_primary', true)

    // Get next order index
    const { data: existingPhotos } = await adminClient
      .from('partnership_photos')
      .select('order_index')
      .eq('partnership_id', partnershipId)
      .eq('photo_type', 'public')
      .order('order_index', { ascending: false })
      .limit(1)

    const nextOrderIndex = existingPhotos && existingPhotos.length > 0
      ? (existingPhotos[0].order_index || 0) + 1
      : 0

    // Save metadata to database with is_primary = true
    const { data: photoRecord, error: dbError } = await adminClient
      .from('partnership_photos')
      .insert({
        partnership_id: partnershipId,
        photo_url: publicUrl,
        photo_type: 'public',
        is_primary: true,
        order_index: nextOrderIndex
      })
      .select()
      .single()

    if (dbError) {
      console.error('Database error:', dbError)
      // Clean up uploaded file if database insert fails
      await adminClient.storage.from(bucketName).remove([fileName])
      return { success: false, error: 'Failed to save photo record' }
    }

    console.log('✅ Profile photo uploaded successfully:', publicUrl)
    return { success: true, photoUrl: publicUrl }

  } catch (error) {
    console.error('Profile photo upload error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Upload failed'
    }
  }
}
