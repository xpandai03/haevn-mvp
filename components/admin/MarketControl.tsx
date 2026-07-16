'use client'

/**
 * Market live/not-live control — the switch that launches a city.
 *
 * Lives alongside ZIP/MSA settings because a market IS the MSA the zips define.
 * Toggling is_live gates match RELEASE + NOTIFY for every member in that market
 * on the next cycle. Never affects computation or scoring.
 */

import { useState, useEffect, useCallback } from 'react'
import { HaevnLoader } from '@/components/ui/haevn-loader'
import { useToast } from '@/hooks/use-toast'
import { Globe, AlertTriangle } from 'lucide-react'

interface Market {
  market_name: string
  is_live: boolean
  notes: string | null
  liveMemberCount: number
}

export function MarketControl() {
  const [markets, setMarkets] = useState<Market[]>([])
  const [unresolved, setUnresolved] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState<string | null>(null)
  const { toast } = useToast()

  const fetchMarkets = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/markets')
      const data = await res.json()
      if (!res.ok) { setError(data.hint || data.error || 'Failed to load markets'); return }
      setMarkets(data.markets || [])
      setUnresolved(data.unresolvedLiveMembers || 0)
      setError(null)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchMarkets() }, [fetchMarkets])

  const toggle = async (m: Market) => {
    const next = !m.is_live
    if (next && !confirm(`Launch "${m.market_name}"?\n\n${m.liveMemberCount} live member(s) become eligible for match release + notification on the next cycle.`)) return
    setSaving(m.market_name)
    try {
      const res = await fetch('/api/admin/markets', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ market_name: m.market_name, is_live: next }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Update failed')
      toast({
        title: next ? 'Market is now LIVE' : 'Market paused',
        description: `${m.market_name} — ${next ? 'members can be released & notified' : 'release & notify stopped'}.`,
      })
      fetchMarkets()
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setSaving(null)
    }
  }

  if (loading) return <div className="py-6 text-center"><HaevnLoader size={28} /></div>

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Globe className="h-4 w-4 text-gray-500" />
        <h3 className="text-sm font-semibold text-gray-800">Market Release Status</h3>
      </div>
      <p className="text-xs text-gray-500">
        Only <strong>live</strong> markets are released &amp; notified. Members in non-live markets are
        still computed — they are simply never surfaced or emailed until you launch the market.
      </p>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      <div className="space-y-1.5">
        {markets.map((m) => (
          <div
            key={m.market_name}
            className={`flex items-center justify-between rounded-lg border px-3 py-2.5 text-xs ${
              m.is_live ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'
            }`}
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className={`inline-block h-2 w-2 rounded-full ${m.is_live ? 'bg-green-500' : 'bg-gray-400'}`} />
                <span className="font-medium text-gray-800 truncate">{m.market_name}</span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  m.is_live ? 'bg-green-200 text-green-900' : 'bg-gray-200 text-gray-600'
                }`}>
                  {m.is_live ? 'LIVE' : 'NOT LIVE'}
                </span>
              </div>
              <p className="mt-0.5 ml-4 text-gray-400">{m.liveMemberCount} live member(s)</p>
            </div>
            <button
              onClick={() => toggle(m)}
              disabled={saving === m.market_name}
              className={`shrink-0 rounded-md px-3 py-1.5 text-xs font-medium transition ${
                m.is_live
                  ? 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                  : 'bg-[#008080] text-white hover:bg-[#006868]'
              } disabled:opacity-50`}
            >
              {saving === m.market_name ? '…' : m.is_live ? 'Pause' : 'Set live'}
            </button>
          </div>
        ))}
        {markets.length === 0 && !error && (
          <p className="py-3 text-center text-xs text-gray-400">No markets defined yet.</p>
        )}
      </div>

      {unresolved > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
          <p className="text-[11px] leading-relaxed text-amber-800">
            <strong>{unresolved} live member(s)</strong> have a city that maps to no market — they are
            <strong> excluded from release</strong> (fail closed). Add their city to an MSA zip list above
            to bring them into a market.
          </p>
        </div>
      )}
    </div>
  )
}
