'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2, RefreshCw, CheckCircle2, AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react'
import { getAdminSummaryInput } from '@/lib/actions/adminMatching'
import type { PartnershipData } from './MatchingControlCenter'

interface AISummaryDebugProps {
  partnership: PartnershipData
}

interface RegenerateResult {
  old: { connection_summary: string | null; haevn_insight: string | null }
  new: { connection_summary: string; haevn_insight: string; used_fallback: boolean; fields_populated: number }
  generated_at: string
}

export function AISummaryDebug({ partnership }: AISummaryDebugProps) {
  const [summaryInput, setSummaryInput] = useState<Record<string, any> | null>(null)
  const [fieldsPopulated, setFieldsPopulated] = useState(0)
  const [inputLoading, setInputLoading] = useState(false)
  const [inputError, setInputError] = useState<string | null>(null)
  const [showInputDetail, setShowInputDetail] = useState(true)

  const [regenerating, setRegenerating] = useState(false)
  const [regenResult, setRegenResult] = useState<RegenerateResult | null>(null)
  const [regenError, setRegenError] = useState<string | null>(null)

  useEffect(() => {
    loadSummaryInput()
  }, [partnership.id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadSummaryInput() {
    setInputLoading(true)
    setInputError(null)
    try {
      const result = await getAdminSummaryInput(partnership.id)
      if (result.error) {
        setInputError(result.error)
      } else {
        setSummaryInput(result.summaryInput as any)
        setFieldsPopulated(result.fieldsPopulated)
      }
    } catch (err: any) {
      setInputError(err.message || 'Failed to load summary input')
    } finally {
      setInputLoading(false)
    }
  }

  async function handleRegenerate() {
    if (!confirm('This will regenerate the AI summaries for this partnership. The old summaries will be overwritten. Continue?')) {
      return
    }

    setRegenerating(true)
    setRegenError(null)
    setRegenResult(null)

    try {
      const response = await fetch('/api/admin/regenerate-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ partnershipId: partnership.id }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        setRegenError(data.error || 'Regeneration failed')
      } else {
        setRegenResult(data)
      }
    } catch (err: any) {
      setRegenError(err.message || 'Network error')
    } finally {
      setRegenerating(false)
    }
  }

  const hasSummaries = !!partnership.connection_summary || !!partnership.haevn_insight
  const isFallback = !partnership.summaries_generated_at && hasSummaries

  return (
    <div className="space-y-4">
      {/* Summary Input Section */}
      <Card className="border-blue-200">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setShowInputDetail(!showInputDetail)}
              className="flex items-center gap-2"
            >
              {showInputDetail ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              <CardTitle className="text-sm text-blue-900">
                Summary Input (Mapping Layer)
              </CardTitle>
            </button>
            <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
              {fieldsPopulated} fields populated
            </span>
          </div>
        </CardHeader>
        {showInputDetail && (
          <CardContent>
            {inputLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                <span className="ml-2 text-sm text-gray-500">Building SummaryInput...</span>
              </div>
            ) : inputError ? (
              <div className="py-3 text-sm text-red-600">{inputError}</div>
            ) : summaryInput ? (
              <div className="space-y-1.5">
                {Object.entries(summaryInput).map(([key, value]) => {
                  if (value === undefined || value === null) return null
                  const displayValue = Array.isArray(value) ? value.join(', ') : String(value)
                  return (
                    <div key={key} className="flex items-start gap-3 text-sm">
                      <span className="font-mono text-gray-500 w-44 shrink-0 text-right">{key}</span>
                      <span className="text-gray-900">{displayValue}</span>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="py-3 text-sm text-gray-500">No summary input available</div>
            )}
          </CardContent>
        )}
      </Card>

      {/* Current AI Output */}
      <Card className="border-purple-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-purple-900">Current AI Output</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Connection Summary */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-medium text-gray-700">Connection Summary</span>
              {partnership.connection_summary ? (
                <CheckCircle2 className="h-3 w-3 text-green-500" />
              ) : (
                <AlertTriangle className="h-3 w-3 text-amber-500" />
              )}
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-800 leading-relaxed">
              {partnership.connection_summary || <span className="italic text-gray-400">Not generated</span>}
            </div>
          </div>

          {/* HAEVN Insight */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-medium text-gray-700">HAEVN Insight</span>
              {partnership.haevn_insight ? (
                <CheckCircle2 className="h-3 w-3 text-green-500" />
              ) : (
                <AlertTriangle className="h-3 w-3 text-amber-500" />
              )}
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-800 leading-relaxed">
              {partnership.haevn_insight || <span className="italic text-gray-400">Not generated</span>}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Metadata */}
      <Card className="border-gray-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-gray-700">Metadata</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <div>
              <span className="text-gray-500">Generated At</span>
              <p className="font-medium">
                {partnership.summaries_generated_at
                  ? new Date(partnership.summaries_generated_at).toLocaleString()
                  : 'Never'}
              </p>
            </div>
            <div>
              <span className="text-gray-500">Version</span>
              <p className="font-medium">{partnership.summaries_version || 'N/A'}</p>
            </div>
            <div>
              <span className="text-gray-500">Type</span>
              <p className="font-medium">
                {!hasSummaries ? (
                  <span className="text-gray-400">None</span>
                ) : isFallback ? (
                  <span className="text-amber-600">Likely Fallback</span>
                ) : (
                  <span className="text-green-700">AI Generated</span>
                )}
              </p>
            </div>
            <div>
              <span className="text-gray-500">Input Fields</span>
              <p className="font-medium">{fieldsPopulated} populated</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Regenerate Controls */}
      <Card className="border-orange-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-orange-900">Regeneration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            onClick={handleRegenerate}
            disabled={regenerating}
            variant="outline"
            className="w-full border-orange-300 hover:bg-orange-50"
          >
            {regenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Regenerating...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Regenerate Summary
              </>
            )}
          </Button>
          <p className="text-xs text-gray-500">
            Re-runs the full pipeline: answers → normalize → buildSummaryInput → Claude → DB update.
            Old summaries will be overwritten.
          </p>

          {regenError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
              {regenError}
            </div>
          )}

          {regenResult && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-2 text-sm font-medium text-green-700">
                <CheckCircle2 className="h-4 w-4" />
                Regenerated at {new Date(regenResult.generated_at).toLocaleString()}
                {regenResult.new.used_fallback && (
                  <span className="text-amber-600 text-xs">(fallback used)</span>
                )}
              </div>

              {/* Comparison: Connection Summary */}
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-600">
                  Connection Summary — Before vs After
                </div>
                <div className="grid grid-cols-2 divide-x">
                  <div className="p-3">
                    <p className="text-xs text-gray-500 mb-1">Before</p>
                    <p className="text-xs text-gray-700 leading-relaxed">
                      {regenResult.old.connection_summary || <span className="italic text-gray-400">None</span>}
                    </p>
                  </div>
                  <div className="p-3">
                    <p className="text-xs text-gray-500 mb-1">After</p>
                    <p className="text-xs text-gray-700 leading-relaxed">
                      {regenResult.new.connection_summary}
                    </p>
                  </div>
                </div>
              </div>

              {/* Comparison: HAEVN Insight */}
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-600">
                  HAEVN Insight — Before vs After
                </div>
                <div className="grid grid-cols-2 divide-x">
                  <div className="p-3">
                    <p className="text-xs text-gray-500 mb-1">Before</p>
                    <p className="text-xs text-gray-700 leading-relaxed">
                      {regenResult.old.haevn_insight || <span className="italic text-gray-400">None</span>}
                    </p>
                  </div>
                  <div className="p-3">
                    <p className="text-xs text-gray-500 mb-1">After</p>
                    <p className="text-xs text-gray-700 leading-relaxed">
                      {regenResult.new.haevn_insight}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
