/**
 * US ZIP → place resolution for in-app signup.
 *
 * WHY. Every market is released: any US ZIP is a valid signup. In-app signup
 * step 3 used to check the ZIP against a hardcoded four-city list
 * (lib/data/cities.ts), and anything else blocked Continue and opened
 * haevn.co/waitlist in a new tab, which dead-ended the member on a blank page.
 * Nothing here gates. Its only job is to turn a ZIP into a display city and
 * state, the same fields the marketing-survey ingest writes.
 *
 * A LOOKUP FAILURE MUST NEVER BLOCK A SIGNUP. An unknown ZIP, a timeout, or a
 * provider outage returns `null`, and the caller asks the member to type the
 * city instead. Losing a signup to a third-party lookup is the failure this
 * module exists to remove.
 */

export interface ZipPlace {
  zip: string
  city: string
  /** Two-letter state code, e.g. 'KS'. */
  state: string
}

/** A structurally valid US ZIP: exactly five digits (ZIP+4 is trimmed). */
export function normalizeZip(input: string | null | undefined): string | null {
  const digits = String(input ?? '').replace(/\D/g, '')
  if (digits.length !== 5 && digits.length !== 9) return null
  const zip = digits.slice(0, 5)
  return zip === '00000' ? null : zip
}

/**
 * Title-case a provider place name ('BELLE PLAINE' or 'belle plaine' →
 * 'Belle Plaine') so it matches how cities are stored everywhere else.
 */
export function tidyCity(raw: string): string {
  return raw
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .replace(/(^|[\s\-'.])([a-z])/g, (_m, sep: string, ch: string) => sep + ch.toUpperCase())
}

/** Parse a zippopotam.us `/us/<zip>` response body. Exported for tests. */
export function parseZippopotam(zip: string, body: unknown): ZipPlace | null {
  const places = (body as { places?: Array<Record<string, unknown>> } | null)?.places
  const first = Array.isArray(places) ? places[0] : null
  const city = typeof first?.['place name'] === 'string' ? tidyCity(first['place name'] as string) : ''
  const state = typeof first?.['state abbreviation'] === 'string' ? (first['state abbreviation'] as string).trim().toUpperCase() : ''
  if (!city || !/^[A-Z]{2}$/.test(state)) return null
  return { zip, city, state }
}

const LOOKUP_TIMEOUT_MS = 3000

/**
 * Resolve a ZIP to its place. Returns `null` on any failure. Never throws.
 * `fetchImpl` is injectable for tests.
 */
export async function lookupZip(
  input: string,
  fetchImpl: typeof fetch = fetch
): Promise<ZipPlace | null> {
  const zip = normalizeZip(input)
  if (!zip) return null
  try {
    const res = await fetchImpl(`https://api.zippopotam.us/us/${zip}`, {
      signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
      cache: 'force-cache',
    })
    if (!res.ok) return null
    return parseZippopotam(zip, await res.json())
  } catch {
    return null
  }
}
