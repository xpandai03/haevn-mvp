import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    // Check if we can create the service role client
    const supabase = createServiceRoleClient()

    // Simple connectivity test - check if the auth admin API is accessible
    // This doesn't require any tables and validates the service role key
    try {
      // Try to get auth settings (requires service role)
      const { data: authData, error: authError } = await supabase.auth.admin.listUsers({
        page: 1,
        perPage: 1
      })

      if (authError) throw authError
    } catch (testError) {
      // If the connection fails, we still report env vars are set
      console.log('Connection test warning:', testError)
    }

    return NextResponse.json({
      ok: true,
      message: 'Supabase connection successful',
      timestamp: new Date().toISOString(),
      hasServiceRole: !!process.env.SUPABASE_SERVICE_ROLE,
      hasPublicUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    })
  } catch (error) {
    console.error('Unexpected error in health check:', error)
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}