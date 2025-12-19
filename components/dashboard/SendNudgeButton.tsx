'use client'

import { useState } from 'react'
import { sendNudge } from '@/lib/actions/nudges'
import { ensureUserPartnership } from '@/lib/services/partnership'

export function SendNudgeButton() {
  const [recipientId, setRecipientId] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<{ success: boolean; error?: string } | null>(null)

  const handleSendNudge = async () => {
    if (!recipientId.trim()) {
      setResult({ success: false, error: 'Please enter a recipient user ID' })
      return
    }

    setIsLoading(true)
    setResult(null)

    try {
      // await ensureUserPartnership(recipientId.trim())
      const response = await sendNudge(recipientId.trim())
      setResult(response)
      if (response.success) {
        setRecipientId('')
      }
    } catch (error) {
      console.error('Error sending nudge:', error)
      setResult({ success: false, error: 'Failed to send nudge' })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-3">
      <h3 className="text-sm font-medium text-gray-900">Send Test Nudge</h3>

      <div className="flex gap-2">
        <input
          type="text"
          value={recipientId}
          onChange={(e) => setRecipientId(e.target.value)}
          placeholder="Enter recipient user ID"
          className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          disabled={isLoading}
        />
        <button
          onClick={handleSendNudge}
          disabled={isLoading}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? 'Sending...' : 'Send Nudge'}
        </button>
      </div>

      {result && (
        <div className={`text-sm ${result.success ? 'text-green-600' : 'text-red-600'}`}>
          {result.success ? '✓ Nudge sent successfully!' : `✗ ${result.error}`}
        </div>
      )}
    </div>
  )
}
