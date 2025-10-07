import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/lib/types/supabase'

type PartnershipPhoto = Database['public']['Tables']['partnership_photos']['Row']

export interface PhotoUploadResult {
  photoId: string
  url: string
  error?: string
}

export interface PhotoMetadata {
  id: string
  partnership_id: string
  photo_url: string
  photo_type: 'public' | 'private'
  is_primary: boolean
  width?: number
  height?: number
  nsfw_flag?: boolean
  order_index: number
  created_at: string
}

export async function uploadPhoto(
  partnershipId: string,
  file: File,
  photoType: 'public' | 'private'
): Promise<PhotoUploadResult> {
  const supabase = createClient()

  try {
    // Generate unique filename
    const fileExt = file.name.split('.').pop()
    const fileName = `${partnershipId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
    const bucketName = photoType === 'public' ? 'public-photos' : 'private-photos'

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false
      })

    if (uploadError) {
      throw uploadError
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from(bucketName)
      .getPublicUrl(fileName)

    // Get next order index
    const { data: existingPhotos } = await supabase
      .from('partnership_photos')
      .select('order_index')
      .eq('partnership_id', partnershipId)
      .eq('photo_type', photoType)
      .order('order_index', { ascending: false })
      .limit(1)

    const nextOrderIndex = existingPhotos && existingPhotos.length > 0
      ? (existingPhotos[0].order_index || 0) + 1
      : 0

    // Save metadata to database
    const { data: photoRecord, error: dbError } = await supabase
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
      await supabase.storage.from(bucketName).remove([fileName])
      throw dbError
    }

    return {
      photoId: photoRecord.id,
      url: publicUrl
    }
  } catch (error) {
    console.error('Photo upload error:', error)
    return {
      photoId: '',
      url: '',
      error: error instanceof Error ? error.message : 'Upload failed'
    }
  }
}

export async function deletePhoto(
  photoId: string,
  partnershipId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient()

  try {
    // Get photo details first
    const { data: photo, error: fetchError } = await supabase
      .from('partnership_photos')
      .select('photo_url, photo_type')
      .eq('id', photoId)
      .eq('partnership_id', partnershipId) // Ensure ownership
      .single()

    if (fetchError || !photo) {
      throw new Error('Photo not found')
    }

    // Extract file path from URL
    const urlParts = photo.photo_url.split('/')
    const bucketName = photo.photo_type === 'public' ? 'public-photos' : 'private-photos'
    const fileName = `${partnershipId}/${urlParts[urlParts.length - 1]}`

    // Delete from database first
    const { error: deleteError } = await supabase
      .from('partnership_photos')
      .delete()
      .eq('id', photoId)
      .eq('partnership_id', partnershipId)

    if (deleteError) {
      throw deleteError
    }

    // Then delete from storage
    const { error: storageError } = await supabase.storage
      .from(bucketName)
      .remove([fileName])

    if (storageError) {
      console.error('Storage deletion error (non-critical):', storageError)
    }

    return { success: true }
  } catch (error) {
    console.error('Photo deletion error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Deletion failed'
    }
  }
}

export async function getPartnershipPhotos(
  partnershipId: string
): Promise<PhotoMetadata[]> {
  const supabase = createClient()

  try {
    const { data: photos, error } = await supabase
      .from('partnership_photos')
      .select('*')
      .eq('partnership_id', partnershipId)
      .order('photo_type', { ascending: true })
      .order('order_index', { ascending: true })

    if (error) throw error

    return photos || []
  } catch (error) {
    console.error('Error fetching photos:', error)
    return []
  }
}

export async function reorderPhotos(
  partnershipId: string,
  photoIds: string[],
  photoType: 'public' | 'private'
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient()

  try {
    // Update order_index for each photo
    const updates = photoIds.map((photoId, index) => ({
      id: photoId,
      partnership_id: partnershipId,
      order_index: index
    }))

    // Batch update (Note: Supabase doesn't have bulk update, so we do it one by one)
    for (const update of updates) {
      const { error } = await supabase
        .from('partnership_photos')
        .update({ order_index: update.order_index })
        .eq('id', update.id)
        .eq('partnership_id', update.partnership_id)
        .eq('photo_type', photoType)

      if (error) throw error
    }

    return { success: true }
  } catch (error) {
    console.error('Photo reorder error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Reorder failed'
    }
  }
}

/**
 * Set a photo as the primary/avatar photo for a partnership
 * Automatically unsets any existing primary photo
 */
export async function setPrimaryPhoto(
  partnershipId: string,
  photoId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient()

  try {
    console.log('📸 [setPrimaryPhoto] Setting photo as primary:', photoId)

    // First, unset all primary photos for this partnership
    const { error: unsetError } = await supabase
      .from('partnership_photos')
      .update({ is_primary: false })
      .eq('partnership_id', partnershipId)
      .eq('is_primary', true)

    if (unsetError) {
      console.error('❌ [setPrimaryPhoto] Error unsetting previous primary:', unsetError)
      throw unsetError
    }

    // Then set the new primary photo
    const { error: setPrimaryError } = await supabase
      .from('partnership_photos')
      .update({ is_primary: true })
      .eq('id', photoId)
      .eq('partnership_id', partnershipId)

    if (setPrimaryError) {
      console.error('❌ [setPrimaryPhoto] Error setting new primary:', setPrimaryError)
      throw setPrimaryError
    }

    console.log('✅ [setPrimaryPhoto] Primary photo updated successfully')
    return { success: true }
  } catch (error) {
    console.error('❌ [setPrimaryPhoto] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to set primary photo'
    }
  }
}

/**
 * Get the primary/avatar photo for a partnership
 */
export async function getPrimaryPhoto(
  partnershipId: string
): Promise<PhotoMetadata | null> {
  const supabase = createClient()

  try {
    const { data: photo, error } = await supabase
      .from('partnership_photos')
      .select('*')
      .eq('partnership_id', partnershipId)
      .eq('is_primary', true)
      .single()

    if (error) {
      // If no primary photo found, return null (not an error)
      if (error.code === 'PGRST116') {
        return null
      }
      throw error
    }

    return photo
  } catch (error) {
    console.error('Error fetching primary photo:', error)
    return null
  }
}