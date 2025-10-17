/**
 * MSA ZIP Code Validation API Route
 * Validates whether a ZIP code is within an allowed MSA (Metropolitan Statistical Area)
 *
 * GET /api/msa-check?zip=78701
 *
 * Returns:
 * - 200 with validation result for valid requests
 * - 400 for invalid ZIP format
 * - 500 for server errors
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Test account exception: ZIP 90210 always passes for existing test users
const TEST_ZIP_CODES = ['90210']

interface MSAValidationResponse {
  valid: boolean
  msa_name?: string
  city?: string
  county?: string
  message?: string
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const zip = searchParams.get('zip')

    // Validate ZIP parameter
    if (!zip) {
      return NextResponse.json(
        {
          valid: false,
          message: 'ZIP code parameter is required'
        } as MSAValidationResponse,
        { status: 400 }
      )
    }

    // Validate ZIP format (5 digits)
    if (!/^\d{5}$/.test(zip)) {
      return NextResponse.json(
        {
          valid: false,
          message: 'ZIP code must be 5 digits'
        } as MSAValidationResponse,
        { status: 400 }
      )
    }

    // Check if test ZIP code (always allow for existing test accounts)
    if (TEST_ZIP_CODES.includes(zip)) {
      return NextResponse.json(
        {
          valid: true,
          msa_name: 'Test Account',
          city: 'Beverly Hills',
          county: 'Los Angeles',
          message: 'Test ZIP code accepted'
        } as MSAValidationResponse,
        { status: 200 }
      )
    }

    // Query Supabase for allowed ZIP code
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('msa_allowed_zips')
      .select('msa_name, city, county')
      .eq('zip_code', zip)
      .maybeSingle()

    if (error) {
      console.error('Error querying msa_allowed_zips:', error)
      return NextResponse.json(
        {
          valid: false,
          message: 'Error validating ZIP code'
        } as MSAValidationResponse,
        { status: 500 }
      )
    }

    // ZIP code found in allowed list
    if (data) {
      return NextResponse.json(
        {
          valid: true,
          msa_name: data.msa_name,
          city: data.city,
          county: data.county
        } as MSAValidationResponse,
        { status: 200 }
      )
    }

    // ZIP code not found - not in allowed MSA
    return NextResponse.json(
      {
        valid: false,
        message: "We're currently available only in the Austin Metro Area. Join our waitlist to be notified when we expand to your area!"
      } as MSAValidationResponse,
      { status: 200 }
    )
  } catch (error) {
    console.error('Unexpected error in msa-check:', error)
    return NextResponse.json(
      {
        valid: false,
        message: 'An unexpected error occurred'
      } as MSAValidationResponse,
      { status: 500 }
    )
  }
}
