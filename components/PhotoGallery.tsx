'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { uploadPhoto, setPrimaryPhoto, deletePhoto, PhotoMetadata } from '@/lib/services/photos'
import { Upload, Loader2, Trash2, Star, Camera, Plus } from 'lucide-react'
import Image from 'next/image'

interface PhotoGalleryProps {
  partnershipId: string
  photos: PhotoMetadata[]
  onPhotosChange: () => void
}

export function PhotoGallery({ partnershipId, photos, onPhotosChange }: PhotoGalleryProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [uploading, setUploading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [settingPrimaryId, setSettingPrimaryId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    // Validate all files first
    for (let i = 0; i < files.length; i++) {
      const file = files[i]

      if (!file.type.startsWith('image/')) {
        toast({
          title: 'Invalid File',
          description: `${file.name} is not an image file`,
          variant: 'destructive'
        })
        return
      }

      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: 'File Too Large',
          description: `${file.name} is larger than 5MB`,
          variant: 'destructive'
        })
        return
      }
    }

    setUploading(true)

    try {
      // Upload all files
      const uploadPromises = Array.from(files).map(file =>
        uploadPhoto(partnershipId, file, 'public')
      )

      const results = await Promise.all(uploadPromises)

      const failedUploads = results.filter(r => r.error)

      if (failedUploads.length > 0) {
        toast({
          title: 'Some Uploads Failed',
          description: `${failedUploads.length} photo(s) failed to upload`,
          variant: 'destructive'
        })
      } else {
        toast({
          title: 'Photos Uploaded!',
          description: `Successfully uploaded ${results.length} photo(s)`
        })
      }

      onPhotosChange()
    } catch (error: any) {
      console.error('Upload error:', error)
      toast({
        title: 'Upload Failed',
        description: error.message || 'Failed to upload photos',
        variant: 'destructive'
      })
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleSetPrimary = async (photoId: string) => {
    setSettingPrimaryId(photoId)

    try {
      const result = await setPrimaryPhoto(partnershipId, photoId)

      if (!result.success) {
        throw new Error(result.error || 'Failed to set as profile picture')
      }

      toast({
        title: 'Profile Picture Updated!',
        description: 'This photo is now your profile picture'
      })

      onPhotosChange()
    } catch (error: any) {
      console.error('Set primary error:', error)
      toast({
        title: 'Update Failed',
        description: error.message || 'Failed to set profile picture',
        variant: 'destructive'
      })
    } finally {
      setSettingPrimaryId(null)
    }
  }

  const handleDelete = async (photoId: string) => {
    if (!confirm('Are you sure you want to delete this photo?')) {
      return
    }

    setDeletingId(photoId)

    try {
      const result = await deletePhoto(photoId, partnershipId)

      if (!result.success) {
        throw new Error(result.error || 'Failed to delete photo')
      }

      toast({
        title: 'Photo Deleted',
        description: 'The photo has been removed'
      })

      onPhotosChange()
    } catch (error: any) {
      console.error('Delete error:', error)
      toast({
        title: 'Delete Failed',
        description: error.message || 'Failed to delete photo',
        variant: 'destructive'
      })
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <Card className="border-[#252627]/10 shadow-sm bg-white">
      <CardContent className="pt-5 pb-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Camera className="h-4 w-4 text-[#E29E0C]" />
            <h2 className="text-lg text-[#252627]" style={{ fontFamily: 'Roboto', fontWeight: 900, letterSpacing: '-0.015em', lineHeight: '100%' }}>
              Photos
            </h2>
          </div>
          <Button
            onClick={() => router.push('/add-photos')}
            className="bg-[#008080] hover:bg-[#006666] text-white"
            size="sm"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Photos
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileChange}
            className="hidden"
          />
        </div>

        {photos.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed border-[#252627]/20 rounded-lg">
            <Camera className="h-12 w-12 mx-auto text-[#252627]/40 mb-3" />
            <p className="text-body text-[#252627]/60 mb-2" style={{ fontFamily: 'Roboto', fontWeight: 300 }}>
              No photos yet
            </p>
            <p className="text-body-sm text-[#252627]/40 mb-4" style={{ fontFamily: 'Roboto', fontWeight: 300 }}>
              Upload photos to your gallery
            </p>
            <Button
              onClick={() => router.push('/add-photos')}
              variant="outline"
              size="sm"
              className="border-[#008080] text-[#008080] hover:bg-[#008080]/10"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Photos
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {photos.map((photo) => (
              <div key={photo.id} className="relative group aspect-square">
                <Image
                  src={photo.photo_url}
                  alt="Partnership photo"
                  fill
                  className="object-cover rounded-lg"
                />

                {/* Primary badge */}
                {photo.is_primary && (
                  <div className="absolute top-2 right-2 bg-[#E29E0C] text-white px-2 py-1 rounded-full text-xs flex items-center gap-1">
                    <Star className="h-3 w-3 fill-white" />
                    Profile
                  </div>
                )}

                {/* Hover overlay with actions */}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex flex-col items-center justify-center gap-2">
                  {!photo.is_primary && (
                    <Button
                      onClick={() => handleSetPrimary(photo.id)}
                      disabled={settingPrimaryId === photo.id}
                      size="sm"
                      className="bg-[#008080] hover:bg-[#006666] text-white"
                    >
                      {settingPrimaryId === photo.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <>
                          <Star className="h-3 w-3 mr-1" />
                          Set as Profile
                        </>
                      )}
                    </Button>
                  )}
                  <Button
                    onClick={() => handleDelete(photo.id)}
                    disabled={deletingId === photo.id}
                    size="sm"
                    variant="destructive"
                    className="bg-red-600 hover:bg-red-700"
                  >
                    {deletingId === photo.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <>
                        <Trash2 className="h-3 w-3 mr-1" />
                        Delete
                      </>
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="text-caption text-[#252627]/60 mt-4" style={{ fontFamily: 'Roboto', fontWeight: 300 }}>
          Upload up to 10 photos. Max 5MB per photo. Supported: JPG, PNG, WebP
        </p>
      </CardContent>
    </Card>
  )
}
