'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { ArrowLeft, Plus, X, Loader2 } from 'lucide-react'
import { useAuth } from '@/lib/auth/context'
import { usePartnerStats } from '@/hooks/usePartnerStats'
import { uploadPhoto } from '@/lib/services/photos'
import Image from 'next/image'

interface PhotoSlot {
  id: string
  file: File | null
  preview: string | null
}

export default function AddPhotosPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const { partnerData, hasPartnership, loading: statsLoading } = usePartnerStats()
  const { toast } = useToast()
  const [photoSlots, setPhotoSlots] = useState<PhotoSlot[]>(
    Array.from({ length: 6 }, (_, i) => ({ id: `slot-${i}`, file: null, preview: null }))
  )
  const [uploading, setUploading] = useState(false)
  const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({})

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login')
    }
  }, [user, authLoading, router])

  const handleAddPhoto = (slotId: string) => {
    fileInputRefs.current[slotId]?.click()
  }

  const handleFileChange = (slotId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Invalid File',
        description: 'Please select an image file',
        variant: 'destructive'
      })
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'File Too Large',
        description: 'Image must be smaller than 5MB',
        variant: 'destructive'
      })
      return
    }

    // Create preview
    const reader = new FileReader()
    reader.onloadend = () => {
      setPhotoSlots(prev => prev.map(slot =>
        slot.id === slotId
          ? { ...slot, file, preview: reader.result as string }
          : slot
      ))
    }
    reader.readAsDataURL(file)
  }

  const handleRemovePhoto = (slotId: string) => {
    setPhotoSlots(prev => prev.map(slot =>
      slot.id === slotId
        ? { ...slot, file: null, preview: null }
        : slot
    ))
    // Reset file input
    if (fileInputRefs.current[slotId]) {
      fileInputRefs.current[slotId]!.value = ''
    }
  }

  const handleContinue = async () => {
    const photosToUpload = photoSlots.filter(slot => slot.file !== null)

    if (photosToUpload.length < 2) {
      toast({
        title: 'Add More Photos',
        description: 'Please add at least 2 photos to continue',
        variant: 'destructive'
      })
      return
    }

    if (!partnerData?.partnershipId) {
      toast({
        title: 'No Partnership',
        description: 'You need to be in a partnership to upload photos',
        variant: 'destructive'
      })
      return
    }

    setUploading(true)

    try {
      // Upload all photos
      const uploadPromises = photosToUpload.map(slot =>
        uploadPhoto(partnerData.partnershipId, slot.file!, 'public')
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

        // Navigate back to profile
        router.push('/partner-profile')
      }
    } catch (error: any) {
      console.error('Upload error:', error)
      toast({
        title: 'Upload Failed',
        description: error.message || 'Failed to upload photos',
        variant: 'destructive'
      })
    } finally {
      setUploading(false)
    }
  }

  const uploadedCount = photoSlots.filter(slot => slot.file !== null).length

  if (authLoading || statsLoading) {
    return (
      <div className="min-h-screen bg-[#E8E6E3] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#008080]" />
      </div>
    )
  }

  if (!user || !hasPartnership) {
    return null
  }

  return (
    <div className="min-h-screen bg-[#E8E6E3]">
      <div className="max-w-md mx-auto bg-[#E8E6E3] min-h-screen pb-24">
        {/* Header */}
        <div className="px-6 pt-8 pb-6">
          <Button
            variant="ghost"
            onClick={() => router.back()}
            className="mb-6 -ml-2 text-[#252627] hover:text-[#008080]"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>

          <h1 className="text-h1 text-[#252627] mb-2" style={{ fontFamily: 'Roboto', fontWeight: 900 }}>
            Add photos
          </h1>
          <p className="text-body text-[#252627]/80" style={{ fontFamily: 'Roboto', fontWeight: 300 }}>
            Add at least 2 photos to continue
          </p>
        </div>

        {/* Photo Grid */}
        <div className="px-6">
          <div className="grid grid-cols-3 gap-3">
            {photoSlots.map((slot) => (
              <div key={slot.id} className="relative aspect-square">
                {slot.preview ? (
                  // Photo preview
                  <div className="relative w-full h-full rounded-lg overflow-hidden bg-[#252627]/10">
                    <Image
                      src={slot.preview}
                      alt="Photo preview"
                      fill
                      className="object-cover"
                    />
                    {/* Remove button */}
                    <button
                      onClick={() => handleRemovePhoto(slot.id)}
                      className="absolute top-2 right-2 w-6 h-6 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center"
                    >
                      <X className="h-4 w-4 text-white" />
                    </button>
                  </div>
                ) : (
                  // Empty slot
                  <button
                    onClick={() => handleAddPhoto(slot.id)}
                    className="w-full h-full rounded-lg bg-[#252627]/10 hover:bg-[#252627]/20 transition-colors flex items-center justify-center"
                  >
                    <div className="w-12 h-12 bg-gradient-to-br from-[#E29E0C] to-[#D88A0A] rounded-full flex items-center justify-center">
                      <Plus className="h-6 w-6 text-white" />
                    </div>
                  </button>
                )}

                {/* Hidden file input */}
                <input
                  ref={(el) => { fileInputRefs.current[slot.id] = el }}
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileChange(slot.id, e)}
                  className="hidden"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Continue Button */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#252627]/10 p-4">
          <div className="max-w-md mx-auto">
            <Button
              onClick={handleContinue}
              disabled={uploadedCount < 2 || uploading}
              className="w-full bg-gradient-to-r from-[#E29E0C] to-[#D88A0A] hover:from-[#D88A0A] hover:to-[#C77A09] text-white py-6 text-lg"
              style={{ fontFamily: 'Roboto', fontWeight: 500 }}
            >
              {uploading ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                `CONTINUE (${uploadedCount}/6)`
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
