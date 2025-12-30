'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { PhotoUpload } from '@/components/PhotoUpload'
import { useSurveyGate, useCityGate } from '@/hooks/useGates'
import { useAuth } from '@/lib/auth/context'
import { useProfile } from '@/hooks/useProfile'
import { useToast } from '@/hooks/use-toast'
import { ensureUserPartnership } from '@/lib/services/partnership'
import { getPartnershipPhotos } from '@/lib/services/photos'
import { createClient } from '@/lib/supabase/client'
import { Save, AlertCircle, Loader2, CheckCircle, ArrowLeft } from 'lucide-react'
import { HAEVNHeader } from '@/components/dashboard/HAEVNHeader'

// Lifestyle tag options
const LIFESTYLE_OPTIONS = [
  'Active', 'Homebody', 'Social', 'Introverted', 'Adventurous',
  'Professional', 'Creative', 'Outdoorsy', 'Foodie', 'Night Owl',
  'Early Bird', 'Fitness', 'Travel', 'Music', 'Arts', 'Gaming'
]

// Intention options
const INTENTION_OPTIONS = [
  'Long-term relationship', 'Dating', 'Friendship',
  'Casual', 'Marriage', 'Open relationship', 'Polyamory',
  'Exploring', 'Not sure yet'
]

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

interface ProfileFormData {
  display_name: string
  short_bio: string
  long_bio: string
  orientation: {
    value: string
    seeking: string[]
  }
  structure: {
    type: string
    open_to: string[]
  }
  intentions: string[]
  lifestyle_tags: string[]
  discretion_summary: string
}

export default function ProfileEditPage() {
  const router = useRouter()
  const surveyGate = useSurveyGate()
  const cityGate = useCityGate()
  const { user } = useAuth()
  const { profile } = useProfile()
  const { toast } = useToast()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [partnershipId, setPartnershipId] = useState<string>('')
  const [profileState, setProfileState] = useState<'draft' | 'pending' | 'live'>('draft')

  // Form data
  const [formData, setFormData] = useState<ProfileFormData>({
    display_name: '',
    short_bio: '',
    long_bio: '',
    orientation: {
      value: '',
      seeking: []
    },
    structure: {
      type: 'single',
      open_to: []
    },
    intentions: [],
    lifestyle_tags: [],
    discretion_summary: ''
  })

  // Photos
  const [publicPhotos, setPublicPhotos] = useState<PhotoMetadata[]>([])
  const [privatePhotos, setPrivatePhotos] = useState<PhotoMetadata[]>([])

  useEffect(() => {
    async function loadProfile() {
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

        // Load partnership profile data
        const { data: partnershipData } = await supabase
          .from('partnerships')
          .select('*')
          .eq('id', partnership.id)
          .single()

        if (partnershipData) {
          setFormData({
            display_name: partnershipData.display_name || '',
            short_bio: partnershipData.short_bio || '',
            long_bio: partnershipData.long_bio || '',
            orientation: partnershipData.orientation || { value: '', seeking: [] },
            structure: partnershipData.structure || { type: 'single', open_to: [] },
            intentions: partnershipData.intentions || [],
            lifestyle_tags: partnershipData.lifestyle_tags || [],
            discretion_summary: partnershipData.discretion_summary || ''
          })
          setProfileState(partnershipData.profile_state || 'draft')
        }

        // Load photos from database
        const photos = await getPartnershipPhotos(partnership.id)
        setPublicPhotos(photos.filter(p => p.photo_type === 'public'))
        setPrivatePhotos(photos.filter(p => p.photo_type === 'private'))

      } catch (error) {
        console.error('Error loading profile:', error)
        toast({
          title: 'Error loading profile',
          description: 'Please try again',
          variant: 'destructive'
        })
      } finally {
        setLoading(false)
      }
    }

    if (surveyGate.isValid && user) {
      loadProfile()
    }
  }, [surveyGate.isValid, user, router, toast, supabase])

  const handleSave = async () => {
    // Validation
    if (!formData.display_name) {
      toast({
        title: 'Display name required',
        description: 'Please enter a display name for your partnership',
        variant: 'destructive'
      })
      return
    }

    // Check if can go live
    const canGoLive = publicPhotos.length > 0
    const newState = canGoLive && profileState === 'draft' ? 'live' : profileState

    setSaving(true)
    try {
      // Save to database
      const { data, error } = await supabase
        .from('partnerships')
        .update({
          ...formData,
          profile_state: newState
        })
        .eq('id', partnershipId)
        .select()
        .single()

      if (error) throw error

      setProfileState(newState)

      toast({
        title: 'Profile saved',
        description: newState === 'live' ? 'Your profile is now live!' : 'Your changes have been saved'
      })
    } catch (error) {
      console.error('Save error:', error)
      toast({
        title: 'Save failed',
        description: 'Please try again',
        variant: 'destructive'
      })
    } finally {
      setSaving(false)
    }
  }

  const toggleLifestyleTag = (tag: string) => {
    setFormData(prev => ({
      ...prev,
      lifestyle_tags: prev.lifestyle_tags.includes(tag)
        ? prev.lifestyle_tags.filter(t => t !== tag)
        : [...prev.lifestyle_tags, tag]
    }))
  }

  const toggleIntention = (intention: string) => {
    setFormData(prev => ({
      ...prev,
      intentions: prev.intentions.includes(intention)
        ? prev.intentions.filter(i => i !== intention)
        : [...prev.intentions, intention]
    }))
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
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
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
                Edit Profile
              </h1>
              <p
                className="text-sm text-gray-500"
                style={{ fontFamily: 'Roboto, Helvetica, sans-serif', fontWeight: 300 }}
              >
                Create your partnership profile
              </p>
            </div>
            {/* Status Badge */}
            <Badge
              className={`rounded-full text-xs px-3 py-1 font-semibold ${
                profileState === 'live'
                  ? 'bg-[#1B9A9A] text-white'
                  : 'bg-gray-200 text-gray-600'
              }`}
            >
              {profileState.toUpperCase()}
            </Badge>
          </div>

          {/* Save Button - Full Width */}
          <Button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-haevn-teal hover:opacity-90 text-white rounded-full h-12"
            style={{ fontFamily: 'Roboto, Helvetica, sans-serif', fontWeight: 500 }}
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </div>

        {/* Profile status alert */}
        {profileState === 'draft' && publicPhotos.length === 0 && (
          <Alert className="rounded-xl border-orange-200 bg-orange-50">
            <AlertCircle className="h-4 w-4 text-orange-600" />
            <AlertDescription
              className="text-orange-800"
              style={{ fontFamily: 'Roboto, Helvetica, sans-serif', fontWeight: 400 }}
            >
              Add at least 1 public photo to make your profile live
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
              Your profile is live and visible in discovery!
            </AlertDescription>
          </Alert>
        )}

        {/* Form Tabs */}
        <Tabs defaultValue="identity" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4 rounded-xl bg-gray-100 p-1">
            <TabsTrigger value="identity" className="rounded-lg text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm">Identity</TabsTrigger>
            <TabsTrigger value="bio" className="rounded-lg text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm">Bio</TabsTrigger>
            <TabsTrigger value="lifestyle" className="rounded-lg text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm">Lifestyle</TabsTrigger>
            <TabsTrigger value="photos" className="rounded-lg text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm">Photos</TabsTrigger>
          </TabsList>

          {/* Identity Tab */}
          <TabsContent value="identity" className="space-y-4">
            <Card className="rounded-2xl border-gray-100 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-haevn-navy">Basic Information</CardTitle>
                <CardDescription className="text-sm">How you'll appear to others</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="display_name">Display Name</Label>
                  <Input
                    id="display_name"
                    value={formData.display_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, display_name: e.target.value }))}
                    placeholder="Your partnership name"
                    maxLength={50}
                  />
                </div>

                <div>
                  <Label htmlFor="structure">Partnership Structure</Label>
                  <Select
                    value={formData.structure.type}
                    onValueChange={(value) => setFormData(prev => ({
                      ...prev,
                      structure: { ...prev.structure, type: value }
                    }))}
                  >
                    <SelectTrigger id="structure">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="single">Single</SelectItem>
                      <SelectItem value="couple">Couple</SelectItem>
                      <SelectItem value="throuple">Throuple</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Intentions</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {INTENTION_OPTIONS.map(intention => (
                      <Badge
                        key={intention}
                        variant={formData.intentions.includes(intention) ? 'default' : 'outline'}
                        className="cursor-pointer"
                        onClick={() => toggleIntention(intention)}
                      >
                        {intention}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Bio Tab */}
          <TabsContent value="bio" className="space-y-4">
            <Card className="rounded-2xl border-gray-100 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-haevn-navy">About You</CardTitle>
                <CardDescription className="text-sm">Tell others about your partnership</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="short_bio">Short Bio (Public)</Label>
                  <Textarea
                    id="short_bio"
                    value={formData.short_bio}
                    onChange={(e) => setFormData(prev => ({ ...prev, short_bio: e.target.value }))}
                    placeholder="A brief introduction (140 chars)"
                    maxLength={140}
                    rows={2}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {formData.short_bio.length}/140 characters
                  </p>
                </div>

                <div>
                  <Label htmlFor="long_bio">Long Bio (After Handshake)</Label>
                  <Textarea
                    id="long_bio"
                    value={formData.long_bio}
                    onChange={(e) => setFormData(prev => ({ ...prev, long_bio: e.target.value }))}
                    placeholder="More details about your partnership (500 chars)"
                    maxLength={500}
                    rows={4}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {formData.long_bio.length}/500 characters
                  </p>
                </div>

                <div>
                  <Label htmlFor="discretion">Discretion & Privacy</Label>
                  <Textarea
                    id="discretion"
                    value={formData.discretion_summary}
                    onChange={(e) => setFormData(prev => ({ ...prev, discretion_summary: e.target.value }))}
                    placeholder="Your approach to privacy and discretion"
                    rows={2}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Lifestyle Tab */}
          <TabsContent value="lifestyle" className="space-y-4">
            <Card className="rounded-2xl border-gray-100 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-haevn-navy">Lifestyle & Interests</CardTitle>
                <CardDescription className="text-sm">Help find compatible matches</CardDescription>
              </CardHeader>
              <CardContent>
                <Label>Lifestyle Tags</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {LIFESTYLE_OPTIONS.map(tag => (
                    <Badge
                      key={tag}
                      variant={formData.lifestyle_tags.includes(tag) ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() => toggleLifestyleTag(tag)}
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Photos Tab */}
          <TabsContent value="photos" className="space-y-6">
            <PhotoUpload
              partnershipId={partnershipId}
              photoType="public"
              maxPhotos={6}
              currentPhotos={publicPhotos}
              onPhotoUploaded={(photo) => setPublicPhotos(prev => [...prev, photo])}
              onPhotoDeleted={(photoId) => setPublicPhotos(prev => prev.filter(p => p.id !== photoId))}
            />

            <PhotoUpload
              partnershipId={partnershipId}
              photoType="private"
              maxPhotos={12}
              currentPhotos={privatePhotos}
              onPhotoUploaded={(photo) => setPrivatePhotos(prev => [...prev, photo])}
              onPhotoDeleted={(photoId) => setPrivatePhotos(prev => prev.filter(p => p.id !== photoId))}
            />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}