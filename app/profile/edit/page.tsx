'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useSurveyGate, useCityGate } from '@/hooks/useGates'
import { useAuth } from '@/lib/auth/context'
import { useToast } from '@/hooks/use-toast'
import { ensureUserPartnership } from '@/lib/services/partnership'
import { getPartnershipPhotos } from '@/lib/services/photos'
import { createClient } from '@/lib/supabase/client'
import { setPrimaryPhoto } from '@/lib/services/photos'
import { AlertCircle, CheckCircle, ArrowLeft, Loader2, Upload, X, User } from 'lucide-react'
import FullPageLoader from '@/components/ui/full-page-loader'
import { HAEVNHeader } from '@/components/dashboard/HAEVNHeader'
import Image from 'next/image'

interface PhotoMetadata {
  id: string
  partnership_id: string
  photo_url: string
  photo_type: 'public' | 'private'
  is_primary: boolean
  order_index: number
  created_at: string
}

export default function ManagePhotosPage() {
  const router = useRouter()
  const surveyGate = useSurveyGate()
  const cityGate = useCityGate()
  const { user } = useAuth()
  const { toast } = useToast()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [partnershipId, setPartnershipId] = useState<string>('')
  const [profileState, setProfileState] = useState<'draft' | 'pending' | 'live'>('draft')
  const [photos, setPhotos] = useState<PhotoMetadata[]>([])

  useEffect(() => {
    async function loadData() {
      if (!user) {
        router.push('/auth/login')
        return
      }

      try {
        // Ensure user has a partnership
        const { partnership, error: partnershipError } = await ensureUserPartnership(user.id)

        if (partnershipError || !partnership) {
          throw new Error('Failed to load partnership')
        }

        setPartnershipId(partnership.id)

        // Load partnership profile state
        const { data: partnershipData } = await supabase
          .from('partnerships')
          .select('profile_state')
          .eq('id', partnership.id)
          .single()

        if (partnershipData) {
          setProfileState(partnershipData.profile_state || 'draft')
        }

        // Load photos
        const allPhotos = await getPartnershipPhotos(partnership.id)
        // Sort: primary first, then by order_index
        const sortedPhotos = allPhotos.sort((a, b) => {
          if (a.is_primary && !b.is_primary) return -1
          if (!a.is_primary && b.is_primary) return 1
          return a.order_index - b.order_index
        })
        setPhotos(sortedPhotos.filter(p => p.photo_type === 'public'))

      } catch (error) {
        console.error('Error loading data:', error)
        toast({
          title: 'Error loading photos',
          description: 'Please try again',
          variant: 'destructive'
        })
      } finally {
        setLoading(false)
      }
    }

    if (surveyGate.isValid && user) {
      loadData()
    }
  }, [surveyGate.isValid, user, router, toast, supabase])

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

    // Validate file type
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

      setPhotos([...photos, photoData])

      // Update profile state if this was first photo
      if (isPrimary) {
        await supabase
          .from('partnerships')
          .update({ profile_state: 'live' })
          .eq('id', partnershipId)
        setProfileState('live')
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
        await handleSetPrimary(remainingPhotos[0].id)
      } else if (remainingPhotos.length === 0) {
        // No photos left, set profile back to draft
        await supabase
          .from('partnerships')
          .update({ profile_state: 'draft' })
          .eq('id', partnershipId)
        setProfileState('draft')
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

  // Check gates
  if (!surveyGate.isValid || !cityGate.isValid) {
    return (
      <div className="min-h-screen p-8">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {!surveyGate.isValid
              ? 'Please complete your survey first'
              : 'Your city is not yet available'}
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  if (loading) {
    return <FullPageLoader />
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* HAEVN Header */}
      <HAEVNHeader />

      {/* Main Content */}
      <main className="max-w-md mx-auto px-4 py-4 space-y-4">
        {/* Page Header */}
        <div className="space-y-4">
          {/* Back + Title Row */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/dashboard')}
              className="p-2 -ml-2 rounded-full hover:bg-gray-100 active:bg-gray-200 transition-colors"
              aria-label="Back to dashboard"
            >
              <ArrowLeft className="h-5 w-5 text-gray-600" />
            </button>
            <div className="flex-1">
              <h1
                className="text-xl font-bold text-haevn-navy"
                style={{ fontFamily: 'Roboto, Helvetica, sans-serif' }}
              >
                Manage Photos
              </h1>
              <p
                className="text-sm text-gray-500"
                style={{ fontFamily: 'Roboto, Helvetica, sans-serif', fontWeight: 300 }}
              >
                Upload photos for your profile
              </p>
            </div>
          </div>
        </div>

        {/* Profile status alert */}
        {profileState === 'draft' && photos.length === 0 && (
          <Alert className="rounded-xl border-orange-200 bg-orange-50">
            <AlertCircle className="h-4 w-4 text-orange-600" />
            <AlertDescription
              className="text-orange-800"
              style={{ fontFamily: 'Roboto, Helvetica, sans-serif', fontWeight: 400 }}
            >
              Add at least 1 photo to make your profile live
            </AlertDescription>
          </Alert>
        )}

        {profileState === 'live' && (
          <Alert className="rounded-xl border-[#1B9A9A]/30 bg-[#1B9A9A]/10">
            <CheckCircle className="h-4 w-4 text-[#1B9A9A]" />
            <AlertDescription
              className="text-[#0F2A4A]"
              style={{ fontFamily: 'Roboto, Helvetica, sans-serif', fontWeight: 400 }}
            >
              Your profile is live and visible to people you connect with.
            </AlertDescription>
          </Alert>
        )}

        {/* Upload Section */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-4">
          <div>
            <h3 className="text-base font-semibold text-haevn-navy mb-1">Profile Photos</h3>
            <p className="text-sm text-gray-600">
              Upload up to 5 photos. Your avatar is shown on your profile card.
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
            <Button
              type="button"
              disabled={uploading || photos.length >= 5}
              className="w-full bg-[#1B9A9A] hover:bg-[#178787] text-white rounded-full h-12"
              onClick={() => document.getElementById('photo-upload')?.click()}
            >
              {uploading ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Uploading...</>
              ) : (
                <><Upload className="h-4 w-4 mr-2" /> Upload Photo</>
              )}
            </Button>
            <p className="text-xs text-gray-500 mt-2 text-center">
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
      </main>
    </div>
  )
}
