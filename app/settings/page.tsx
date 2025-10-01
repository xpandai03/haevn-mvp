'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ArrowLeft, User, FileText, Image } from 'lucide-react'
import { ProfileTab } from '@/components/settings/ProfileTab'
import { SurveyTab } from '@/components/settings/SurveyTab'
import { PhotosTab } from '@/components/settings/PhotosTab'

export default function SettingsPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-haevn-gray-50 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8 pt-8">
          <div className="flex items-center gap-4 mb-6">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/dashboard')}
              className="text-haevn-gray-700 hover:text-haevn-teal-600"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </div>

          <div className="flex items-center gap-6">
            <img
              src="/images/haevn-logo-transparent.png"
              alt="HAEVN"
              className="h-16 w-auto"
            />
            <div>
              <h1 className="text-h1 text-haevn-gray-900">Settings</h1>
              <p className="text-body text-haevn-gray-700 mt-2">
                Manage your profile, survey responses, and photos
              </p>
            </div>
          </div>
        </div>

        {/* Settings Tabs */}
        <Card className="bg-white border-2 border-haevn-gray-300 rounded-2xl">
          <Tabs defaultValue="profile" className="w-full">
            <CardHeader>
              <TabsList className="grid w-full grid-cols-3 bg-haevn-gray-100">
                <TabsTrigger
                  value="profile"
                  className="data-[state=active]:bg-haevn-teal-500 data-[state=active]:text-white"
                >
                  <User className="h-4 w-4 mr-2" />
                  Profile
                </TabsTrigger>
                <TabsTrigger
                  value="survey"
                  className="data-[state=active]:bg-haevn-teal-500 data-[state=active]:text-white"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Survey
                </TabsTrigger>
                <TabsTrigger
                  value="photos"
                  className="data-[state=active]:bg-haevn-teal-500 data-[state=active]:text-white"
                >
                  <Image className="h-4 w-4 mr-2" />
                  Photos
                </TabsTrigger>
              </TabsList>
            </CardHeader>

            <CardContent className="p-6">
              <TabsContent value="profile" className="mt-0">
                <ProfileTab />
              </TabsContent>

              <TabsContent value="survey" className="mt-0">
                <SurveyTab />
              </TabsContent>

              <TabsContent value="photos" className="mt-0">
                <PhotosTab />
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>
      </div>
    </div>
  )
}
