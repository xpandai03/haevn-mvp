import type { NextRequest } from 'next/server'
import { handleAssociate } from '@/lib/goose/http/handlers'
import { gooseDeps } from '@/lib/goose/http/deps'

// Goose contract v1.0, endpoint 2. Logic + auth: lib/goose/http/handlers.ts.
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handleAssociate(req, (await params).id, gooseDeps())
}
