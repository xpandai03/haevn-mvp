import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.join(__dirname, '..', '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function verify() {
  console.log('🔍 Verifying MSA data in database...\n')

  const { count, error } = await supabase
    .from('msa_allowed_zips')
    .select('*', { count: 'exact', head: true })

  if (error) {
    console.error('❌ Error:', error)
    return
  }

  console.log(`✅ Total ZIP codes in database: ${count}\n`)

  // Test a few sample ZIP codes
  console.log('📍 Testing sample ZIP codes:')
  const testZips = ['78701', '78613', '78666', '90001', '90210']
  for (const zip of testZips) {
    const { data } = await supabase
      .from('msa_allowed_zips')
      .select('*')
      .eq('zip_code', zip)
      .maybeSingle()

    if (data) {
      console.log(`   ${zip}: ✅ ${data.city}, ${data.county} County - ${data.msa_name}`)
    } else {
      console.log(`   ${zip}: ❌ Not found (expected for non-Austin ZIPs)`)
    }
  }

  console.log('\n✅ Verification complete!')
}

verify()
