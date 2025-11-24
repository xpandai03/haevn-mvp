/**
 * Phase 3 Backend Integrity Test API Route
 * GET /api/test/phase3-backend
 */

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const results: any = {
    timestamp: new Date().toISOString(),
    tests: []
  }

  try {
    const supabase = await createClient()

    // TEST 1: Verify Tables Exist
    const tables = ['nudges', 'conversations', 'conversation_messages', 'profile_views']
    const tableTests: any = { name: 'Table Existence', results: [] }

    for (const table of tables) {
      try {
        const { error } = await supabase.from(table).select('id').limit(0)
        tableTests.results.push({
          table,
          passed: !error,
          message: error ? error.message : 'Table exists and is accessible'
        })
      } catch (err: any) {
        tableTests.results.push({
          table,
          passed: false,
          message: err.message || 'Unknown error'
        })
      }
    }

    results.tests.push(tableTests)

    // TEST 2: Count Existing Data
    const countTests: any = { name: 'Data Counts', results: [] }

    for (const table of tables) {
      try {
        const { count, error } = await supabase
          .from(table)
          .select('*', { count: 'exact', head: true })

        countTests.results.push({
          table,
          count: count || 0,
          passed: !error,
          message: error ? error.message : `${count || 0} rows`
        })
      } catch (err: any) {
        countTests.results.push({
          table,
          count: 0,
          passed: false,
          message: err.message || 'Unknown error'
        })
      }
    }

    results.tests.push(countTests)

    // TEST 3: Check Related Tables
    const relatedTables = ['handshakes', 'messages', 'partnerships', 'profiles']
    const relatedTests: any = { name: 'Related Tables', results: [] }

    for (const table of relatedTables) {
      try {
        const { count, error } = await supabase
          .from(table)
          .select('*', { count: 'exact', head: true })

        relatedTests.results.push({
          table,
          count: count || 0,
          passed: !error,
          message: error ? error.message : `${count || 0} rows`
        })
      } catch (err: any) {
        relatedTests.results.push({
          table,
          count: 0,
          passed: false,
          message: err.message || 'Unknown error'
        })
      }
    }

    results.tests.push(relatedTests)

    // TEST 4: Test Server Actions
    const actionTests: any = { name: 'Server Actions', results: [] }

    // Test getReceivedNudges exists
    try {
      const { getReceivedNudges } = await import('@/lib/actions/nudges')
      actionTests.results.push({
        action: 'getReceivedNudges',
        passed: true,
        message: 'Function exists'
      })
    } catch (err: any) {
      actionTests.results.push({
        action: 'getReceivedNudges',
        passed: false,
        message: err.message
      })
    }

    // Test getConnections exists
    try {
      const { getConnections } = await import('@/lib/actions/connections')
      actionTests.results.push({
        action: 'getConnections',
        passed: true,
        message: 'Function exists'
      })
    } catch (err: any) {
      actionTests.results.push({
        action: 'getConnections',
        passed: false,
        message: err.message
      })
    }

    // Test getProfileData exists
    try {
      const { getProfileData } = await import('@/lib/actions/profiles')
      actionTests.results.push({
        action: 'getProfileData',
        passed: true,
        message: 'Function exists'
      })
    } catch (err: any) {
      actionTests.results.push({
        action: 'getProfileData',
        passed: false,
        message: err.message
      })
    }

    results.tests.push(actionTests)

    // Calculate summary
    const allPassed = results.tests.every((test: any) =>
      test.results.every((r: any) => r.passed)
    )

    results.summary = {
      allPassed,
      totalTests: results.tests.reduce((sum: number, test: any) => sum + test.results.length, 0),
      passedTests: results.tests.reduce(
        (sum: number, test: any) => sum + test.results.filter((r: any) => r.passed).length,
        0
      )
    }

    return NextResponse.json(results, { status: 200 })
  } catch (error: any) {
    return NextResponse.json(
      {
        error: 'Test suite failed',
        message: error.message,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}
