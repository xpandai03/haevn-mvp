'use client'

import { useCallback, useState } from 'react'
import {
  Upload,
  FileJson,
  CheckCircle,
  AlertCircle,
  Loader2,
} from 'lucide-react'

interface ImportResult {
  ok?: boolean
  error?: string
  dryRun?: boolean
  total?: number
  eligible?: number
  imported?: number
  skippedExisting?: number
  skippedIneligible?: number
  errors?: string[]
  markets?: Record<string, number>
  honeypotImported?: number
  matchesComputed?: number
}

function normalize(data: unknown): any[] {
  if (Array.isArray(data)) return data
  if (data && typeof data === 'object') {
    const o = data as Record<string, unknown>
    for (const k of ['users', 'submissions', 'records', 'data']) {
      if (Array.isArray(o[k])) return o[k] as any[]
    }
    return [data]
  }
  return []
}

export function ImportUsersClient() {
  const [file, setFile] = useState<File | null>(null)
  const [users, setUsers] = useState<any[] | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [computeMatches, setComputeMatches] = useState(false)

  const onFile = useCallback(async (f: File | null) => {
    setFile(f)
    setResult(null)
    setParseError(null)
    setUsers(null)
    if (!f) return
    try {
      const text = await f.text()
      const parsed = normalize(JSON.parse(text))
      if (parsed.length === 0) throw new Error('No records found in file')
      setUsers(parsed)
    } catch (e: any) {
      setParseError(e?.message || 'Could not parse JSON')
    }
  }, [])

  const run = async (dryRun: boolean) => {
    if (!users) return
    setBusy(true)
    setResult(null)
    try {
      const res = await fetch('/api/admin/import-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ users, dryRun, computeMatches }),
      })
      setResult(await res.json())
    } catch (e: any) {
      setResult({ error: e?.message || 'Request failed' })
    } finally {
      setBusy(false)
    }
  }

  const previewRows = users?.slice(0, 10) ?? []
  const previewCols = previewRows[0]
    ? ['first_name', 'email', 'market', 'completion_status', 'percent_complete'].filter(
        (c) => c in previewRows[0]
      )
    : []

  return (
    <div className="space-y-6">
      {/* Drop zone */}
      <label className="block cursor-pointer rounded-lg border-2 border-dashed border-gray-300 p-10 text-center transition-colors hover:border-gray-400">
        <input
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={(e) => onFile(e.target.files?.[0] ?? null)}
        />
        <FileJson className="mx-auto mb-3 h-10 w-10 text-gray-300" />
        <p className="font-medium text-gray-700">
          {file ? file.name : 'Drop a JSON file here or click to browse'}
        </p>
        {file && (
          <p className="mt-1 text-xs text-gray-400">
            {(file.size / 1024).toFixed(1)} KB
          </p>
        )}
      </label>

      {parseError && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4" /> {parseError}
        </div>
      )}

      {/* Preview */}
      {users && (
        <div>
          <h2 className="mb-2 text-lg font-semibold text-gray-800">
            Preview — {users.length} records (showing {previewRows.length})
          </h2>
          <div className="max-h-72 overflow-auto rounded-lg border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-50 text-left">
                <tr>
                  {previewCols.map((c) => (
                    <th key={c} className="px-3 py-2 font-medium text-gray-600">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewRows.map((u, i) => (
                  <tr key={i} className="border-t border-gray-100">
                    {previewCols.map((c) => (
                      <td
                        key={c}
                        className="max-w-[220px] truncate px-3 py-2 text-gray-600"
                      >
                        {String(u[c] ?? '')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Actions */}
      {users && (
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={computeMatches}
              onChange={(e) => setComputeMatches(e.target.checked)}
            />
            Compute matches inline (slower; otherwise next Match Monday cron)
          </label>
          <div className="flex-1" />
          <button
            type="button"
            onClick={() => run(true)}
            disabled={busy}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {busy ? 'Working…' : 'Dry run (counts only)'}
          </button>
          <button
            type="button"
            onClick={() => run(false)}
            disabled={busy}
            className="flex items-center gap-2 rounded-lg bg-[#E29E0C] px-5 py-2 text-sm font-medium text-white hover:bg-[#C2850A] disabled:opacity-50"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            Import {users.length} records
          </button>
        </div>
      )}

      {/* Result */}
      {result && (
        <div
          className={`rounded-lg border p-4 ${
            result.error
              ? 'border-red-200 bg-red-50'
              : 'border-emerald-200 bg-emerald-50'
          }`}
        >
          {result.error ? (
            <div className="flex items-center gap-2 text-red-700">
              <AlertCircle className="h-5 w-5" />
              <p className="font-medium">{result.error}</p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-emerald-700">
                <CheckCircle className="h-5 w-5" />
                <p className="font-medium">
                  {result.dryRun ? 'Dry run complete' : 'Import complete'}
                </p>
              </div>
              <p className="text-sm text-emerald-700">
                {result.total} total · {result.eligible} eligible ·{' '}
                {result.imported ?? 0} imported · {result.skippedExisting ?? 0}{' '}
                already existed · {result.skippedIneligible ?? 0} ineligible ·{' '}
                {result.errors?.length ?? 0} errors
                {result.matchesComputed
                  ? ` · ${result.matchesComputed} matched`
                  : ''}
              </p>
              {result.markets && Object.keys(result.markets).length > 0 && (
                <p className="text-xs text-emerald-700/80">
                  Markets:{' '}
                  {Object.entries(result.markets)
                    .map(([m, n]) => `${m} (${n})`)
                    .join(', ')}
                </p>
              )}
              {result.errors && result.errors.length > 0 && (
                <details className="mt-1">
                  <summary className="cursor-pointer text-xs text-red-600">
                    View {result.errors.length} errors
                  </summary>
                  <ul className="mt-1 max-h-48 space-y-1 overflow-auto text-xs text-red-500">
                    {result.errors.map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
