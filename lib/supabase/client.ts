import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/lib/types/supabase'

// Browser client with cookie-based session persistence for SSR
// IMPORTANT: Using createBrowserClient from @supabase/ssr to enable cookie storage
// This allows the server to read the session via cookies()
export const supabase = createBrowserClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Export a function for compatibility with existing code
export function createClient() {
  return supabase
}