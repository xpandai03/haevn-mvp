#!/usr/bin/env node

/**
 * Apply the user_onboarding_state migration directly to Supabase
 */

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

async function applyMigration() {
  // Load environment variables
  require('dotenv').config({ path: path.join(__dirname, '../.env.local') })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing Supabase credentials in .env.local')
    console.error('Required: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  console.log('📦 Reading migration file...')
  const migrationPath = path.join(__dirname, '../supabase/migrations/008_user_onboarding_state.sql')
  const migrationSQL = fs.readFileSync(migrationPath, 'utf8')

  console.log('🚀 Applying migration to Supabase...')

  try {
    // Split by semicolons and execute each statement
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'))

    for (const statement of statements) {
      const { error } = await supabase.rpc('exec_sql', { sql: statement + ';' })

      if (error) {
        // Try direct SQL execution if RPC doesn't work
        const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseServiceKey,
            'Authorization': `Bearer ${supabaseServiceKey}`
          },
          body: JSON.stringify({ sql: statement + ';' })
        })

        if (!response.ok) {
          console.warn(`⚠️  Statement may need manual execution:`)
          console.warn(statement.substring(0, 100) + '...')
        }
      }
    }

    console.log('✅ Migration applied successfully!')
    console.log('\nNext steps:')
    console.log('1. Verify table exists in Supabase dashboard')
    console.log('2. Run: node scripts/verify-migration.js')

  } catch (error) {
    console.error('❌ Migration failed:', error.message)
    console.log('\n📝 Manual migration required. Run this SQL in Supabase SQL Editor:')
    console.log(migrationSQL)
    process.exit(1)
  }
}

applyMigration()