'use client'

import { useState } from 'react'
import { Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { lookupPartnershipByEmail, lookupPartnershipById } from '@/lib/actions/adminMatching'
import type { PartnershipData, ComputedMatchData } from './MatchingControlCenter'

interface PartnershipLookupProps {
  onSelect: (partnership: PartnershipData, matches: ComputedMatchData[]) => void
  onError: (message: string) => void
  onClear: () => void
  loading: boolean
  setLoading: (loading: boolean) => void
}

export function PartnershipLookup({
  onSelect,
  onError,
  onClear,
  loading,
  setLoading,
}: PartnershipLookupProps) {
  const [input, setInput] = useState('')

  const handleLookup = async () => {
    const value = input.trim()
    if (!value) return

    setLoading(true)

    try {
      // Determine if input is email or UUID
      const isEmail = value.includes('@')
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)

      let result
      if (isEmail) {
        result = await lookupPartnershipByEmail(value)
      } else if (isUUID) {
        result = await lookupPartnershipById(value)
      } else {
        onError('Invalid input. Enter an email address or partnership UUID.')
        setLoading(false)
        return
      }

      if (result.error) {
        onError(result.error)
      } else if (result.partnership) {
        onSelect(result.partnership, result.matches)
      } else {
        onError('No partnership found')
      }
    } catch (err: any) {
      onError(err.message || 'Lookup failed')
    } finally {
      setLoading(false)
    }
  }

  const handleClear = () => {
    setInput('')
    onClear()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !loading) {
      handleLookup()
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            placeholder="Email address or Partnership ID"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="pr-8"
            disabled={loading}
          />
          {input && (
            <button
              onClick={handleClear}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Button
          onClick={handleLookup}
          disabled={loading || !input.trim()}
          className="bg-purple-600 hover:bg-purple-700"
        >
          {loading ? (
            <span className="animate-pulse">Loading...</span>
          ) : (
            <>
              <Search className="h-4 w-4 mr-2" />
              Lookup
            </>
          )}
        </Button>
      </div>
      <p className="text-xs text-gray-500">
        Enter a user email to find their partnership, or a partnership UUID for direct lookup.
      </p>
    </div>
  )
}
