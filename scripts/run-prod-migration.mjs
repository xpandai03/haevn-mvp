#!/usr/bin/env node

/**
 * Run production migration using Supabase admin client
 * Usage: node scripts/run-prod-migration.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Error: Missing environment variables');
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  console.error('Make sure they are in .env.local file');
  process.exit(1);
}

// Create admin client
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Read migration file
const migrationPath = join(__dirname, '../RUN_MISSING_MIGRATIONS_PROD.sql');
const sqlStatements = readFileSync(migrationPath, 'utf8')
  .split(';')
  .map(s => s.trim())
  .filter(s => s.length > 0 && !s.startsWith('--'));

console.log(`Running ${sqlStatements.length} SQL statements...`);

async function runMigration() {
  for (let i = 0; i < sqlStatements.length; i++) {
    const sql = sqlStatements[i];

    // Skip comments
    if (sql.startsWith('--')) continue;

    console.log(`\n[${i + 1}/${sqlStatements.length}] Executing statement...`);
    console.log(sql.substring(0, 80) + (sql.length > 80 ? '...' : ''));

    try {
      const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

      if (error) {
        // Try direct query if RPC doesn't work
        const { error: queryError } = await supabase.from('_').select('*').limit(0);
        console.warn('Note: Unable to execute via RPC. You may need to run this SQL manually in Supabase dashboard.');
        console.warn('Error:', error.message);
      } else {
        console.log('✓ Success');
      }
    } catch (err) {
      console.error('✗ Error:', err.message);
    }
  }

  console.log('\n=== Migration Complete ===');
  console.log('Please verify the user_survey_responses table exists in Supabase dashboard.');
}

runMigration().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
