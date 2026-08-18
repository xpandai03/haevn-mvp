/**
 * Static city → centroid table for the meetup feed (v1, no external geocoding).
 *
 * Member geo is city-level only (city is 100% filled; lat/long is 0%). Centroids
 * here are approximate city-center coordinates — public, non-personal, and
 * identical for every member in a city. Covers the cities currently present in
 * the released pair set, disambiguated by the member base's clustering
 * (Austin-metro TX, Portland-metro OR, Tampa FL, plus a few singletons).
 *
 * Genuinely ambiguous city names (no confident state) are intentionally OMITTED
 * so the member resolves to `geo_unresolved` (fail-safe: his side skips it, the
 * cron logs it) rather than being placed in the wrong state and corrupting his
 * geo-vs-business math. Extend the table as new markets appear.
 */

export interface Centroid {
  city_id: string
  city_label: string
  lat: number
  lon: number
}

/** Normalize a raw `partnerships.city` string to a lookup key. */
export function normalizeCityKey(raw: unknown): string {
  if (typeof raw !== 'string') return ''
  let s = raw.trim().toLowerCase()
  // Known aliases / composite labels → canonical key.
  if (s === 'tampa/st. pete' || s === 'tampa/st pete' || s === 'st. petersburg' || s === 'st petersburg') s = 'tampa'
  return s
}

// key = normalizeCityKey(city_label)
const TABLE: Record<string, Centroid> = {
  // ── Austin metro, TX ──
  austin: { city_id: 'austin-tx', city_label: 'Austin', lat: 30.2672, lon: -97.7431 },
  'round rock': { city_id: 'round-rock-tx', city_label: 'Round Rock', lat: 30.5083, lon: -97.6789 },
  leander: { city_id: 'leander-tx', city_label: 'Leander', lat: 30.5788, lon: -97.8531 },
  'san marcos': { city_id: 'san-marcos-tx', city_label: 'San Marcos', lat: 29.8833, lon: -97.9414 },
  pflugerville: { city_id: 'pflugerville-tx', city_label: 'Pflugerville', lat: 30.4394, lon: -97.62 },
  georgetown: { city_id: 'georgetown-tx', city_label: 'Georgetown', lat: 30.6333, lon: -97.6779 },
  lockhart: { city_id: 'lockhart-tx', city_label: 'Lockhart', lat: 29.8844, lon: -97.67 },
  hutto: { city_id: 'hutto-tx', city_label: 'Hutto', lat: 30.5427, lon: -97.5467 },
  elgin: { city_id: 'elgin-tx', city_label: 'Elgin', lat: 30.3494, lon: -97.3703 },
  'del valle': { city_id: 'del-valle-tx', city_label: 'Del Valle', lat: 30.1747, lon: -97.6247 },
  maxwell: { city_id: 'maxwell-tx', city_label: 'Maxwell', lat: 29.8391, lon: -97.7947 },
  'dripping springs': { city_id: 'dripping-springs-tx', city_label: 'Dripping Springs', lat: 30.1902, lon: -98.0864 },
  manor: { city_id: 'manor-tx', city_label: 'Manor', lat: 30.3405, lon: -97.5564 },
  taylor: { city_id: 'taylor-tx', city_label: 'Taylor', lat: 30.5705, lon: -97.4092 },
  kyle: { city_id: 'kyle-tx', city_label: 'Kyle', lat: 29.9891, lon: -97.8772 },
  wimberley: { city_id: 'wimberley-tx', city_label: 'Wimberley', lat: 29.9974, lon: -98.0989 },
  bastrop: { city_id: 'bastrop-tx', city_label: 'Bastrop', lat: 30.1105, lon: -97.3151 },
  smithville: { city_id: 'smithville-tx', city_label: 'Smithville', lat: 30.0088, lon: -97.1597 },
  'cedar park': { city_id: 'cedar-park-tx', city_label: 'Cedar Park', lat: 30.5052, lon: -97.8203 },
  houston: { city_id: 'houston-tx', city_label: 'Houston', lat: 29.7604, lon: -95.3698 },
  odessa: { city_id: 'odessa-tx', city_label: 'Odessa', lat: 31.8457, lon: -102.3676 },
  buda: { city_id: 'buda-tx', city_label: 'Buda', lat: 30.0805, lon: -97.8403 },
  bertram: { city_id: 'bertram-tx', city_label: 'Bertram', lat: 30.7402, lon: -98.0578 },
  'missouri city': { city_id: 'missouri-city-tx', city_label: 'Missouri City', lat: 29.6186, lon: -95.5377 },

  // ── Portland metro, OR ──
  portland: { city_id: 'portland-or', city_label: 'Portland', lat: 45.5152, lon: -122.6784 },
  tualatin: { city_id: 'tualatin-or', city_label: 'Tualatin', lat: 45.3843, lon: -122.7637 },
  beaverton: { city_id: 'beaverton-or', city_label: 'Beaverton', lat: 45.4871, lon: -122.8037 },
  gladstone: { city_id: 'gladstone-or', city_label: 'Gladstone', lat: 45.3798, lon: -122.5945 },
  hillsboro: { city_id: 'hillsboro-or', city_label: 'Hillsboro', lat: 45.5229, lon: -122.9898 },
  mcminnville: { city_id: 'mcminnville-or', city_label: 'McMinnville', lat: 45.2101, lon: -123.1987 },
  carlton: { city_id: 'carlton-or', city_label: 'Carlton', lat: 45.294, lon: -123.1759 },
  salem: { city_id: 'salem-or', city_label: 'Salem', lat: 44.9429, lon: -123.0351 },
  albany: { city_id: 'albany-or', city_label: 'Albany', lat: 44.6365, lon: -123.1059 },
  eugene: { city_id: 'eugene-or', city_label: 'Eugene', lat: 44.0521, lon: -123.0868 },
  'la grande': { city_id: 'la-grande-or', city_label: 'La Grande', lat: 45.3246, lon: -118.0877 },
  vale: { city_id: 'vale-or', city_label: 'Vale', lat: 43.9821, lon: -117.2386 },
  harrisburg: { city_id: 'harrisburg-or', city_label: 'Harrisburg', lat: 44.2718, lon: -123.1712 },
  cloverdale: { city_id: 'cloverdale-or', city_label: 'Cloverdale', lat: 45.2079, lon: -123.8955 },
  vancouver: { city_id: 'vancouver-wa', city_label: 'Vancouver', lat: 45.6387, lon: -122.6615 }, // WA (Portland metro)
  troutdale: { city_id: 'troutdale-or', city_label: 'Troutdale', lat: 45.5395, lon: -122.387 },
  canby: { city_id: 'canby-or', city_label: 'Canby', lat: 45.2629, lon: -122.6929 },
  'the dalles': { city_id: 'the-dalles-or', city_label: 'The Dalles', lat: 45.5946, lon: -121.1787 },

  // ── Tampa / FL ──
  tampa: { city_id: 'tampa-fl', city_label: 'Tampa', lat: 27.9506, lon: -82.4572 },
  'winter haven': { city_id: 'winter-haven-fl', city_label: 'Winter Haven', lat: 28.0222, lon: -81.7328 },
  seminole: { city_id: 'seminole-fl', city_label: 'Seminole', lat: 27.8398, lon: -82.7912 },
  bradenton: { city_id: 'bradenton-fl', city_label: 'Bradenton', lat: 27.4989, lon: -82.5748 },
  auburndale: { city_id: 'auburndale-fl', city_label: 'Auburndale', lat: 28.0653, lon: -81.7887 },
  oceanside: { city_id: 'oceanside-ca', city_label: 'Oceanside', lat: 33.1959, lon: -117.3795 },
  'los angeles': { city_id: 'los-angeles-ca', city_label: 'Los Angeles', lat: 34.0522, lon: -118.2437 },

  // ── Other confident singletons ──
  billings: { city_id: 'billings-mt', city_label: 'Billings', lat: 45.7833, lon: -108.5007 },
  hattiesburg: { city_id: 'hattiesburg-ms', city_label: 'Hattiesburg', lat: 31.3271, lon: -89.2903 },

  // Deferred (ambiguous state — resolve to geo_unresolved until confirmed):
  //   'urbana' (IL/OH), 'hamburg' (NY/…), 'niles' (IL/MI/OH), 'hernando' (FL/MS),
  //   'centreville' (VA/IL/…). Logged by the cron so the table can be extended.
}

export interface ResolvedCity {
  city_id: string
  city_label: string
  centroid: [number, number]
}

/** Resolve a raw city string to a centroid, or null when not in the table. */
export function resolveCity(raw: unknown): ResolvedCity | null {
  const key = normalizeCityKey(raw)
  if (!key) return null
  const hit = TABLE[key]
  if (!hit) return null
  return { city_id: hit.city_id, city_label: hit.city_label, centroid: [hit.lat, hit.lon] }
}

/** Exposed for tests / diagnostics. */
export const CITY_CENTROID_COUNT = Object.keys(TABLE).length
