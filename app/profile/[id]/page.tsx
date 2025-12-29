'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Switch } from '@/components/ui/switch'
import { PhotoGrid } from '@/components/PhotoGrid'
import { useToast } from '@/hooks/use-toast'
import { getPartnershipProfile, updatePhotoGrant } from '@/lib/db/profiles'
import { computeCompatibilityScore, getCompatibilityBucket } from '@/lib/matching/stub'
import type { ProfileViewData } from '@/lib/types/profile'
import {
  Loader2, MapPin, Heart, Shield, Flag, Lock, Unlock,
  CheckCircle, User, Users, AlertCircle, Camera
} from 'lucide-react'

export default function ProfileViewPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [profileData, setProfileData] = useState<ProfileViewData | null>(null)
  const [grantingAccess, setGrantingAccess] = useState(false)
  const [privatePhotoGrant, setPrivatePhotoGrant] = useState(false)
  const [viewerId, setViewerId] = useState<string>('')
  const [isOwner, setIsOwner] = useState(false)

  const profileId = params.id as string

  useEffect(() => {
    async function loadProfile() {
      try {
        // Get current viewer ID
        const userData = localStorage.getItem('haevn_user')
        let vid = ''

        if (userData) {
          const user = JSON.parse(userData)
          vid = `partnership-${user.email}`
          setViewerId(vid)
          setIsOwner(vid === profileId)
        }

        // Load profile with visibility checks
        const data = await getPartnershipProfile(profileId, vid)

        if (!data) {
          toast({
            title: 'Profile not found',
            description: 'This profile does not exist or is not visible',
            variant: 'destructive'
          })
          router.push('/discovery')
          return
        }

        setProfileData(data)
        setPrivatePhotoGrant(data.visibility.privatePhotoGrant || false)

        // Calculate compatibility if viewer has survey data
        if (vid && !isOwner) {
          const viewerResponses = localStorage.getItem('haevn_survey_responses')
          const profiles = JSON.parse(localStorage.getItem('haevn_profiles') || '{}')
          const targetProfile = profiles[profileId]

          if (viewerResponses && targetProfile?.survey_responses) {
            const score = computeCompatibilityScore(
              JSON.parse(viewerResponses),
              targetProfile.survey_responses
            )
            const bucket = getCompatibilityBucket(score)

            setProfileData(prev => prev ? {
              ...prev,
              compatibility: { score, bucket }
            } : null)
          }
        }

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

    loadProfile()
  }, [profileId, router, toast, isOwner])

  const handleGrantToggle = async (granted: boolean) => {
    if (!profileData?.visibility.handshakeId) return

    setGrantingAccess(true)
    try {
      const result = await updatePhotoGrant(
        profileData.visibility.handshakeId,
        granted
      )

      if (result.success) {
        setPrivatePhotoGrant(granted)
        toast({
          title: granted ? 'Access granted' : 'Access revoked',
          description: granted
            ? 'Private photos are now visible to this partnership'
            : 'Private photo access has been removed'
        })

        // Reload profile to update photo visibility
        const data = await getPartnershipProfile(profileId, viewerId)
        if (data) setProfileData(data)
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      toast({
        title: 'Failed to update access',
        description: 'Please try again',
        variant: 'destructive'
      })
    } finally {
      setGrantingAccess(false)
    }
  }

  const handleLike = () => {
    // This would integrate with the like system
    router.push('/connections')
  }

  const handleBlock = () => {
    toast({
      title: 'Partnership blocked',
      description: 'You will no longer see this profile'
    })
    router.push('/discovery')
  }

  const handleReport = () => {
    toast({
      title: 'Report submitted',
      description: 'Our team will review this profile'
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!profileData) {
    return (
      <div className="min-h-screen p-8">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Profile Not Found</AlertTitle>
          <AlertDescription>
            This profile does not exist or is not visible to you.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  // Guard: Draft profiles are not visible to non-owners
  if (profileData.profile.profile_state !== 'live' && !isOwner) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Profile Not Available</h2>
            <p className="text-muted-foreground">
              This profile is not yet public.
            </p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => router.push('/discovery')}
            >
              Back to Discovery
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const { profile, photos, visibility, compatibility } = profileData
  const publicPhotos = photos.filter(p => p.photo_type === 'public')
  const privatePhotos = photos.filter(p => p.photo_type === 'private')

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-start">
              <div className="space-y-2">
                <CardTitle className="text-2xl">
                  {profile.display_name || 'Anonymous Partnership'}
                </CardTitle>
                <CardDescription className="flex items-center gap-4">
                  {profile.city && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-4 w-4" />
                      {profile.city}
                    </span>
                  )}
                  {profile.structure?.type && (
                    <span className="flex items-center gap-1">
                      {profile.structure.type === 'single' ? (
                        <User className="h-4 w-4" />
                      ) : (
                        <Users className="h-4 w-4" />
                      )}
                      {profile.structure.type}
                    </span>
                  )}
                </CardDescription>
              </div>

              {/* Compatibility score */}
              {compatibility && !isOwner && (
                <div className="text-right">
                  <div className="text-2xl font-bold">{compatibility.score}%</div>
                  <Badge
                    variant={
                      compatibility.bucket === 'High' ? 'default' :
                      compatibility.bucket === 'Medium' ? 'secondary' : 'outline'
                    }
                  >
                    {compatibility.bucket} Match
                  </Badge>
                </div>
              )}
            </div>

            {/* Badges */}
            {profile.badges && profile.badges.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-4">
                {profile.badges.map(badge => (
                  <Badge key={badge} variant="outline">
                    {badge === 'Verified' && <CheckCircle className="h-3 w-3 mr-1" />}
                    {badge}
                  </Badge>
                ))}
              </div>
            )}
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Short bio (always visible) */}
            {profile.short_bio && (
              <div>
                <h3 className="font-semibold mb-1">About</h3>
                <p className="text-sm text-muted-foreground">{profile.short_bio}</p>
              </div>
            )}

            {/* Action buttons for non-owners */}
            {!isOwner && (
              <div className="flex gap-2">
                <Button onClick={handleLike} className="flex-1">
                  <Heart className="h-4 w-4 mr-2" />
                  Like
                </Button>
                <Button variant="outline" onClick={handleBlock}>
                  <Shield className="h-4 w-4 mr-2" />
                  Block
                </Button>
                <Button variant="outline" onClick={handleReport}>
                  <Flag className="h-4 w-4" />
                </Button>
              </div>
            )}

            {/* Edit button for owners */}
            {isOwner && (
              <Button onClick={() => router.push('/profile/edit')} className="w-full">
                Edit Profile
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Content Tabs */}
        <Tabs defaultValue="photos" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="photos">
              <Camera className="h-4 w-4 mr-2" />
              Photos
            </TabsTrigger>
            <TabsTrigger value="details" disabled={!visibility.canViewGated}>
              Details {!visibility.canViewGated && <Lock className="h-3 w-3 ml-1" />}
            </TabsTrigger>
            <TabsTrigger value="private" disabled={!visibility.hasHandshake}>
              Private {!visibility.hasHandshake && <Lock className="h-3 w-3 ml-1" />}
            </TabsTrigger>
          </TabsList>

          {/* Photos Tab */}
          <TabsContent value="photos">
            <PhotoGrid
              photos={publicPhotos}
              locked={!visibility.canViewGated}
              lockMessage="Photos unlock after a handshake"
            />
          </TabsContent>

          {/* Details Tab (Gated) */}
          <TabsContent value="details" className="space-y-4">
            {visibility.canViewGated ? (
              <>
                {profile.long_bio && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Extended Bio</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm">{profile.long_bio}</p>
                    </CardContent>
                  </Card>
                )}

                {profile.intentions && profile.intentions.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Looking For</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2">
                        {profile.intentions.map(intention => (
                          <Badge key={intention}>{intention}</Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {profile.lifestyle_tags && profile.lifestyle_tags.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Lifestyle</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2">
                        {profile.lifestyle_tags.map(tag => (
                          <Badge key={tag} variant="secondary">{tag}</Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {profile.discretion_summary && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Privacy & Discretion</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm">{profile.discretion_summary}</p>
                    </CardContent>
                  </Card>
                )}
              </>
            ) : (
              <Alert>
                <Lock className="h-4 w-4" />
                <AlertTitle>Handshake Required</AlertTitle>
                <AlertDescription>
                  These details are visible after you match with this partnership
                </AlertDescription>
              </Alert>
            )}
          </TabsContent>

          {/* Private Tab */}
          <TabsContent value="private" className="space-y-4">
            {visibility.hasHandshake ? (
              <>
                {/* Grant control for profile owner */}
                {isOwner && visibility.handshakeId && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Private Photo Access</CardTitle>
                      <CardDescription>
                        Control who can see your private photos
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {privatePhotoGrant ? (
                            <Unlock className="h-4 w-4 text-green-600" />
                          ) : (
                            <Lock className="h-4 w-4 text-muted-foreground" />
                          )}
                          <span className="text-sm">
                            {privatePhotoGrant ? 'Access granted' : 'Access restricted'}
                          </span>
                        </div>
                        <Switch
                          checked={privatePhotoGrant}
                          onCheckedChange={handleGrantToggle}
                          disabled={grantingAccess}
                        />
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Private photos grid */}
                {visibility.canViewPrivate ? (
                  <PhotoGrid photos={privatePhotos} />
                ) : (
                  <Alert>
                    <Lock className="h-4 w-4" />
                    <AlertTitle>Private Photos</AlertTitle>
                    <AlertDescription>
                      {isOwner
                        ? 'Your private photos are shown here'
                        : 'Request access to view private photos'}
                    </AlertDescription>
                    {!isOwner && (
                      <Button
                        className="mt-4"
                        variant="outline"
                        onClick={() => toast({
                          title: 'Access requested',
                          description: 'The partnership will be notified'
                        })}
                      >
                        Request Access
                      </Button>
                    )}
                  </Alert>
                )}
              </>
            ) : (
              <Alert>
                <Lock className="h-4 w-4" />
                <AlertTitle>Handshake Required</AlertTitle>
                <AlertDescription>
                  Private content is available after you match with this partnership
                </AlertDescription>
              </Alert>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}