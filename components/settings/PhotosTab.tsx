'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth/context'
import { useToast } from '@/hooks/use-toast'
import { Loader2, Upload, X, Star, User } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import Image from 'next/image'
import { setPrimaryPhoto } from '@/lib/services/photos'

interface Photo {
  id: string
  photo_url: string
  photo_type: 'public' | 'private'
  is_primary: boolean
}

export function PhotosTab() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [photos, setPhotos] = useState<Photo[]>([])
  const [partnershipId, setPartnershipId] = useState<string | null>(null)

  useEffect(() => {
    loadPhotos()
  }, [user])

  async function loadPhotos() {
    if (!user) return

    const supabase = createClient()

    // Get partnership ID via API route (server-side)
    const response = await fetch('/api/partnerships/my-partnership', {
      credentials: 'include'
    })

    if (!response.ok) {
      toast({
        title: 'Error',
        description: 'Failed to load partnership data',
        variant: 'destructive'
      })
      return
    }

    const { partnership } = await response.json()

    if (!partnership) {
      setLoading(false)
      return
    }

    console.log('[CLIENT] Partnership info loaded:', partnership.partnershipId)
    setPartnershipId(partnership.partnershipId)

    // Get photos - order by is_primary first, then order_index
    const { data: photoData } = await supabase
      .from('partnership_photos')
      .select('*')
      .eq('partnership_id', partnership.partnershipId)
      .order('is_primary', { ascending: false })
      .order('order_index', { ascending: true })

    setPhotos(photoData || [])
    setLoading(false)
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !partnershipId) return

    // Check photo limit (max 5 photos)
    if (photos.length >= 5) {
      toast({
        title: 'Photo Limit Reached',
        description: 'You can upload a maximum of 5 photos. Delete one to upload more.',
        variant: 'destructive'
      })
      return
    }

    // Validate file
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Invalid File',
        description: 'Please upload an image file.',
        variant: 'destructive'
      })
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'File Too Large',
        description: 'Please upload an image smaller than 5MB.',
        variant: 'destructive'
      })
      return
    }

    setUploading(true)
    const supabase = createClient()

    try {
      // Upload to Supabase Storage
      const fileName = `${partnershipId}/${Date.now()}_${file.name}`
      const bucketName = 'public-photos' // Use public bucket for now
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(fileName, file)

      if (uploadError) throw uploadError

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from(bucketName)
        .getPublicUrl(uploadData.path)

      // Save to database
      const { data: photoData, error: dbError } = await supabase
        .from('partnership_photos')
        .insert({
          partnership_id: partnershipId,
          photo_url: publicUrl,
          photo_type: 'public',
          is_primary: photos.length === 0 // First photo is primary
        })
        .select()
        .single()

      if (dbError) throw dbError

      setPhotos([...photos, photoData])

      toast({
        title: 'Photo Uploaded',
        description: 'Your photo has been added successfully.',
      })
    } catch (error) {
      console.error('Error uploading photo:', error)
      toast({
        title: 'Upload Failed',
        description: 'Failed to upload photo. Please try again.',
        variant: 'destructive'
      })
    } finally {
      setUploading(false)
    }
  }

  const handleSetPrimary = async (photoId: string) => {
    if (!partnershipId) return

    try {
      const result = await setPrimaryPhoto(partnershipId, photoId)

      if (result.error) {
        throw new Error(result.error)
      }

      // Update local state
      setPhotos(photos.map(p => ({ ...p, is_primary: p.id === photoId })))

      toast({
        title: 'Avatar Updated',
        description: 'Your profile picture has been updated.',
      })
    } catch (error) {
      console.error('Error setting primary:', error)
      toast({
        title: 'Error',
        description: 'Failed to update avatar.',
        variant: 'destructive'
      })
    }
  }

  const handleDeletePhoto = async (photoId: string, photoUrl: string) => {
    const supabase = createClient()

    try {
      // Extract file path from URL
      const bucketName = 'public-photos'
      const urlParts = photoUrl.split(`/${bucketName}/`)
      if (urlParts.length > 1) {
        const filePath = urlParts[1]
        await supabase.storage.from(bucketName).remove([filePath])
      }

      // Delete from database
      await supabase
        .from('partnership_photos')
        .delete()
        .eq('id', photoId)

      setPhotos(photos.filter(p => p.id !== photoId))

      toast({
        title: 'Photo Deleted',
        description: 'Your photo has been removed.',
      })
    } catch (error) {
      console.error('Error deleting photo:', error)
      toast({
        title: 'Error',
        description: 'Failed to delete photo.',
        variant: 'destructive'
      })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-haevn-teal-600" />
      </div>
    )
  }

  // Show helpful message if no partnership exists
  if (!partnershipId) {
    return (
      <div className="text-center py-12 space-y-4">
        <Upload className="h-16 w-16 text-haevn-gray-400 mx-auto" />
        <div>
          <h3 className="text-h3 text-haevn-gray-900 mb-2">No Partnership Yet</h3>
          <p className="text-body text-haevn-gray-600 max-w-md mx-auto">
            You need to create or join a partnership before you can upload photos.
          </p>
        </div>
        <div className="flex gap-3 justify-center pt-4">
          <Button
            onClick={() => window.location.href = '/onboarding'}
            className="bg-haevn-teal-500 hover:bg-haevn-teal-600 text-white"
          >
            Start Onboarding
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-h3 text-haevn-gray-900 mb-4">Photos</h3>
        <p className="text-body-sm text-haevn-gray-600 mb-6">
          Upload up to 5 photos for your profile. One photo will be your avatar (profile picture).
        </p>
      </div>

      {/* Upload Button */}
      <div>
        <input
          type="file"
          id="photo-upload"
          accept="image/*"
          onChange={handleFileUpload}
          disabled={uploading || photos.length >= 5}
          className="hidden"
        />
        <label htmlFor="photo-upload">
          <Button
            type="button"
            disabled={uploading || photos.length >= 5}
            className="bg-haevn-teal-500 hover:bg-haevn-teal-600 text-white cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={() => document.getElementById('photo-upload')?.click()}
          >
            {uploading ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Uploading...</>
            ) : (
              <><Upload className="h-4 w-4 mr-2" /> Upload Photo</>
            )}
          </Button>
        </label>
        <p className="text-caption text-haevn-gray-600 mt-2">
          {photos.length >= 5 ? (
            <span className="text-haevn-orange-500 font-medium">Maximum 5 photos reached. Delete one to upload more.</span>
          ) : (
            `Maximum file size: 5MB. Supported formats: JPG, PNG, GIF (${photos.length}/5)`
          )}
        </p>
      </div>

      {/* Photo Grid */}
      {photos.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {photos.map((photo) => (
            <div key={photo.id} className="relative group">
              <div className="aspect-square relative rounded-lg overflow-hidden border-2 border-haevn-gray-300">
                <Image
                  src={photo.photo_url}
                  alt="Partnership photo"
                  fill
                  className="object-cover"
                />
                {photo.is_primary && (
                  <div className="absolute top-2 left-2 bg-[#E29E0C] text-white px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1">
                    <User className="h-3 w-3" />
                    Avatar
                  </div>
                )}
              </div>

              {/* Hover Actions */}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
                {!photo.is_primary && (
                  <Button
                    size="sm"
                    onClick={() => handleSetPrimary(photo.id)}
                    className="bg-[#E29E0C] hover:bg-[#c68a0a] text-white"
                  >
                    <User className="h-4 w-4 mr-1" />
                    Set as Avatar
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => handleDeletePhoto(photo.id, photo.photo_url)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 border-2 border-dashed border-haevn-gray-300 rounded-lg">
          <Upload className="h-12 w-12 text-haevn-gray-400 mx-auto mb-4" />
          <p className="text-haevn-gray-600">No photos uploaded yet</p>
          <p className="text-sm text-haevn-gray-500 mt-1">Upload your first photo to get started</p>
        </div>
      )}
    </div>
  )
}
