'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Mail, Calendar, Users, Shield, Wrench, Camera, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/lib/auth/context'
import { HAEVNHeader } from '@/components/dashboard/HAEVNHeader'
import FullPageLoader from '@/components/ui/full-page-loader'
import { checkAdminAccess } from '@/lib/actions/adminAccess'
import { PhotoManagerModal } from '@/components/dashboard/PhotoManagerModal'
import { ProfilePreviewModal } from '@/components/dashboard/ProfilePreviewModal'
import { getCurrentPartnershipId } from '@/lib/actions/partnership-simple'

export default function AccountDetailsPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [accountData, setAccountData] = useState({
    email: '',
    createdAt: '',
    userId: ''
  })
  const [isAdmin, setIsAdmin] = useState(false)
  const [photoModalOpen, setPhotoModalOpen] = useState(false)
  const [previewModalOpen, setPreviewModalOpen] = useState(false)
  const [partnershipId, setPartnershipId] = useState<string | null>(null)

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/login')
    } else if (user) {
      setAccountData({
        email: user.email || '',
        createdAt: user.created_at ? new Date(user.created_at).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        }) : '',
        userId: user.id
      })

      // Check admin access (server-side check)
      checkAdminAccess().then(setIsAdmin)

      // Fetch partnership ID for photo modal
      getCurrentPartnershipId().then(({ id }) => {
        if (id) setPartnershipId(id)
      })
    }
  }, [user, loading, router])

  if (loading || !user) {
    return <FullPageLoader />
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <HAEVNHeader />

      <main className="max-w-md mx-auto px-4 py-4 space-y-4">
        {/* Page Header */}
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
              Account Details
            </h1>
            <p
              className="text-sm text-gray-500"
              style={{ fontFamily: 'Roboto, Helvetica, sans-serif', fontWeight: 300 }}
            >
              Manage your account information
            </p>
          </div>
        </div>

        {/* Account Information */}
        <Card className="rounded-2xl border-gray-100 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-haevn-navy">Profile Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Email */}
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
              <div className="p-2 bg-haevn-teal/10 rounded-lg">
                <Mail className="h-4 w-4 text-haevn-teal" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Email</p>
                <p className="text-sm text-gray-900 truncate">{accountData.email}</p>
              </div>
            </div>

            {/* Account Created */}
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Calendar className="h-4 w-4 text-orange-600" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Member Since</p>
                <p className="text-sm text-gray-900">{accountData.createdAt}</p>
              </div>
            </div>

            {/* User ID */}
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
              <div className="p-2 bg-haevn-navy/10 rounded-lg">
                <Shield className="h-4 w-4 text-haevn-navy" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-500 uppercase tracking-wide">User ID</p>
                <p className="text-xs text-gray-600 font-mono truncate">{accountData.userId}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Match Profile Card */}
        <Card className="rounded-2xl border-gray-100 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-haevn-navy">Match Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* View Profile */}
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-haevn-teal/10 rounded-lg">
                  <Eye className="h-4 w-4 text-haevn-teal" />
                </div>
                <div>
                  <p className="text-sm text-gray-900 font-medium">View Match Profile</p>
                  <p className="text-xs text-gray-500">See how connections view you</p>
                </div>
              </div>
              <Button
                size="sm"
                className="bg-haevn-teal hover:bg-haevn-teal/90 text-white rounded-full px-4"
                onClick={() => setPreviewModalOpen(true)}
              >
                View
              </Button>
            </div>

            {/* Manage Photos */}
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <Camera className="h-4 w-4 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-900 font-medium">Profile Photos</p>
                  <p className="text-xs text-gray-500">Upload and manage your photos</p>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="rounded-full px-4 border-gray-300"
                onClick={() => setPhotoModalOpen(true)}
              >
                Photos
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Security Section */}
        <Card className="rounded-2xl border-gray-100 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-haevn-navy">Security</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-200 rounded-lg">
                  <Shield className="h-4 w-4 text-gray-500" />
                </div>
                <div>
                  <p className="text-sm text-gray-900 font-medium">Password</p>
                  <p className="text-xs text-gray-500">Last updated: Recently</p>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="rounded-full px-4 text-gray-400 border-gray-200"
                disabled
              >
                Change
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Coming Soon Notice */}
        <div className="rounded-xl bg-haevn-teal/5 border border-haevn-teal/20 p-4">
          <div className="flex items-start gap-3">
            <div className="p-1.5 bg-haevn-teal/10 rounded-lg">
              <Users className="h-4 w-4 text-haevn-teal" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900 mb-0.5">More Features Coming Soon</p>
              <p className="text-xs text-gray-600">
                Password changes, email updates, and account deletion.
              </p>
            </div>
          </div>
        </div>

        {/* Internal Tools - Only visible for admin users */}
        {isAdmin && (
          <Card className="rounded-2xl border-purple-200 bg-purple-50/50 shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base text-purple-900">Internal Tools</CardTitle>
                <span className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-purple-200 text-purple-800 rounded-full">
                  Admin
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <div
                className="flex items-center justify-between p-3 bg-white rounded-xl cursor-pointer hover:bg-purple-50 transition-colors"
                onClick={() => router.push('/admin/matching')}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <Wrench className="h-4 w-4 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-900 font-medium">Matching Engine</p>
                    <p className="text-xs text-gray-500">Debug matches, scores, and social state</p>
                  </div>
                </div>
                <Button
                  size="sm"
                  className="bg-purple-600 hover:bg-purple-700 text-white rounded-full px-4"
                >
                  Open
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </main>

      {/* Photo Manager Modal */}
      <PhotoManagerModal
        open={photoModalOpen}
        onOpenChange={setPhotoModalOpen}
        partnershipId={partnershipId || undefined}
      />

      {/* Profile Preview Modal */}
      <ProfilePreviewModal
        open={previewModalOpen}
        onOpenChange={setPreviewModalOpen}
      />
    </div>
  )
}
