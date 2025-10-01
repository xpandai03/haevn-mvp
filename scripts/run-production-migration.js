#!/usr/bin/env node

/**
 * Run production migration directly via Supabase API
 * Usage: SUPABASE_SERVICE_ROLE_KEY=xxx node scripts/run-production-migration.js
 */

const fs = require('fs');
const path = require('path');

// Read environment variables
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Error: Missing environment variables');
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// Read migration file
const migrationPath = path.join(__dirname, '../RUN_MISSING_MIGRATIONS_PROD.sql');
const sql = fs.readFileSync(migrationPath, 'utf8');

async function runMigration() {
  console.log('Running migration on:', SUPABASE_URL);

  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'Prefer': 'return=representation'
    },
    body: JSON.stringify({
      query: sql
    })
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Migration failed:', error);
    process.exit(1);
  }

  const result = await response.json();
  console.log('Migration successful:', result);
}

runMigration().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
