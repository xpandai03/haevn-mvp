'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Mail, Calendar, Users, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/lib/auth/context'
import { Loader2 } from 'lucide-react'
import { HAEVNHeader } from '@/components/dashboard/HAEVNHeader'

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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-haevn-teal" />
      </div>
    )
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
          <CardContent>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-haevn-teal/10 rounded-lg">
                  <Users className="h-4 w-4 text-haevn-teal" />
                </div>
                <div>
                  <p className="text-sm text-gray-900 font-medium">Your Connection Profile</p>
                  <p className="text-xs text-gray-500">Photos, bio, and what connections see</p>
                </div>
              </div>
              <Button
                size="sm"
                className="bg-haevn-teal hover:bg-haevn-teal/90 text-white rounded-full px-4"
                onClick={() => router.push('/profile/edit')}
              >
                Edit
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
      </main>
    </div>
  )
}
