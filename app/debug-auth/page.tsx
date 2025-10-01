'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function DebugAuthPage() {
  const [authInfo, setAuthInfo] = useState<any>(null)
  const [partnershipMembers, setPartnershipMembers] = useState<any>(null)
  const [partnerships, setPartnerships] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function debug() {
      const supabase = createClient()

      // Get current user
      const { data: { user }, error: authError } = await supabase.auth.getUser()

      setAuthInfo({
        user: user ? {
          id: user.id,
          email: user.email,
          created_at: user.created_at,
        } : null,
        error: authError?.message
      })

      if (user) {
        // Try to get partnership_members
        const { data: members, error: membersError } = await supabase
          .from('partnership_members')
          .select('*')
          .eq('user_id', user.id)

        setPartnershipMembers({
          data: members,
          count: members?.length,
          error: membersError?.message,
          errorDetails: membersError
        })

        // Try to get partnerships owned by user
        const { data: owned, error: ownedError } = await supabase
          .from('partnerships')
          .select('*')
          .eq('owner_id', user.id)

        setPartnerships({
          data: owned,
          count: owned?.length,
          error: ownedError?.message
        })
      }

      setLoading(false)
    }

    debug()
  }, [])

  if (loading) {
    return <div className="p-8">Loading debug info...</div>
  }

  return (
    <div className="min-h-screen bg-haevn-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-h1 text-haevn-gray-900 mb-8">Auth Debug Page</h1>

        {/* Auth Info */}
        <div className="bg-white rounded-2xl p-6 border-2 border-haevn-gray-300 mb-6">
          <h2 className="text-h3 text-haevn-gray-900 mb-4">Authentication</h2>
          <pre className="text-caption bg-haevn-gray-100 p-4 rounded-lg overflow-auto">
            {JSON.stringify(authInfo, null, 2)}
          </pre>
        </div>

        {/* Partnership Members */}
        <div className="bg-white rounded-2xl p-6 border-2 border-haevn-gray-300 mb-6">
          <h2 className="text-h3 text-haevn-gray-900 mb-4">
            Partnership Members Query
          </h2>
          <pre className="text-caption bg-haevn-gray-100 p-4 rounded-lg overflow-auto">
            {JSON.stringify(partnershipMembers, null, 2)}
          </pre>
        </div>

        {/* Partnerships */}
        <div className="bg-white rounded-2xl p-6 border-2 border-haevn-gray-300 mb-6">
          <h2 className="text-h3 text-haevn-gray-900 mb-4">
            Partnerships Owned by User
          </h2>
          <pre className="text-caption bg-haevn-gray-100 p-4 rounded-lg overflow-auto">
            {JSON.stringify(partnerships, null, 2)}
          </pre>
        </div>

        {/* Action Buttons */}
        <div className="bg-white rounded-2xl p-6 border-2 border-haevn-gray-300">
          <h2 className="text-h3 text-haevn-gray-900 mb-4">Actions</h2>
          <div className="flex gap-4">
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-haevn-orange-500 hover:bg-haevn-orange-600 text-white rounded-full text-button transition-colors"
            >
              Refresh
            </button>
            <button
              onClick={() => window.location.href = '/dashboard'}
              className="px-6 py-3 bg-haevn-teal-500 hover:bg-haevn-teal-600 text-white rounded-full text-button transition-colors"
            >
              Go to Dashboard
            </button>
            <button
              onClick={() => window.location.href = '/test-matching'}
              className="px-6 py-3 border-2 border-haevn-orange-500 text-haevn-orange-600 hover:bg-haevn-orange-50 rounded-full text-button transition-colors"
            >
              Go to Test Matching
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
