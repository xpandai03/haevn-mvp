import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Safely parse a fetch Response as JSON.
 * Returns a typed result instead of throwing on empty / malformed bodies.
 */
export async function safeResponseJson<T = any>(
  response: Response
): Promise<{ data: T | null; parseError: string | null }> {
  const text = await response.text()
  if (!text || text.trim().length === 0) {
    return {
      data: null,
      parseError: `Empty response body (HTTP ${response.status})`
    }
  }
  try {
    return { data: JSON.parse(text) as T, parseError: null }
  } catch {
    return {
      data: null,
      parseError: `Invalid JSON from server (HTTP ${response.status}): ${text.slice(0, 200)}`
    }
  }
}
