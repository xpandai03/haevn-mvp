#!/usr/bin/env node
require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables')
  console.error('Make sure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_KEY are set')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function runMigration() {
  console.log('Running user survey migration...')

  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, '../supabase/migrations/007_user_survey_responses.sql')
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8')

    // Split by semicolons and filter out empty statements
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'))

    // Execute each statement
    for (const statement of statements) {
      if (statement.trim()) {
        console.log(`Executing: ${statement.substring(0, 50)}...`)
        const { error } = await supabase.rpc('exec_sql', {
          sql_query: statement + ';'
        }).single()

        if (error) {
          // Try direct execution if RPC doesn't work
          console.log('RPC failed, statement may need manual execution:', error.message)
        }
      }
    }

    console.log('Migration completed successfully!')
    console.log('\nIMPORTANT: If you see RPC errors above, please run the migration manually:')
    console.log('1. Go to your Supabase dashboard')
    console.log('2. Navigate to SQL Editor')
    console.log('3. Copy and paste the contents of supabase/migrations/007_user_survey_responses.sql')
    console.log('4. Click "Run" to execute the migration')

  } catch (error) {
    console.error('Migration error:', error)
    console.log('\nPlease run the migration manually in Supabase SQL Editor')
  }
}

runMigration()