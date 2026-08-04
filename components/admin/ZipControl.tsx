'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { Loader2, Trash2, Upload, Plus } from 'lucide-react'

interface ZipEntry {
  zip_code: string
  msa_name: string | null
  city: string | null
  county: string | null
  created_at: string
}

export function ZipControl() {
  const { toast } = useToast()
  const [zips, setZips] = useState<ZipEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [newZip, setNewZip] = useState('')
  const [newMsa, setNewMsa] = useState('')
  const [newCity, setNewCity] = useState('')
  const [adding, setAdding] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [removingZip, setRemovingZip] = useState<string | null>(null)

  const fetchZips = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/zips')
      const data = await res.json()
      if (data.zips) setZips(data.zips)
    } catch {
      toast({ title: 'Error', description: 'Failed to load ZIP codes', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { fetchZips() }, [fetchZips])

  const handleAddZip = async () => {
    const zip = newZip.trim()
    if (!/^\d{5}$/.test(zip)) {
      toast({ title: 'Invalid', description: 'ZIP must be 5 digits', variant: 'destructive' })
      return
    }

    setAdding(true)
    try {
      const res = await fetch('/api/admin/zips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          zip_code: zip,
          msa_name: newMsa.trim() || undefined, // omit → server defaults to 'Manual'
          city: newCity.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setNewZip('')
        setNewMsa('')
        setNewCity('')
        await fetchZips()
        toast({ title: 'Added', description: `ZIP ${zip}${data.msa_name ? ` → ${data.msa_name}` : ''}` })
      } else {
        // Duplicates return a clear 409 message here (not a silent success / 500).
        toast({ title: 'Could not add ZIP', description: data.error || 'Please try again.', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to add ZIP', variant: 'destructive' })
    } finally {
      setAdding(false)
    }
  }

  const handleRemoveZip = async (zip: string) => {
    setRemovingZip(zip)
    try {
      const res = await fetch('/api/admin/zips', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zip_code: zip }),
      })
      if (res.ok) {
        await fetchZips()
        toast({ title: 'Removed', description: `ZIP ${zip} removed` })
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to remove ZIP', variant: 'destructive' })
    } finally {
      setRemovingZip(null)
    }
  }

  const handleCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      const text = await file.text()
      const res = await fetch('/api/admin/zips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv: text }),
      })
      const data = await res.json()
      if (res.ok) {
        await fetchZips()
        toast({ title: 'Uploaded', description: `${data.added} ZIP codes added` })
      } else {
        toast({ title: 'Error', description: data.error, variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to upload CSV', variant: 'destructive' })
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  if (loading) {
    return (
      <Card className="border-purple-200">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-purple-600" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-purple-200">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg text-purple-900">
          ZIP Code Control ({zips.length} allowed)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add single ZIP — with its MSA (so it maps to a real market, not 'Manual') */}
        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="5-digit ZIP"
            value={newZip}
            onChange={(e) => setNewZip(e.target.value.replace(/\D/g, '').slice(0, 5))}
            onKeyDown={(e) => e.key === 'Enter' && handleAddZip()}
            className="max-w-[120px]"
          />
          <Input
            placeholder="MSA name (e.g. Tampa)"
            value={newMsa}
            onChange={(e) => setNewMsa(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddZip()}
            className="max-w-[200px]"
          />
          <Input
            placeholder="City (optional)"
            value={newCity}
            onChange={(e) => setNewCity(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddZip()}
            className="max-w-[160px]"
          />
          <Button onClick={handleAddZip} disabled={adding} variant="outline" size="sm">
            {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            <span className="ml-1">Add</span>
          </Button>

          {/* CSV upload */}
          <label>
            <input type="file" accept=".csv,.txt" onChange={handleCsvUpload} className="hidden" />
            <Button asChild variant="outline" size="sm" disabled={uploading}>
              <span>
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                <span className="ml-1">Upload CSV</span>
              </span>
            </Button>
          </label>
        </div>

        <p className="text-xs text-gray-500">
          Single add: enter a ZIP and its MSA (leave MSA blank for &ldquo;Manual&rdquo;). CSV: one ZIP
          per line or comma-separated (5-digit codes only). Duplicates are reported, not silently dropped.
        </p>

        {/* ZIP list */}
        {zips.length === 0 ? (
          <p className="text-sm text-gray-500 py-4 text-center">No allowed ZIP codes yet</p>
        ) : (
          <div className="max-h-64 overflow-y-auto border rounded-lg divide-y">
            {zips.map((z) => (
              <div key={z.zip_code} className="flex items-center justify-between px-3 py-2 text-sm hover:bg-gray-50">
                <div>
                  <span className="font-mono font-medium">{z.zip_code}</span>
                  {z.msa_name && <span className="text-gray-600 ml-2">{z.msa_name}</span>}
                  {z.city && <span className="text-gray-500 ml-2">{z.city}</span>}
                  {z.county && <span className="text-gray-400 ml-1">({z.county})</span>}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveZip(z.zip_code)}
                  disabled={removingZip === z.zip_code}
                  className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                >
                  {removingZip === z.zip_code ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Trash2 className="h-3 w-3" />
                  )}
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
