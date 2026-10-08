import type { NextRequest } from 'next/server'
import { handleFinalize } from '@/lib/goose/http/handlers'
import { gooseDeps } from '@/lib/goose/http/deps'

// Goose contract v1.0, endpoint 3. Logic + auth: lib/goose/http/handlers.ts.
// Responds `processing` immediately; the compute (with in-run retries and
// alerts) runs after the response inside this invocation, hence the ceiling.
export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handleFinalize(req, (await params).id, gooseDeps())
}
