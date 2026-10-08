import type { NextRequest } from 'next/server'
import { handleStatus } from '@/lib/goose/http/handlers'
import { gooseDeps } from '@/lib/goose/http/deps'

// Goose contract v1.0, endpoint 4. Logic + auth: lib/goose/http/handlers.ts.
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handleStatus(req, (await params).id, gooseDeps())
}
