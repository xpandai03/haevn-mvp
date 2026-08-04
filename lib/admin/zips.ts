/**
 * Pure helpers for the admin ZIP control (single-add). Kept out of the route so
 * the validation + duplicate classification are unit-testable.
 */

export function isValidZip(zip: string): boolean {
  return /^\d{5}$/.test(zip)
}

/** Normalize a single-add body → the row to insert (MSA/city default sensibly). */
export function buildZipRow(body: { zip_code?: string; msa_name?: string; city?: string; county?: string }): {
  zip_code: string
  msa_name: string
  city: string
  county: string
} {
  return {
    zip_code: (body.zip_code || '').trim(),
    msa_name: (body.msa_name || '').trim() || 'Manual',
    city: (body.city || '').trim(),
    county: (body.county || '').trim(),
  }
}

/**
 * Map a Postgres insert result to an API response. A unique-violation (23505)
 * is a DUPLICATE — a clear 409, not a 500. Anything else surfaces as a 500.
 */
export function classifyZipInsert(
  error: { code?: string; message?: string } | null,
  zip: string
): { ok: true } | { ok: false; status: number; message: string } {
  if (!error) return { ok: true }
  if (error.code === '23505') {
    return { ok: false, status: 409, message: `ZIP ${zip} is already in the allowed list.` }
  }
  return { ok: false, status: 500, message: error.message || 'Failed to add ZIP code' }
}
