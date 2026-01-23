'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Loader2, X } from 'lucide-react'
import { getMyPartnershipProfile, type PartnershipProfileData } from '@/lib/actions/partnership-simple'
import { useToast } from '@/hooks/use-toast'
import { ProfileContent } from '@/components/profiles/ProfileContent'

interface ProfilePreviewModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ProfilePreviewModal({
  open,
  onOpenChange
}: ProfilePreviewModalProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<PartnershipProfileData | null>(null)

  useEffect(() => {
    if (open) {
      loadProfile()
    }
  }, [open])

  async function loadProfile() {
    setLoading(true)
    try {
      const { data, error } = await getMyPartnershipProfile()

      if (error || !data) {
        toast({
          title: 'Error',
          description: error || 'Failed to load profile',
          variant: 'destructive'
        })
        return
      }

      setProfile(data)
    } catch (error) {
      console.error('Error loading profile:', error)
      toast({
        title: 'Error',
        description: 'Failed to load profile preview',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md mx-auto p-0 max-h-[90vh] overflow-hidden rounded-2xl">
        {/* Header */}
        <div className="bg-haevn-teal px-4 py-3 flex items-center justify-between">
          <span className="text-white font-medium text-sm">Your Match Profile</span>
          <button
            onClick={() => onOpenChange(false)}
            className="text-white hover:opacity-80"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Preview notice */}
        <div className="bg-blue-50 border-b border-blue-100 px-4 py-2">
          <p className="text-xs text-blue-700 text-center">
            This is how your profile appears to connections
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-haevn-teal" />
          </div>
        ) : !profile ? (
          <div className="text-center py-16 px-4">
            <p className="text-gray-600">Unable to load profile preview</p>
          </div>
        ) : (
          <div className="max-h-[calc(90vh-100px)] overflow-y-auto">
            <ProfileContent profile={profile} isOwnProfile={true} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
