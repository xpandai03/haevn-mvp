'use client'

import { useState, useRef, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Upload, X, Image as ImageIcon, Loader2, Lock, Users, AlertCircle } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface PhotoMetadata {
  id: string
  partnership_id: string
  photo_url: string
  photo_type: 'public' | 'private'
  width?: number | null
  height?: number | null
  nsfw_flag?: boolean | null
  order_index: number
  created_at: string
}

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
  const [previewUrls, setPreviewUrls] = useState<{ [key: string]: string }>({})

  // Create preview URLs for better UX
  useEffect(() => {
    const urls: { [key: string]: string } = {}
    currentPhotos.forEach(photo => {
      urls[photo.id] = photo.photo_url
    })
    setPreviewUrls(urls)

    // Cleanup function to revoke object URLs if any
    return () => {
      Object.values(urls).forEach(url => {
        if (url.startsWith('blob:')) {
          URL.revokeObjectURL(url)
        }
      })
    }
  }, [currentPhotos])

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    const file = files[0]

    // Check if max photos reached
    if (currentPhotos.length >= maxPhotos) {
      toast({
        title: 'Maximum photos reached',
        description: `You can only upload ${maxPhotos} ${photoType} photos`,
        variant: 'destructive'
      })
      return
    }

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
        description: 'Please select an image under 5MB',
        variant: 'destructive'
      })
      return
    }

    setUploading(true)

    try {
      // Upload to Supabase via API route
      const formData = new FormData()
      formData.append('file', file)
      formData.append('partnershipId', partnershipId)
      formData.append('photoType', photoType)

      const response = await fetch('/api/photos/upload', {
        method: 'POST',
        body: formData
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Upload failed')
      }

      onPhotoUploaded(data.photo)

      toast({
        title: 'Photo uploaded',
        description: 'Your photo has been uploaded successfully'
      })
    } catch (error) {
      console.error('Upload error:', error)
      toast({
        title: 'Upload failed',
        description: error instanceof Error ? error.message : 'Failed to upload photo',
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
    if (deleting) return
    setDeleting(photoId)

    try {
      const response = await fetch(`/api/photos/upload?photoId=${photoId}&partnershipId=${partnershipId}`, {
        method: 'DELETE'
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Delete failed')
      }

      onPhotoDeleted(photoId)

      toast({
        title: 'Photo deleted',
        description: 'Your photo has been removed'
      })
    } catch (error) {
      console.error('Delete error:', error)
      toast({
        title: 'Delete failed',
        description: error instanceof Error ? error.message : 'Failed to delete photo',
        variant: 'destructive'
      })
    } finally {
      setDeleting(null)
    }
  }

  const canUpload = currentPhotos.length < maxPhotos

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="flex items-center gap-2">
              {photoType === 'public' ? (
                <>
                  <Users className="h-4 w-4" />
                  Profile Photos
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4" />
                  Private Photos
                </>
              )}
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {photoType === 'public'
                ? 'Visible to people you connect with'
                : 'Only visible after you grant access'}
            </p>
          </div>
          <Badge variant="outline">
            {currentPhotos.length}/{maxPhotos}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Info alert for private photos */}
          {photoType === 'private' && currentPhotos.length === 0 && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Private photos are only shown to matches after you grant access.
                This helps maintain your privacy and control.
              </AlertDescription>
            </Alert>
          )}

          {/* Photo grid */}
          <div className={`grid gap-4 ${currentPhotos.length === 0 ? 'grid-cols-1 place-items-center' : 'grid-cols-2 sm:grid-cols-3'}`}>
            {currentPhotos.map((photo) => (
              <div
                key={photo.id}
                className="relative aspect-square rounded-lg overflow-hidden bg-secondary group"
              >
                {previewUrls[photo.id] ? (
                  <img
                    src={previewUrls[photo.id]}
                    alt=""
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      // Fallback if image fails to load
                      e.currentTarget.style.display = 'none'
                      e.currentTarget.nextElementSibling?.classList.remove('hidden')
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageIcon className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}
                {/* Fallback icon (initially hidden) */}
                <div className="hidden w-full h-full absolute inset-0 flex items-center justify-center bg-secondary">
                  <ImageIcon className="h-8 w-8 text-muted-foreground" />
                </div>
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity" />
                <Button
                  size="icon"
                  variant="destructive"
                  className="absolute top-2 right-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => handleDelete(photo.id)}
                  disabled={deleting === photo.id}
                >
                  {deleting === photo.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <X className="h-4 w-4" />
                  )}
                </Button>
                {photo.order_index === 0 && (
                  <Badge className="absolute top-2 left-2 opacity-90">
                    Main
                  </Badge>
                )}
              </div>
            ))}

            {/* Add photo button */}
            {canUpload && (
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className={`aspect-square rounded-lg border-2 border-dashed border-muted-foreground/25 flex flex-col items-center justify-center hover:border-muted-foreground/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${currentPhotos.length === 0 ? 'w-32 h-32' : ''}`}
              >
                {uploading ? (
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                ) : (
                  <>
                    <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                    <span className="text-xs text-muted-foreground">Add Photo</span>
                  </>
                )}
              </button>
            )}
          </div>

          {/* Upload button for empty state */}
          {currentPhotos.length === 0 && canUpload && (
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="w-full"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Your First Photo
                </>
              )}
            </Button>
          )}

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={handleFileSelect}
            disabled={uploading || !canUpload}
          />

          {/* Requirements notice */}
          {photoType === 'public' && currentPhotos.length === 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                At least 1 profile photo is required to make your profile live
              </AlertDescription>
            </Alert>
          )}
        </div>
      </CardContent>
    </Card>
  )
}