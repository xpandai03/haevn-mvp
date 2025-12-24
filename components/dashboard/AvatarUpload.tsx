'use client'

import { useRef, useState } from 'react'
import { Camera } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { SilhouetteAvatar } from './SilhouetteAvatar'

interface AvatarUploadProps {
  photoUrl?: string | null
  displayName: string
  onUpload?: (file: File) => Promise<void>
  onClick?: () => void // Opens modal instead of file picker
  size?: 'sm' | 'md' | 'lg'
  editable?: boolean
}

const sizeClasses = {
  sm: 'h-12 w-12',
  md: 'h-20 w-20',
  lg: 'h-24 w-24'
}

const iconSizes = {
  sm: 'h-3 w-3',
  md: 'h-4 w-4',
  lg: 'h-5 w-5'
}

const badgeSizes = {
  sm: 'h-6 w-6 -bottom-0.5 -right-0.5',
  md: 'h-7 w-7 -bottom-0.5 -right-0.5',
  lg: 'h-8 w-8 -bottom-1 -right-1'
}

export function AvatarUpload({
  photoUrl,
  displayName,
  onUpload,
  onClick,
  size = 'lg',
  editable = true
}: AvatarUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)

  const handleClick = () => {
    // If onClick prop is provided, use it (opens modal)
    if (onClick) {
      onClick()
      return
    }
    // Otherwise, use default file input behavior
    if (editable && fileInputRef.current) {
      fileInputRef.current.click()
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !onUpload) return

    // Validate file type - permissive for mobile (iOS HEIC, etc.)
    if (!file.type.startsWith('image/')) {
      alert('Please select a valid image file')
      return
    }

    // Validate file size (max 10MB for iOS compatibility)
    const maxSize = 10 * 1024 * 1024
    if (file.size > maxSize) {
      alert('Image must be less than 10MB')
      return
    }

    setIsUploading(true)
    try {
      await onUpload(file)
    } catch (error) {
      console.error('Upload failed:', error)
      alert('Failed to upload image. Please try again.')
    } finally {
      setIsUploading(false)
      // Reset input so same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={handleClick}
        disabled={!editable || isUploading}
        className={`relative rounded-full focus:outline-none focus:ring-2 focus:ring-[#1B9A9A] focus:ring-offset-2 ${
          editable ? 'cursor-pointer' : 'cursor-default'
        } ${isUploading ? 'opacity-50' : ''}`}
        aria-label={editable ? 'Upload profile photo' : 'Profile photo'}
      >
        <Avatar className={`${sizeClasses[size]} border-4 border-white shadow-lg`}>
          {photoUrl ? (
            <AvatarImage src={photoUrl} alt={displayName} />
          ) : null}
          <AvatarFallback className="bg-transparent p-0">
            <SilhouetteAvatar className="w-full h-full" />
          </AvatarFallback>
        </Avatar>

        {/* Camera Badge - Only show if editable */}
        {editable && (
          <div
            className={`absolute ${badgeSizes[size]} bg-[#1B9A9A] rounded-full flex items-center justify-center shadow-md`}
          >
            <Camera className={`${iconSizes[size]} text-white`} />
          </div>
        )}
      </button>

      {/* Hidden File Input - use image/* for iOS compatibility */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
        aria-hidden="true"
      />
    </div>
  )
}
