'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Mail, Calendar, Users, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/lib/auth/context'
import { Loader2 } from 'lucide-react'

export default function AccountDetailsPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [accountData, setAccountData] = useState({
    email: '',
    createdAt: '',
    userId: ''
  })

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
    }
  }, [user, loading, router])

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-[#E8E6E3] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#008080]" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#E8E6E3]">
      <div className="max-w-3xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => router.back()}
            className="mb-4 text-[#252627] hover:text-[#008080]"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Profile
          </Button>
          <h1 className="text-h1 text-[#252627] mb-2" style={{ fontFamily: 'Roboto', fontWeight: 900 }}>
            Account Details
          </h1>
          <p className="text-body text-[#252627]/80" style={{ fontFamily: 'Roboto', fontWeight: 300 }}>
            Manage your account information and settings
          </p>
        </div>

        {/* Account Information */}
        <Card className="mb-6 bg-white border-2 border-[#252627]/10 rounded-2xl">
          <CardHeader>
            <CardTitle className="text-h3 text-[#252627]" style={{ fontFamily: 'Roboto', fontWeight: 900 }}>
              Profile Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Email */}
            <div className="flex items-start gap-4 p-4 bg-[#E8E6E3] rounded-lg">
              <div className="p-2 bg-[#008080]/10 rounded-lg">
                <Mail className="h-5 w-5 text-[#008080]" />
              </div>
              <div className="flex-1">
                <p className="text-caption text-[#252627]/60 uppercase tracking-wide" style={{ fontFamily: 'Roboto', fontWeight: 500 }}>
                  Email Address
                </p>
                <p className="text-body text-[#252627] mt-1" style={{ fontFamily: 'Roboto', fontWeight: 300 }}>
                  {accountData.email}
                </p>
              </div>
            </div>

            {/* Account Created */}
            <div className="flex items-start gap-4 p-4 bg-[#E8E6E3] rounded-lg">
              <div className="p-2 bg-[#E29E0C]/10 rounded-lg">
                <Calendar className="h-5 w-5 text-[#E29E0C]" />
              </div>
              <div className="flex-1">
                <p className="text-caption text-[#252627]/60 uppercase tracking-wide" style={{ fontFamily: 'Roboto', fontWeight: 500 }}>
                  Member Since
                </p>
                <p className="text-body text-[#252627] mt-1" style={{ fontFamily: 'Roboto', fontWeight: 300 }}>
                  {accountData.createdAt}
                </p>
              </div>
            </div>

            {/* User ID */}
            <div className="flex items-start gap-4 p-4 bg-[#E8E6E3] rounded-lg">
              <div className="p-2 bg-[#1E2A4A]/10 rounded-lg">
                <Shield className="h-5 w-5 text-[#1E2A4A]" />
              </div>
              <div className="flex-1">
                <p className="text-caption text-[#252627]/60 uppercase tracking-wide" style={{ fontFamily: 'Roboto', fontWeight: 500 }}>
                  User ID
                </p>
                <p className="text-caption text-[#252627] mt-1 font-mono break-all" style={{ fontFamily: 'Monaco, monospace', fontWeight: 300 }}>
                  {accountData.userId}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Match Profile Card */}
        <Card className="mb-6 bg-white border-2 border-[#252627]/10 rounded-2xl">
          <CardHeader>
            <CardTitle className="text-h3 text-[#252627]" style={{ fontFamily: 'Roboto', fontWeight: 900 }}>
              Match Profile
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-4 bg-[#E8E6E3] rounded-lg">
              <div className="flex items-start gap-4">
                <div className="p-2 bg-[#008080]/10 rounded-lg">
                  <Users className="h-5 w-5 text-[#008080]" />
                </div>
                <div>
                  <p className="text-body text-[#252627]" style={{ fontFamily: 'Roboto', fontWeight: 500 }}>
                    Your Connection Profile
                  </p>
                  <p className="text-body-sm text-[#252627]/60 mt-1" style={{ fontFamily: 'Roboto', fontWeight: 300 }}>
                    Photos, bio, and what connections see
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                className="border-[#008080] text-[#008080] hover:bg-[#008080]/10"
                onClick={() => router.push('/profile/edit')}
              >
                Edit Profile
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Security Section */}
        <Card className="mb-6 bg-white border-2 border-[#252627]/10 rounded-2xl">
          <CardHeader>
            <CardTitle className="text-h3 text-[#252627]" style={{ fontFamily: 'Roboto', fontWeight: 900 }}>
              Security
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-[#E8E6E3] rounded-lg">
              <div>
                <p className="text-body text-[#252627]" style={{ fontFamily: 'Roboto', fontWeight: 500 }}>
                  Password
                </p>
                <p className="text-body-sm text-[#252627]/60 mt-1" style={{ fontFamily: 'Roboto', fontWeight: 300 }}>
                  Last updated: Recently
                </p>
              </div>
              <Button
                variant="outline"
                className="border-[#008080] text-[#008080] hover:bg-[#008080]/10"
                disabled
              >
                Change Password
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Coming Soon Notice */}
        <Card className="bg-[#008080]/5 border-2 border-[#008080]/20 rounded-2xl">
          <CardContent className="pt-6 pb-6">
            <div className="flex items-start gap-3">
              <Users className="h-5 w-5 text-[#008080] mt-0.5" />
              <div>
                <p className="text-body font-medium text-[#252627] mb-1" style={{ fontFamily: 'Roboto', fontWeight: 500 }}>
                  More Features Coming Soon
                </p>
                <p className="text-body-sm text-[#252627]/80" style={{ fontFamily: 'Roboto', fontWeight: 300 }}>
                  We're working on adding more account management features including password changes, email updates, and account deletion.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
