'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth/context'
import { useToast } from '@/hooks/use-toast'
import { Loader2, Upload, X, Star } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import Image from 'next/image'

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

    // Get partnership ID
    const { data: partnershipMembers } = await supabase
      .from('partnership_members')
      .select('partnership_id')
      .eq('user_id', user.id)
      .limit(1)
      .single()

    if (!partnershipMembers) {
      setLoading(false)
      return
    }

    setPartnershipId(partnershipMembers.partnership_id)

    // Get photos
    const { data: photoData } = await supabase
      .from('partnership_photos')
      .select('*')
      .eq('partnership_id', partnershipMembers.partnership_id)
      .order('is_primary', { ascending: false })

    setPhotos(photoData || [])
    setLoading(false)
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !partnershipId) return

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
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('partnership-photos')
        .upload(fileName, file)

      if (uploadError) throw uploadError

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('partnership-photos')
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

    const supabase = createClient()

    try {
      // Unset all primary photos
      await supabase
        .from('partnership_photos')
        .update({ is_primary: false })
        .eq('partnership_id', partnershipId)

      // Set new primary
      await supabase
        .from('partnership_photos')
        .update({ is_primary: true })
        .eq('id', photoId)

      setPhotos(photos.map(p => ({ ...p, is_primary: p.id === photoId })))

      toast({
        title: 'Primary Photo Updated',
        description: 'Your profile picture has been updated.',
      })
    } catch (error) {
      console.error('Error setting primary:', error)
      toast({
        title: 'Error',
        description: 'Failed to update primary photo.',
        variant: 'destructive'
      })
    }
  }

  const handleDeletePhoto = async (photoId: string, photoUrl: string) => {
    const supabase = createClient()

    try {
      // Extract file path from URL
      const urlParts = photoUrl.split('/partnership-photos/')
      if (urlParts.length > 1) {
        const filePath = urlParts[1]
        await supabase.storage.from('partnership-photos').remove([filePath])
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

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-h3 text-haevn-gray-900 mb-4">Photos</h3>
        <p className="text-body-sm text-haevn-gray-600 mb-6">
          Upload photos to show on your match profile. Mark one as your primary profile picture.
        </p>
      </div>

      {/* Upload Button */}
      <div>
        <input
          type="file"
          id="photo-upload"
          accept="image/*"
          onChange={handleFileUpload}
          disabled={uploading}
          className="hidden"
        />
        <label htmlFor="photo-upload">
          <Button
            type="button"
            disabled={uploading}
            className="bg-haevn-teal-500 hover:bg-haevn-teal-600 text-white cursor-pointer"
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
          Maximum file size: 5MB. Supported formats: JPG, PNG, GIF
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
                  <div className="absolute top-2 left-2 bg-haevn-orange-500 text-white px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1">
                    <Star className="h-3 w-3 fill-current" />
                    Primary
                  </div>
                )}
              </div>

              {/* Hover Actions */}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
                {!photo.is_primary && (
                  <Button
                    size="sm"
                    onClick={() => handleSetPrimary(photo.id)}
                    className="bg-haevn-teal-500 hover:bg-haevn-teal-600 text-white"
                  >
                    Set as Primary
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
