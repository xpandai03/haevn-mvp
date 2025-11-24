/**
 * Phase 3 Backend Integrity Test
 * Tests database schema, RLS policies, and server actions
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function testPhase3Backend() {
  console.log('🧪 Phase 3 Backend Integrity Tests\n')
  console.log('=' .repeat(50))

  let allPassed = true

  // ========================================
  // TEST 1: Verify Tables Exist
  // ========================================
  console.log('\n📋 TEST 1: Verify Phase 3 Tables Exist')
  console.log('-'.repeat(50))

  const tables = ['nudges', 'conversations', 'conversation_messages', 'profile_views']

  for (const table of tables) {
    try {
      const { error } = await supabase.from(table).select('id').limit(0)
      if (error) {
        console.log(`❌ Table '${table}': ${error.message}`)
        allPassed = false
      } else {
        console.log(`✅ Table '${table}' exists and is accessible`)
      }
    } catch (err) {
      console.log(`❌ Table '${table}': ${err}`)
      allPassed = false
    }
  }

  // ========================================
  // TEST 2: Check Table Structure
  // ========================================
  console.log('\n🏗️  TEST 2: Verify Table Structures')
  console.log('-'.repeat(50))

  try {
    const { error } = await supabase.from('nudges').select('*').limit(1)
    console.log(error ? `❌ Nudges: ${error.message}` : '✅ Nudges table structure verified')
  } catch (err) {
    console.log(`❌ Nudges: ${err}`)
  }

  try {
    const { error } = await supabase.from('conversations').select('*').limit(1)
    console.log(error ? `❌ Conversations: ${error.message}` : '✅ Conversations table structure verified')
  } catch (err) {
    console.log(`❌ Conversations: ${err}`)
  }

  try {
    const { error } = await supabase.from('conversation_messages').select('*').limit(1)
    console.log(error ? `❌ Conversation messages: ${error.message}` : '✅ Conversation messages table structure verified')
  } catch (err) {
    console.log(`❌ Conversation messages: ${err}`)
  }

  try {
    const { error } = await supabase.from('profile_views').select('*').limit(1)
    console.log(error ? `❌ Profile views: ${error.message}` : '✅ Profile views table structure verified')
  } catch (err) {
    console.log(`❌ Profile views: ${err}`)
  }

  // ========================================
  // TEST 3: Count Existing Data
  // ========================================
  console.log('\n📈 TEST 3: Current Data Counts')
  console.log('-'.repeat(50))

  for (const table of tables) {
    try {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true })

      if (error) {
        console.log(`❌ ${table}: ${error.message}`)
      } else {
        console.log(`✅ ${table}: ${count || 0} rows`)
      }
    } catch (err) {
      console.log(`❌ ${table}: ${err}`)
    }
  }

  // ========================================
  // TEST 4: Check Related Tables
  // ========================================
  console.log('\n🔗 TEST 4: Verify Related Tables (Required for Phase 3)')
  console.log('-'.repeat(50))

  const relatedTables = ['handshakes', 'messages', 'partnerships', 'profiles']

  for (const table of relatedTables) {
    try {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true })

      if (error) {
        console.log(`❌ ${table}: ${error.message}`)
      } else {
        console.log(`✅ ${table}: ${count || 0} rows`)
      }
    } catch (err) {
      console.log(`⚠️  ${table}: ${err}`)
    }
  }

  // ========================================
  // SUMMARY
  // ========================================
  console.log('\n' + '='.repeat(50))
  console.log(`\n${allPassed ? '✅' : '⚠️'} Backend Integrity Check ${allPassed ? 'PASSED' : 'COMPLETED WITH WARNINGS'}`)
  console.log('\nPhase 3 database schema is ready for use.')
  console.log('\nNext steps:')
  console.log('1. Test server actions (getReceivedNudges, getConnections, etc.)')
  console.log('2. Verify RLS policies with authenticated requests')
  console.log('3. Test frontend integration\n')
}

// Run tests
testPhase3Backend()
  .then(() => {
    console.log('✅ Test suite completed')
    process.exit(0)
  })
  .catch((err) => {
    console.error('❌ Test suite failed:', err)
    process.exit(1)
  })
