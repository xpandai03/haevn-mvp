'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth/context'
import { useToast } from '@/hooks/use-toast'
import { Loader2, Upload, X, User } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import Image from 'next/image'
import { setPrimaryPhoto } from '@/lib/services/photos'

interface Photo {
  id: string
  photo_url: string
  photo_type: 'public' | 'private'
  is_primary: boolean
}

interface PhotoManagerModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onPhotoUpdated?: (newPrimaryUrl: string) => void
  partnershipId?: string // Optional: if provided, skip API call
}

export function PhotoManagerModal({
  open,
  onOpenChange,
  onPhotoUpdated,
  partnershipId: propPartnershipId
}: PhotoManagerModalProps) {
  const { user } = useAuth()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [photos, setPhotos] = useState<Photo[]>([])
  const [partnershipId, setPartnershipId] = useState<string | null>(propPartnershipId || null)

  // Sync partnershipId state if prop changes
  useEffect(() => {
    if (propPartnershipId) {
      setPartnershipId(propPartnershipId)
    }
  }, [propPartnershipId])

  useEffect(() => {
    if (open) {
      loadPhotos()
    }
  }, [open, user, propPartnershipId])

  async function loadPhotos() {
    if (!user) return

    setLoading(true)
    const supabase = createClient()

    try {
      let currentPartnershipId = propPartnershipId || partnershipId

      // Only fetch from API if we don't have a partnershipId
      if (!currentPartnershipId) {
        const response = await fetch('/api/partnerships/my-partnership', {
          credentials: 'include'
        })

        if (!response.ok) {
          toast({
            title: 'Error',
            description: 'Failed to load partnership data',
            variant: 'destructive'
          })
          setLoading(false)
          return
        }

        const { partnership } = await response.json()

        if (!partnership) {
          setLoading(false)
          return
        }

        currentPartnershipId = partnership.partnershipId
        setPartnershipId(currentPartnershipId)
      }

      // Get photos - order by is_primary first, then order_index
      const { data: photoData } = await supabase
        .from('partnership_photos')
        .select('*')
        .eq('partnership_id', currentPartnershipId)
        .order('is_primary', { ascending: false })
        .order('order_index', { ascending: true })

      setPhotos(photoData || [])
    } catch (error) {
      console.error('Error loading photos:', error)
    } finally {
      setLoading(false)
    }
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

    // Validate file type - permissive for mobile (iOS HEIC, etc.)
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Invalid File',
        description: 'Please upload an image file.',
        variant: 'destructive'
      })
      return
    }

    // 10MB limit for iOS HEIC support
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: 'File Too Large',
        description: 'Please upload an image smaller than 10MB.',
        variant: 'destructive'
      })
      return
    }

    setUploading(true)
    const supabase = createClient()

    try {
      // Upload to Supabase Storage
      const fileName = `${partnershipId}/${Date.now()}_${file.name}`
      const bucketName = 'public-photos'
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(fileName, file)

      if (uploadError) throw uploadError

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from(bucketName)
        .getPublicUrl(uploadData.path)

      // Determine if this should be primary (first photo)
      const isPrimary = photos.length === 0

      // Save to database
      const { data: photoData, error: dbError } = await supabase
        .from('partnership_photos')
        .insert({
          partnership_id: partnershipId,
          photo_url: publicUrl,
          photo_type: 'public',
          is_primary: isPrimary
        })
        .select()
        .single()

      if (dbError) throw dbError

      const newPhotos = [...photos, photoData]
      setPhotos(newPhotos)

      // If this is the first photo (now primary), notify parent
      if (isPrimary && onPhotoUpdated) {
        onPhotoUpdated(publicUrl)
      }

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
      // Reset file input
      event.target.value = ''
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
      const updatedPhotos = photos.map(p => ({ ...p, is_primary: p.id === photoId }))
      setPhotos(updatedPhotos)

      // Notify parent of new primary photo
      const newPrimary = updatedPhotos.find(p => p.id === photoId)
      if (newPrimary && onPhotoUpdated) {
        onPhotoUpdated(newPrimary.photo_url)
      }

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
    const photoToDelete = photos.find(p => p.id === photoId)

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

      const remainingPhotos = photos.filter(p => p.id !== photoId)
      setPhotos(remainingPhotos)

      // If deleted photo was primary, set a new primary
      if (photoToDelete?.is_primary && remainingPhotos.length > 0) {
        const newPrimaryId = remainingPhotos[0].id
        await handleSetPrimary(newPrimaryId)
      } else if (remainingPhotos.length === 0 && onPhotoUpdated) {
        // No photos left, notify parent
        onPhotoUpdated('')
      }

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md mx-auto max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-center text-haevn-navy">Manage Photos</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-haevn-teal" />
          </div>
        ) : !partnershipId ? (
          <div className="text-center py-8 space-y-4">
            <Upload className="h-12 w-12 text-gray-400 mx-auto" />
            <p className="text-gray-600">No partnership found. Please complete onboarding first.</p>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            {/* Upload Section */}
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-3">
                Upload up to 5 photos. Your avatar is shown on your profile card.
              </p>
              <input
                type="file"
                id="photo-manager-upload"
                accept="image/*"
                onChange={handleFileUpload}
                disabled={uploading || photos.length >= 5}
                className="hidden"
              />
              <Button
                type="button"
                disabled={uploading || photos.length >= 5}
                className="bg-[#1B9A9A] hover:bg-[#178787] text-white"
                onClick={() => document.getElementById('photo-manager-upload')?.click()}
              >
                {uploading ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Uploading...</>
                ) : (
                  <><Upload className="h-4 w-4 mr-2" /> Upload Photo</>
                )}
              </Button>
              <p className="text-xs text-gray-500 mt-2">
                {photos.length >= 5 ? (
                  <span className="text-orange-500 font-medium">Maximum 5 photos reached</span>
                ) : (
                  `JPG, PNG, HEIC up to 10MB (${photos.length}/5)`
                )}
              </p>
            </div>

            {/* Photo Grid */}
            {photos.length > 0 ? (
              <div className="grid grid-cols-2 gap-3">
                {photos.map((photo) => (
                  <div key={photo.id} className="relative group">
                    <div className="aspect-square relative rounded-xl overflow-hidden border-2 border-gray-200">
                      <Image
                        src={photo.photo_url}
                        alt="Photo"
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
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex flex-col items-center justify-center gap-2 p-2">
                      {!photo.is_primary && (
                        <Button
                          size="sm"
                          onClick={() => handleSetPrimary(photo.id)}
                          className="bg-[#E29E0C] hover:bg-[#c68a0a] text-white text-xs w-full"
                        >
                          <User className="h-3 w-3 mr-1" />
                          Set as Avatar
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDeletePhoto(photo.id, photo.photo_url)}
                        className="text-xs w-full"
                      >
                        <X className="h-3 w-3 mr-1" />
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-xl">
                <Upload className="h-10 w-10 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600 text-sm">No photos uploaded yet</p>
                <p className="text-xs text-gray-500 mt-1">Upload your first photo to get started</p>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
