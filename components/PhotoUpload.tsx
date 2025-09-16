'use client'

import { useState, useRef } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Upload, X, Image as ImageIcon, Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import type { PhotoMetadata } from '@/lib/types/profile'

interface PhotoUploadProps {
  partnershipId: string
  photoType: 'public' | 'private'
  maxPhotos: number
  currentPhotos: PhotoMetadata[]
  onPhotoUploaded: (photo: PhotoMetadata) => void
  onPhotoDeleted: (photoId: string) => void
}

export function PhotoUpload({
  partnershipId,
  photoType,
  maxPhotos,
  currentPhotos,
  onPhotoUploaded,
  onPhotoDeleted
}: PhotoUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Invalid file type',
        description: 'Please select an image file',
        variant: 'destructive'
      })
      return
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: 'Please select a file under 5MB',
        variant: 'destructive'
      })
      return
    }

    setUploading(true)
    try {
      // For development - create mock photo with base64 data URL
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
        // Convert to base64 data URL for persistence
        const reader = new FileReader()
        reader.onloadend = () => {
          const mockPhoto: PhotoMetadata = {
            id: Math.random().toString(36).slice(2),
            partnership_id: partnershipId,
            photo_url: reader.result as string, // Base64 data URL
            photo_type: photoType,
            width: null,
            height: null,
            nsfw_flag: false,
            order_index: currentPhotos.length,
            created_at: new Date().toISOString()
          }

          // Store in localStorage
          const photos = JSON.parse(localStorage.getItem('haevn_photos') || '{}')
          if (!photos[partnershipId]) photos[partnershipId] = []
          photos[partnershipId].push(mockPhoto)
          localStorage.setItem('haevn_photos', JSON.stringify(photos))

          onPhotoUploaded(mockPhoto)
          setUploading(false)
          toast({
            title: 'Photo uploaded',
            description: 'Your photo has been added successfully'
          })
        }
        reader.readAsDataURL(file)
        return
      } else {
        // Production - get signed URL and upload
        const response = await fetch('/api/photos/upload', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            partnershipId,
            photoType,
            fileName: file.name
          })
        })

        if (!response.ok) {
          throw new Error('Failed to get upload URL')
        }

        const { url, photoId } = await response.json()

        // For development, skip actual upload and use the mock URL
        // In production, you would upload the file to the uploadUrl

        // Create photo metadata
        const newPhoto: PhotoMetadata = {
          id: photoId,
          partnership_id: partnershipId,
          photo_url: url,  // Use the mock URL from the API
          photo_type: photoType,
          width: null,
          height: null,
          nsfw_flag: false,
          order_index: currentPhotos.length,
          created_at: new Date().toISOString()
        }

        onPhotoUploaded(newPhoto)
        toast({
          title: 'Photo uploaded',
          description: 'Your photo has been added successfully'
        })
      }
    } catch (error) {
      console.error('Upload error:', error)
      toast({
        title: 'Upload failed',
        description: 'Please try again later',
        variant: 'destructive'
      })
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleDelete = async (photoId: string) => {
    setDeleting(photoId)
    try {
      // For development - remove from localStorage
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
        const photos = JSON.parse(localStorage.getItem('haevn_photos') || '{}')
        if (photos[partnershipId]) {
          photos[partnershipId] = photos[partnershipId].filter(
            (p: PhotoMetadata) => p.id !== photoId
          )
          localStorage.setItem('haevn_photos', JSON.stringify(photos))
        }
        onPhotoDeleted(photoId)
        toast({
          title: 'Photo deleted',
          description: 'Your photo has been removed'
        })
      } else {
        // Production - delete via API
        const response = await fetch(`/api/photos/${photoId}`, {
          method: 'DELETE'
        })

        if (!response.ok) {
          throw new Error('Failed to delete photo')
        }

        onPhotoDeleted(photoId)
        toast({
          title: 'Photo deleted',
          description: 'Your photo has been removed'
        })
      }
    } catch (error) {
      console.error('Delete error:', error)
      toast({
        title: 'Delete failed',
        description: 'Please try again later',
        variant: 'destructive'
      })
    } finally {
      setDeleting(null)
    }
  }

  const canUpload = currentPhotos.length < maxPhotos

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold capitalize">{photoType} Photos</h3>
          <p className="text-sm text-muted-foreground">
            {currentPhotos.length} / {maxPhotos} photos
          </p>
        </div>
        {canUpload && (
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            size="sm"
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Upload className="h-4 w-4 mr-2" />
            )}
            Upload Photo
          </Button>
        )}
      </div>

      {/* Photo Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {currentPhotos.map((photo) => (
          <Card key={photo.id} className="relative overflow-hidden">
            <CardContent className="p-0">
              <div className="aspect-square relative bg-muted">
                {photo.photo_url.startsWith('blob:') || photo.photo_url.startsWith('http') ? (
                  <img
                    src={photo.photo_url}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageIcon className="h-12 w-12 text-muted-foreground" />
                  </div>
                )}
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2 h-8 w-8"
                  onClick={() => handleDelete(photo.id)}
                  disabled={deleting === photo.id}
                >
                  {deleting === photo.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <X className="h-4 w-4" />
                  )}
                </Button>
                {photo.nsfw_flag && (
                  <Badge className="absolute bottom-2 left-2" variant="destructive">
                    NSFW
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        ))}

        {/* Add photo placeholder */}
        {canUpload && currentPhotos.length === 0 && (
          <Card
            className="border-dashed cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            <CardContent className="p-0">
              <div className="aspect-square flex flex-col items-center justify-center">
                <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-xs text-muted-foreground">Add Photo</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFileSelect}
        disabled={uploading || !canUpload}
      />

      {/* Requirements notice */}
      {photoType === 'public' && currentPhotos.length === 0 && (
        <p className="text-sm text-destructive">
          At least 1 public photo is required to make your profile live
        </p>
      )}
    </div>
  )
}