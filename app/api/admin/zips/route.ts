import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdminUser } from '@/lib/admin/allowlist'
import { isValidZip, buildZipRow, classifyZipInsert } from '@/lib/admin/zips'

async function verifyAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email || !isAdminUser(user.email)) {
    return null
  }
  return user
}

/**
 * GET /api/admin/zips — List all allowed ZIP codes
 */
export async function GET() {
  const user = await verifyAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('msa_allowed_zips')
    .select('zip_code, msa_name, city, county, created_at')
    .order('zip_code', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ zips: data })
}

/**
 * POST /api/admin/zips — Add ZIP codes (single or CSV upload)
 * Body: { zip_code, msa_name?, city?, county? } OR { csv: "78701\n78702\n..." }
 */
export async function POST(request: NextRequest) {
  const user = await verifyAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const admin = createAdminClient()
  const body = await request.json()

  // CSV bulk upload
  if (body.csv) {
    const lines = (body.csv as string)
      .split(/[\n,]/)
      .map((z: string) => z.trim())
      .filter((z: string) => /^\d{5}$/.test(z))

    if (lines.length === 0) {
      return NextResponse.json({ error: 'No valid 5-digit ZIP codes found' }, { status: 400 })
    }

    const rows = lines.map((zip: string) => ({
      zip_code: zip,
      msa_name: body.msa_name || 'Manual',
      city: body.city || '',
      county: body.county || '',
    }))

    const { error } = await admin
      .from('msa_allowed_zips')
      .upsert(rows, { onConflict: 'zip_code', ignoreDuplicates: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ added: lines.length, zips: lines })
  }

  // Single ZIP add — a plain INSERT (not upsert-ignore) so a duplicate returns a
  // CLEAR 409 instead of silently claiming success. MSA/city/county are honored
  // so the client can self-serve a real market (e.g. Portland/Tampa), not 'Manual'.
  const row = buildZipRow(body)
  if (!isValidZip(row.zip_code)) {
    return NextResponse.json({ error: 'ZIP code must be 5 digits' }, { status: 400 })
  }

  const { error } = await admin.from('msa_allowed_zips').insert(row)
  const result = classifyZipInsert(error, row.zip_code)
  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: result.status })
  }

  return NextResponse.json({ added: 1, zip: row.zip_code, msa_name: row.msa_name })
}

/**
 * DELETE /api/admin/zips — Remove a ZIP code
 * Body: { zip_code: "78701" }
 */
export async function DELETE(request: NextRequest) {
  const user = await verifyAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const body = await request.json()
  const zip = (body.zip_code || '').trim()

  if (!/^\d{5}$/.test(zip)) {
    return NextResponse.json({ error: 'ZIP code must be 5 digits' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('msa_allowed_zips')
    .delete()
    .eq('zip_code', zip)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ removed: zip })
}
