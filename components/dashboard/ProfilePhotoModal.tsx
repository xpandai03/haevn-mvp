'use client'

import { useState, useRef } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Loader2, Camera, Upload } from 'lucide-react'
import { uploadProfilePhoto } from '@/lib/actions/uploadProfilePhoto'
import { SilhouetteAvatar } from './SilhouetteAvatar'

interface ProfilePhotoModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentPhotoUrl?: string | null
  onPhotoUpdated: (newUrl: string) => void
}

// Permissive for mobile (iOS HEIC support)
const MAX_SIZE = 10 * 1024 * 1024 // 10MB

export function ProfilePhotoModal({
  open,
  onOpenChange,
  currentPhotoUrl,
  onPhotoUpdated
}: ProfilePhotoModalProps) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setError(null)

    // Validate file type - permissive for mobile (iOS HEIC, etc.)
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file.')
      return
    }

    // Validate file size
    if (file.size > MAX_SIZE) {
      setError('File too large. Maximum size is 10MB.')
      return
    }

    // Show preview
    const reader = new FileReader()
    reader.onload = (e) => {
      setPreviewUrl(e.target?.result as string)
    }
    reader.readAsDataURL(file)

    // Upload the file
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const result = await uploadProfilePhoto(formData)

      if (result.success && result.photoUrl) {
        onPhotoUpdated(result.photoUrl)
        onOpenChange(false)
        setPreviewUrl(null)
      } else {
        setError(result.error || 'Upload failed')
        setPreviewUrl(null)
      }
    } catch (err) {
      console.error('Upload error:', err)
      setError('Failed to upload photo. Please try again.')
      setPreviewUrl(null)
    } finally {
      setUploading(false)
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleButtonClick = () => {
    fileInputRef.current?.click()
  }

  const handleClose = () => {
    if (!uploading) {
      setError(null)
      setPreviewUrl(null)
      onOpenChange(false)
    }
  }

  const displayUrl = previewUrl || currentPhotoUrl

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-sm mx-auto">
        <DialogHeader>
          <DialogTitle className="text-center">Profile Photo</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center py-4">
          {/* Photo Display */}
          <div className="relative mb-6">
            {displayUrl ? (
              <div className="w-40 h-40 rounded-full overflow-hidden border-4 border-gray-100 shadow-lg">
                <img
                  src={displayUrl}
                  alt="Profile"
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div className="w-40 h-40 rounded-full overflow-hidden border-4 border-gray-100 shadow-lg bg-gray-100">
                <SilhouetteAvatar />
              </div>
            )}

            {/* Upload overlay when uploading */}
            {uploading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
                <Loader2 className="h-8 w-8 text-white animate-spin" />
              </div>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <p className="text-sm text-red-500 mb-4 text-center">{error}</p>
          )}

          {/* Hidden File Input - use image/* for iOS compatibility */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />

          {/* Upload Button */}
          <Button
            onClick={handleButtonClick}
            disabled={uploading}
            className="w-full max-w-xs bg-[#1B9A9A] hover:bg-[#178787] text-white"
          >
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Uploading...
              </>
            ) : currentPhotoUrl ? (
              <>
                <Camera className="h-4 w-4 mr-2" />
                Change Profile Photo
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Add Profile Photo
              </>
            )}
          </Button>

          {/* File type hint */}
          <p className="text-xs text-gray-400 mt-3 text-center">
            Supported: JPG, PNG, WebP, HEIC (max 10MB)
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
