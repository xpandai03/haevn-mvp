'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/lib/auth/context'
import { useToast } from '@/hooks/use-toast'
import { createClient } from '@/lib/supabase/client'
import { HaevnLoader } from '@/components/ui/haevn-loader'

export function ProfileTab() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    display_name: '',
    phone: ''
  })

  useEffect(() => {
    async function loadProfile() {
      if (!user) return

      const supabase = createClient()

      // Get profile data
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', user.id)
        .single()

      // Get partnership data via API route (server-side)
      const partnershipResponse = await fetch('/api/partnerships/my-partnership', {
        credentials: 'include'
      })

      if (partnershipResponse.ok) {
        const { partnership: myPartnership } = await partnershipResponse.json()

        if (myPartnership) {
          const { data: partnership } = await supabase
            .from('partnerships')
            .select('display_name, phone')
            .eq('id', myPartnership.partnershipId)
            .single()

          console.log('[CLIENT] Partnership loaded:', partnership?.display_name)

          setFormData({
            full_name: profile?.full_name || '',
            email: user.email || '',
            display_name: partnership?.display_name || '',
            phone: partnership?.phone || ''
          })
        } else {
          setFormData({
            full_name: profile?.full_name || '',
            email: user.email || '',
            display_name: '',
            phone: ''
          })
        }
      }

      setLoading(false)
    }

    loadProfile()
  }, [user])

  const handleSave = async () => {
    if (!user) return

    setSaving(true)
    const supabase = createClient()

    try {
      // Update profile
      await supabase
        .from('profiles')
        .update({ full_name: formData.full_name })
        .eq('user_id', user.id)

      // Update partnership display name via API route
      const partnershipResponse = await fetch('/api/partnerships/my-partnership', {
        credentials: 'include'
      })

      if (!partnershipResponse.ok) {
        toast({
          title: 'Error',
          description: 'Failed to load partnership data',
          variant: 'destructive'
        })
        setSaving(false)
        return
      }

      const { partnership: myPartnership } = await partnershipResponse.json()

      if (myPartnership) {
        const updates: Record<string, string> = {}
        if (formData.display_name) updates.display_name = formData.display_name
        if (formData.phone !== undefined) updates.phone = formData.phone || null as any

        if (Object.keys(updates).length > 0) {
          console.log('[CLIENT] Updating partnership:', Object.keys(updates))
          await supabase
            .from('partnerships')
            .update(updates)
            .eq('id', myPartnership.partnershipId)
        }
      }

      toast({
        title: 'Profile Updated',
        description: 'Your profile has been updated successfully.',
      })
    } catch (error) {
      console.error('Error saving profile:', error)
      toast({
        title: 'Error',
        description: 'Failed to update profile. Please try again.',
        variant: 'destructive'
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <HaevnLoader size={60} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-h3 text-haevn-gray-900 mb-4">Profile Information</h3>
        <p className="text-body-sm text-haevn-gray-600 mb-6">
          Update your personal information and how you appear to matches.
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="full_name" className="text-haevn-gray-900">Full Name</Label>
          <Input
            id="full_name"
            value={formData.full_name}
            onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
            placeholder="Enter your full name"
            className="border-haevn-gray-300"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email" className="text-haevn-gray-900">Email</Label>
          <Input
            id="email"
            type="email"
            value={formData.email}
            disabled
            className="border-haevn-gray-300 bg-haevn-gray-100 cursor-not-allowed"
          />
          <p className="text-caption text-haevn-gray-600">
            Email cannot be changed. Contact support if needed.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="display_name" className="text-haevn-gray-900">Display Name</Label>
          <Input
            id="display_name"
            value={formData.display_name}
            onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
            placeholder="How you appear to matches"
            className="border-haevn-gray-300"
          />
          <p className="text-caption text-haevn-gray-600">
            This is the name shown on your match profile.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone" className="text-haevn-gray-900">Phone Number</Label>
          <Input
            id="phone"
            type="tel"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            placeholder="+1 (555) 123-4567"
            className="border-haevn-gray-300"
          />
          <p className="text-caption text-haevn-gray-600">
            Used for match and message notifications via text.
          </p>
        </div>
      </div>

      <div className="flex justify-end pt-4">
        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-haevn-teal-500 hover:bg-haevn-teal-600 text-white"
        >
          {saving && <HaevnLoader size={18} className="mr-2" />}
          Save Changes
        </Button>
      </div>
    </div>
  )
}
