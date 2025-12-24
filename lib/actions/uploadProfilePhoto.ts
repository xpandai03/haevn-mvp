'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const MAX_SIZE = 10 * 1024 * 1024 // 10MB (iOS photos can be larger)

export interface UploadProfilePhotoResult {
  success: boolean
  photoUrl?: string
  error?: string
}

/**
 * Upload a profile photo and set it as the primary avatar
 */
export async function uploadProfilePhoto(formData: FormData): Promise<UploadProfilePhotoResult> {
  console.log('[uploadProfilePhoto] Starting upload...')

  try {
    // Get file from FormData
    const file = formData.get('file') as File | null
    if (!file) {
      console.error('[uploadProfilePhoto] No file in FormData')
      return { success: false, error: 'No file provided' }
    }

    console.log('[uploadProfilePhoto] File received:', {
      name: file.name,
      type: file.type,
      size: file.size
    })

    // Validate file type - be very permissive for mobile compatibility
    // iOS Safari can send empty type or unusual types
    const fileType = (file.type || '').toLowerCase()
    const fileName = file.name.toLowerCase()
    const isImage = fileType.startsWith('image/') ||
                    fileName.endsWith('.jpg') ||
                    fileName.endsWith('.jpeg') ||
                    fileName.endsWith('.png') ||
                    fileName.endsWith('.webp') ||
                    fileName.endsWith('.heic') ||
                    fileName.endsWith('.heif')

    if (!isImage && fileType !== '') {
      console.error('[uploadProfilePhoto] Rejected file type:', file.type, 'name:', file.name)
      return { success: false, error: 'Invalid file type. Please upload an image file.' }
    }

    // Validate file size
    if (file.size > MAX_SIZE) {
      console.error('[uploadProfilePhoto] File too large:', file.size)
      return { success: false, error: 'File too large. Maximum size is 10MB.' }
    }

    // Get authenticated user
    console.log('[uploadProfilePhoto] Getting authenticated user...')
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      console.error('[uploadProfilePhoto] Auth error:', authError)
      return { success: false, error: 'Not authenticated' }
    }
    console.log('[uploadProfilePhoto] User:', user.id)

    // Get user's partnership
    console.log('[uploadProfilePhoto] Getting partnership...')
    const adminClient = await createAdminClient()
    const { data: membership, error: membershipError } = await adminClient
      .from('partnership_members')
      .select('partnership_id')
      .eq('user_id', user.id)
      .single()

    if (membershipError || !membership) {
      console.error('[uploadProfilePhoto] Membership error:', membershipError)
      return { success: false, error: 'No partnership found. Please complete onboarding first.' }
    }

    const partnershipId = membership.partnership_id
    console.log('[uploadProfilePhoto] Partnership ID:', partnershipId)

    // Generate unique filename - always use jpg extension for compatibility
    const originalExt = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const safeExt = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(originalExt) ? originalExt : 'jpg'
    const uniqueFileName = `${partnershipId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${safeExt}`
    const bucketName = 'partnership-photos' // Use consistent bucket name

    console.log('[uploadProfilePhoto] Uploading to:', bucketName, uniqueFileName)

    // Convert File to ArrayBuffer for server-side upload
    // Use try-catch specifically for this as it can fail on mobile
    let fileBuffer: Uint8Array
    try {
      const arrayBuffer = await file.arrayBuffer()
      fileBuffer = new Uint8Array(arrayBuffer)
      console.log('[uploadProfilePhoto] File buffer created, size:', fileBuffer.length)
    } catch (bufferError) {
      console.error('[uploadProfilePhoto] Failed to read file buffer:', bufferError)
      return { success: false, error: 'Failed to read file. Please try a different photo.' }
    }

    // Determine content type - default to jpeg if unknown
    const contentType = file.type || 'image/jpeg'

    // Upload to Supabase Storage using admin client
    console.log('[uploadProfilePhoto] Starting storage upload...')
    const { data: uploadData, error: uploadError } = await adminClient.storage
      .from(bucketName)
      .upload(uniqueFileName, fileBuffer, {
        contentType: contentType,
        cacheControl: '3600',
        upsert: true // Allow overwrite in case of retry
      })

    if (uploadError) {
      console.error('[uploadProfilePhoto] Storage upload error:', uploadError)
      return { success: false, error: `Upload failed: ${uploadError.message}` }
    }
    console.log('[uploadProfilePhoto] Storage upload success:', uploadData)

    // Get public URL - use uniqueFileName (the actual uploaded path)
    const { data: { publicUrl } } = adminClient.storage
      .from(bucketName)
      .getPublicUrl(uniqueFileName)

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
      await adminClient.storage.from(bucketName).remove([uniqueFileName])
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
