/**
 * Veriff ID Verification Integration
 * Handles session creation and status checking for identity verification
 *
 * Docs: https://developers.veriff.com/
 */

import crypto from 'crypto'

// Veriff API configuration
const VERIFF_API_KEY = process.env.VERIFF_API_KEY!
const VERIFF_SIGNATURE_KEY = process.env.VERIFF_SIGNATURE_KEY!
const VERIFF_BASE_URL = process.env.VERIFF_BASE_URL!
const VERIFF_RETURN_URL = process.env.VERIFF_RETURN_URL!

if (!VERIFF_API_KEY || !VERIFF_BASE_URL) {
  console.error('❌ Missing Veriff environment variables')
}

export interface VeriffSessionResponse {
  status: string
  verification: {
    id: string
    url: string
    vendorData?: string
    host?: string
    status?: string
    sessionToken?: string
  }
}

export interface VeriffSessionStatusResponse {
  status: string
  verification?: {
    id: string
    code: number
    person?: {
      firstName?: string
      lastName?: string
      dateOfBirth?: string
    }
    document?: {
      number?: string
      type?: string
      country?: string
    }
    status: string
    reason?: string
    reasonCode?: number
    decisionTime?: string
    acceptanceTime?: string
  }
}

export interface VeriffWebhookPayload {
  id: string
  feature: string
  code: number
  action: string
  vendorData?: string
}

/**
 * Create a new Veriff verification session
 * Returns the hosted verification URL and session ID
 */
export async function createVeriffSession(userId: string): Promise<{
  url: string
  sessionId: string
}> {
  console.log('[Veriff] Creating session for user:', userId)
  console.log('[Veriff] Environment check:', {
    hasApiKey: !!VERIFF_API_KEY,
    apiKeyLength: VERIFF_API_KEY?.length,
    hasBaseUrl: !!VERIFF_BASE_URL,
    baseUrl: VERIFF_BASE_URL,
    hasReturnUrl: !!VERIFF_RETURN_URL,
    returnUrl: VERIFF_RETURN_URL
  })

  console.log('[Veriff] Using callback (browser return):', VERIFF_RETURN_URL)

  const payload = {
    verification: {
      callback: VERIFF_RETURN_URL, // Use environment variable for production URL
      vendorData: userId,
      timestamp: new Date().toISOString()
    }
  }

  console.log('[Veriff] Final payload:', payload)
  console.log('[Veriff] Request payload:', JSON.stringify(payload, null, 2))
  console.log('[Veriff] API endpoint:', `${VERIFF_BASE_URL}/v1/sessions`)
  console.log('[Veriff] API key (first 10 chars):', VERIFF_API_KEY?.substring(0, 10) + '...')

  try {
    const response = await fetch(`${VERIFF_BASE_URL}/v1/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-AUTH-CLIENT': VERIFF_API_KEY
      },
      body: JSON.stringify(payload)
    })

    console.log('[Veriff] Response status:', response.status)
    console.log('[Veriff] Response headers:', Object.fromEntries(response.headers.entries()))

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[Veriff] ❌ Session creation failed')
      console.error('[Veriff] Status code:', response.status)
      console.error('[Veriff] Error body:', errorText)

      throw new Error(`Veriff API error ${response.status}: ${errorText}`)
    }

    const data: VeriffSessionResponse = await response.json()

    console.log('[Veriff] ✅ Session created successfully:', {
      sessionId: data.verification.id,
      status: data.status,
      url: data.verification.url?.substring(0, 50) + '...'
    })

    return {
      url: data.verification.url,
      sessionId: data.verification.id
    }
  } catch (error) {
    console.error('[Veriff] ❌ Exception caught:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    })
    throw error
  }
}

/**
 * Get the status of a Veriff verification session
 * Used for polling after user completes verification
 */
export async function getVeriffSessionStatus(
  sessionId: string
): Promise<VeriffSessionStatusResponse> {
  console.log('[Veriff] Getting session status:', sessionId)

  try {
    const response = await fetch(
      `${VERIFF_BASE_URL}/v1/sessions/${sessionId}`,
      {
        method: 'GET',
        headers: {
          'X-AUTH-CLIENT': VERIFF_API_KEY
        }
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[Veriff] Status check failed:', response.status, errorText)
      throw new Error(`Veriff API error: ${response.status}`)
    }

    const data: VeriffSessionStatusResponse = await response.json()

    console.log('[Veriff] Session status:', {
      sessionId,
      status: data.verification?.status,
      code: data.verification?.code
    })

    return data
  } catch (error) {
    console.error('[Veriff] Error getting session status:', error)
    throw error
  }
}

/**
 * Verify the signature of a Veriff webhook payload
 * Ensures the webhook came from Veriff
 */
export function verifyVeriffSignature(
  signature: string,
  payload: string
): boolean {
  try {
    // Use HMAC-SHA256 as per Veriff's documentation
    const expectedSignature = crypto
      .createHmac('sha256', VERIFF_SIGNATURE_KEY)
      .update(payload)
      .digest('hex')

    const isValid = signature.toLowerCase() === expectedSignature.toLowerCase()

    console.log('[Veriff] Signature verification:', {
      provided: signature.substring(0, 10) + '...',
      expected: expectedSignature.substring(0, 10) + '...',
      isValid
    })

    if (!isValid) {
      console.warn('[Veriff] Signature verification failed')
    }

    return isValid
  } catch (error) {
    console.error('[Veriff] Error verifying signature:', error)
    return false
  }
}

/**
 * Check if a verification decision is approved
 */
export function isVerificationApproved(decision: string): boolean {
  return decision === 'approved'
}

/**
 * Map Veriff status codes to human-readable messages
 */
export function getVeriffStatusMessage(code: number): string {
  const messages: Record<number, string> = {
    9001: 'Verification approved',
    9102: 'Verification resubmission requested',
    9103: 'Verification declined',
    9104: 'Verification expired',
    9121: 'Unable to verify'
  }

  return messages[code] || `Unknown status (code: ${code})`
}
