/**
 * Script to import Austin MSA ZIP codes from CSV into Supabase
 * Run with: npx tsx scripts/import-austin-msa.ts
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'
import * as dotenv from 'dotenv'

// Load environment variables from .env.local
dotenv.config({ path: path.join(__dirname, '..', '.env.local') })

// Initialize Supabase client with service role key
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables')
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

interface ZipCodeRow {
  zip_code: string
  msa_name: string
  city: string
  county: string
  country: string
}

async function parseCSV(filePath: string): Promise<ZipCodeRow[]> {
  const csvContent = fs.readFileSync(filePath, 'utf-8')
  const lines = csvContent.split('\n').filter(line => line.trim())

  // Skip header row
  const dataLines = lines.slice(1)

  const zipCodesMap = new Map<string, ZipCodeRow>()
  const msaName = 'Austin–Round Rock MSA'

  for (const line of dataLines) {
    const [city, county, zipCode] = line.split(',').map(s => s.trim())

    // Skip empty rows
    if (!city || !county || !zipCode) continue

    // Validate ZIP code format (5 digits)
    if (!/^\d{5}$/.test(zipCode)) {
      console.warn(`⚠️  Skipping invalid ZIP code: ${zipCode} (${city}, ${county})`)
      continue
    }

    // Only keep first occurrence of each ZIP code (deduplication)
    if (!zipCodesMap.has(zipCode)) {
      zipCodesMap.set(zipCode, {
        zip_code: zipCode,
        msa_name: msaName,
        city,
        county,
        country: 'US'
      })
    }
  }

  return Array.from(zipCodesMap.values())
}

async function importZipCodes() {
  console.log('🚀 Starting Austin MSA ZIP code import...\n')

  // Parse CSV file
  const csvPath = path.join(process.cwd(), '..', 'Austin_MSA_ZIP_Codes_by_County.csv')
  console.log(`📄 Reading CSV from: ${csvPath}`)

  let zipCodes: ZipCodeRow[]
  try {
    zipCodes = await parseCSV(csvPath)
    console.log(`✅ Parsed ${zipCodes.length} ZIP codes\n`)
  } catch (error) {
    console.error('❌ Error parsing CSV:', error)
    process.exit(1)
  }

  // Check for existing data
  const { count: existingCount, error: checkError } = await supabase
    .from('msa_allowed_zips')
    .select('*', { count: 'exact', head: true })

  if (checkError) {
    console.error('❌ Error checking existing data:', checkError)
    process.exit(1)
  }

  console.log(`📊 Existing ZIP codes in table: ${existingCount}\n`)

  if (existingCount && existingCount > 0) {
    console.log(`⚠️  Table already contains ${existingCount} ZIP codes.`)
    console.log('✅ Data already imported. Skipping import.\n')

    // Verify a few sample ZIPs
    console.log('📍 Verifying sample ZIP codes:')
    const samples = ['78701', '78613', '78666']
    for (const zip of samples) {
      const { data } = await supabase
        .from('msa_allowed_zips')
        .select('city, county, msa_name')
        .eq('zip_code', zip)
        .maybeSingle()

      if (data) {
        console.log(`   ${zip}: ✅ ${data.city}, ${data.county}`)
      }
    }
    process.exit(0)
  }

  // Insert ZIP codes in batches using upsert to handle existing data
  const batchSize = 50
  let successCount = 0
  let errorCount = 0

  console.log('📥 Importing ZIP codes (using upsert)...\n')

  for (let i = 0; i < zipCodes.length; i += batchSize) {
    const batch = zipCodes.slice(i, i + batchSize)

    const { data, error } = await supabase
      .from('msa_allowed_zips')
      .upsert(batch, { onConflict: 'zip_code' })
      .select()

    if (error) {
      console.error(`❌ Error upserting batch ${i / batchSize + 1}:`, error)
      errorCount += batch.length
    } else {
      successCount += data?.length || batch.length
      console.log(`✅ Upserted batch ${i / batchSize + 1} (${batch.length} records)`)
    }
  }

  console.log('\n📊 Import Summary:')
  console.log(`   ✅ Successfully imported: ${successCount} ZIP codes`)
  if (errorCount > 0) {
    console.log(`   ❌ Failed: ${errorCount} ZIP codes`)
  }
  console.log('\n🎉 Import complete!')

  // Verify data
  const { data: verifyData, error: verifyError } = await supabase
    .from('msa_allowed_zips')
    .select('msa_name, county, count', { count: 'exact' })

  if (!verifyError && verifyData) {
    console.log('\n📍 Verification:')
    const { count } = await supabase
      .from('msa_allowed_zips')
      .select('*', { count: 'exact', head: true })
    console.log(`   Total ZIP codes in database: ${count}`)
  }
}

// Run import
importZipCodes().catch(error => {
  console.error('❌ Unhandled error:', error)
  process.exit(1)
})
