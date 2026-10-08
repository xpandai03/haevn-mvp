import type { NextRequest } from 'next/server'
import { handleCreateCohort } from '@/lib/goose/http/handlers'
import { gooseDeps } from '@/lib/goose/http/deps'

// Goose contract v1.0, endpoint 1. Logic + auth: lib/goose/http/handlers.ts.
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  return handleCreateCohort(req, gooseDeps())
}
