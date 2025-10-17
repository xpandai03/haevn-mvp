# 🔐 HAEVN Stripe Identity Setup Guide

**Purpose**: This guide provides step-by-step instructions for setting up Stripe Identity verification for the HAEVN platform.

**Audience**:
- **Part 1**: For developer to follow during client call
- **Part 2**: For Claude Code to implement after credentials are obtained

---

## 📞 PART 1: CLIENT CALL CHECKLIST

### Before the Call
- [ ] Have this document open
- [ ] Have a secure method to receive credentials (1Password, LastPass, encrypted email, etc.)
- [ ] Ensure you have access to the HAEVN-STARTER-INTERFACE codebase
- [ ] Have Supabase dashboard open (for database updates)

---

## 🎯 What You Need From Client

### 1. Stripe Account Access (CRITICAL)
**Ask**: "Can you add me as a team member to your Stripe account?"

**What they need to do:**
1. Log into Stripe Dashboard (https://dashboard.stripe.com)
2. Go to **Settings** → **Team and security**
3. Click **Invite team member**
4. Add your email with **Developer** role
5. You'll receive an email invitation

**Why**: You need account access to view settings, configure Identity, and access webhook logs.

---

### 2. Enable Stripe Identity Product (CRITICAL)
**Ask**: "Can we enable Stripe Identity on your account?"

**What they need to do:**
1. In Stripe Dashboard, go to **Products** → **Identity**
2. Click **Enable Identity**
3. Complete any required business verification steps
4. Accept Stripe Identity terms of service

**Why**: Identity must be enabled before API integration will work.

**Note**: This may require business verification and can take 1-2 business days if not already approved.

---

### 3. API Keys - Test Mode (CRITICAL)
**Ask**: "I need your Stripe Test API keys for development."

**What they need to provide:**
1. In Stripe Dashboard, toggle to **Test mode** (top right)
2. Go to **Developers** → **API keys**
3. Copy and share:
   - **Publishable key**: `pk_test_...`
   - **Secret key**: `sk_test_...` (Click "Reveal test key")

**Security**: These should be shared securely (password manager, encrypted channel).

**Why**: Test keys allow development and testing without affecting real users or money.

---

### 4. API Keys - Live Mode (CRITICAL for Production)
**Ask**: "I'll also need your Live API keys for production deployment."

**What they need to provide:**
1. In Stripe Dashboard, toggle to **Live mode** (top right)
2. Go to **Developers** → **API keys**
3. Copy and share:
   - **Publishable key**: `pk_live_...`
   - **Secret key**: `sk_live_...` (Click "Reveal live key")

**Security**: EXTREMELY SENSITIVE - handle with maximum security.

**Why**: Production keys are needed for the live application.

---

### 5. Webhook Configuration (CRITICAL)
**Ask**: "We need to set up webhooks for Identity verification events."

**What they need to do (you can do this together on the call):**

#### For Test Mode:
1. In Stripe Dashboard, toggle to **Test mode**
2. Go to **Developers** → **Webhooks**
3. Click **Add endpoint**
4. Enter endpoint URL: `https://YOUR-VERCEL-APP.vercel.app/api/webhooks/stripe-identity`
   - Replace `YOUR-VERCEL-APP` with your actual Vercel app URL
5. Select events to listen to:
   - ✅ `identity.verification_session.verified`
   - ✅ `identity.verification_session.requires_input`
   - ✅ `identity.verification_session.canceled`
   - ✅ `identity.verification_session.processing`
6. Click **Add endpoint**
7. Copy the **Signing secret**: `whsec_...`

#### For Live Mode:
Repeat the same steps in **Live mode** with production URL.

**What you need:**
- Test webhook signing secret: `whsec_test_...`
- Live webhook signing secret: `whsec_...`

**Why**: Webhooks notify our app when verification status changes.

---

### 6. Stripe Identity Settings Review
**Ask**: "Let's review the Identity verification settings together."

**What to check:**
1. Go to **Identity** → **Settings**
2. Review **Verification options**:
   - Document verification: ✅ Enabled
   - Selfie verification: ✅ Enabled (recommended for security)
3. Review **Allowed document types**:
   - Passport
   - Driver's license
   - ID card
4. Review **Allowed countries**: Ensure target countries are enabled

**Why**: These settings determine what verification methods users can use.

---

## ✅ Checklist: What You Should Have After the Call

- [ ] Team member access to Stripe account
- [ ] Stripe Identity enabled and approved
- [ ] Test publishable key (`pk_test_...`)
- [ ] Test secret key (`sk_test_...`)
- [ ] Live publishable key (`pk_live_...`)
- [ ] Live secret key (`sk_live_...`)
- [ ] Test webhook signing secret (`whsec_test_...`)
- [ ] Live webhook signing secret (`whsec_...`)
- [ ] Webhook endpoints configured in Stripe
- [ ] Identity settings reviewed and approved

---

## 🔒 Security Best Practices

### During the Call:
- ✅ Use secure screen sharing (blur sensitive areas if recording)
- ✅ Request keys be sent via encrypted channel (1Password, LastPass share)
- ❌ DO NOT send keys via Slack, email, or SMS unencrypted
- ❌ DO NOT commit keys to Git repository

### After the Call:
- ✅ Store keys in Vercel environment variables immediately
- ✅ Store backup in secure password manager
- ✅ Delete any plaintext copies from chat apps or notes
- ✅ Verify test mode works before using live mode

---

## 📝 Adding Credentials to Project

**After you receive the credentials, add them to your environment:**

### Local Development (.env.local)
```bash
# Stripe API Keys (Test Mode)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...

# Stripe Webhook Secret
STRIPE_WEBHOOK_SECRET=whsec_test_...

# Stripe Identity (Test Mode)
NEXT_PUBLIC_STRIPE_IDENTITY_ENABLED=true
```

### Vercel Environment Variables
1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add each variable for **Production**, **Preview**, and **Development**:
   - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (use test key for Preview/Dev, live key for Production)
   - `STRIPE_SECRET_KEY` (use test key for Preview/Dev, live key for Production)
   - `STRIPE_WEBHOOK_SECRET` (use test secret for Preview/Dev, live secret for Production)
   - `NEXT_PUBLIC_STRIPE_IDENTITY_ENABLED` = `true`

---

## 🚨 Common Issues & Troubleshooting

### Issue 1: "Stripe Identity not available"
**Solution**: Identity must be enabled in Products section and may require business verification.

### Issue 2: "Invalid API key"
**Solution**: Ensure you're using the correct key for the mode (test vs live). Check for extra spaces.

### Issue 3: "Webhook signature verification failed"
**Solution**: Ensure the webhook signing secret matches the endpoint in Stripe dashboard.

### Issue 4: "Country not supported"
**Solution**: Enable additional countries in Identity settings.

---

# 🛠️ PART 2: IMPLEMENTATION PLAN FOR CLAUDE CODE

**This section is for Claude Code to execute after credentials are received.**

---

## Phase 3: ID Verification Implementation

**Estimated Time**: 4-5 hours
**Prerequisites**: All credentials from Part 1 obtained

---

## Step 1: Install Dependencies (15 minutes)

### Task: Install Stripe SDK
```bash
npm install stripe @stripe/stripe-js
```

### Files to Update:
- `package.json` - Will be updated automatically

**Verification**: Run `npm list stripe` to confirm installation

---

## Step 2: Database Schema Updates (30 minutes)

### Task: Create migration for verification tracking

**Create File**: `supabase/migrations/013_add_identity_verification.sql`

```sql
-- Add identity verification columns to partnerships table
ALTER TABLE partnerships
ADD COLUMN IF NOT EXISTS identity_verified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS verification_session_id TEXT,
ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;

-- Add index for querying verified partnerships
CREATE INDEX IF NOT EXISTS idx_partnerships_identity_verified
ON partnerships(identity_verified);

-- Add index for verification session lookups
CREATE INDEX IF NOT EXISTS idx_partnerships_verification_session
ON partnerships(verification_session_id);

-- Add comments for documentation
COMMENT ON COLUMN partnerships.identity_verified IS 'Whether partnership has completed Stripe Identity verification';
COMMENT ON COLUMN partnerships.verification_session_id IS 'Stripe Identity verification session ID';
COMMENT ON COLUMN partnerships.verified_at IS 'Timestamp when identity was successfully verified';

-- Update RLS policies to require verification for sensitive actions
-- Note: Existing policies remain, we'll add verification checks in application logic
```

**Apply Migration**:
1. Open Supabase Dashboard → SQL Editor
2. Paste the migration SQL
3. Execute
4. Verify with: `SELECT identity_verified, verification_session_id, verified_at FROM partnerships LIMIT 1;`

---

## Step 3: Stripe Configuration (20 minutes)

### Task: Create Stripe utility and configuration

**Create File**: `lib/stripe/config.ts`

```typescript
import Stripe from 'stripe';

// Validate environment variables
if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not set in environment variables');
}

// Initialize Stripe client (server-side only)
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-11-20.acacia', // Use latest API version
  typescript: true,
});

// Export configuration
export const stripeConfig = {
  publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!,
  identityEnabled: process.env.NEXT_PUBLIC_STRIPE_IDENTITY_ENABLED === 'true',
};

// Validate public key
if (!stripeConfig.publishableKey) {
  throw new Error('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not set');
}
```

**Create File**: `lib/stripe/client.ts` (for client-side usage)

```typescript
import { loadStripe } from '@stripe/stripe-js';

// Load Stripe.js (client-side only)
export const getStripePromise = () => {
  if (!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) {
    throw new Error('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not set');
  }

  return loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);
};
```

---

## Step 4: Server Actions for Verification (1 hour)

### Task: Create verification flow server actions

**Create File**: `lib/actions/identity-verification.ts`

```typescript
'use server';

import { createClient } from '@/lib/supabase/server';
import { stripe } from '@/lib/stripe/config';
import { revalidatePath } from 'next/cache';

/**
 * Creates a Stripe Identity verification session for the current partnership
 */
export async function createVerificationSession() {
  try {
    const supabase = await createClient();

    // Get current user's partnership
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    const { data: partnership, error: partnershipError } = await supabase
      .from('partnerships')
      .select('id, email, identity_verified, verification_session_id')
      .eq('user_id', user.id)
      .single();

    if (partnershipError || !partnership) {
      return { success: false, error: 'Partnership not found' };
    }

    // Check if already verified
    if (partnership.identity_verified) {
      return { success: false, error: 'Already verified' };
    }

    // Create Stripe Identity verification session
    const verificationSession = await stripe.identity.verificationSessions.create({
      type: 'document',
      metadata: {
        partnership_id: partnership.id,
        email: partnership.email,
      },
      options: {
        document: {
          require_matching_selfie: true, // Require selfie for extra security
        },
      },
    });

    // Save session ID to database
    const { error: updateError } = await supabase
      .from('partnerships')
      .update({ verification_session_id: verificationSession.id })
      .eq('id', partnership.id);

    if (updateError) {
      return { success: false, error: 'Failed to save verification session' };
    }

    return {
      success: true,
      clientSecret: verificationSession.client_secret,
      sessionId: verificationSession.id,
    };
  } catch (error) {
    console.error('Error creating verification session:', error);
    return { success: false, error: 'Failed to create verification session' };
  }
}

/**
 * Checks the current verification status
 */
export async function getVerificationStatus() {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    const { data: partnership, error } = await supabase
      .from('partnerships')
      .select('identity_verified, verification_session_id, verified_at')
      .eq('user_id', user.id)
      .single();

    if (error || !partnership) {
      return { success: false, error: 'Partnership not found' };
    }

    // If we have a session ID but not verified, check Stripe status
    if (partnership.verification_session_id && !partnership.identity_verified) {
      const session = await stripe.identity.verificationSessions.retrieve(
        partnership.verification_session_id
      );

      // Update local status if Stripe shows verified
      if (session.status === 'verified') {
        await supabase
          .from('partnerships')
          .update({
            identity_verified: true,
            verified_at: new Date().toISOString(),
          })
          .eq('user_id', user.id);

        revalidatePath('/');

        return {
          success: true,
          verified: true,
          verifiedAt: new Date().toISOString(),
        };
      }

      return {
        success: true,
        verified: false,
        status: session.status,
      };
    }

    return {
      success: true,
      verified: partnership.identity_verified,
      verifiedAt: partnership.verified_at,
    };
  } catch (error) {
    console.error('Error checking verification status:', error);
    return { success: false, error: 'Failed to check verification status' };
  }
}

/**
 * Manually refresh verification status from Stripe
 */
export async function refreshVerificationStatus() {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    const { data: partnership } = await supabase
      .from('partnerships')
      .select('id, verification_session_id')
      .eq('user_id', user.id)
      .single();

    if (!partnership?.verification_session_id) {
      return { success: false, error: 'No verification session found' };
    }

    // Fetch latest status from Stripe
    const session = await stripe.identity.verificationSessions.retrieve(
      partnership.verification_session_id
    );

    if (session.status === 'verified') {
      await supabase
        .from('partnerships')
        .update({
          identity_verified: true,
          verified_at: new Date().toISOString(),
        })
        .eq('id', partnership.id);

      revalidatePath('/');

      return { success: true, verified: true };
    }

    return { success: true, verified: false, status: session.status };
  } catch (error) {
    console.error('Error refreshing verification status:', error);
    return { success: false, error: 'Failed to refresh status' };
  }
}
```

---

## Step 5: Verification Page UI (1 hour)

### Task: Create identity verification page

**Create File**: `app/onboarding/verify-identity/page.tsx`

```typescript
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import {
  createVerificationSession,
  getVerificationStatus,
  refreshVerificationStatus,
} from '@/lib/actions/identity-verification';

// Import Stripe Identity Element
// Note: Implementation may vary based on Stripe's latest SDK
// Documentation: https://stripe.com/docs/identity/verification-sessions

export default function VerifyIdentityPage() {
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'ready' | 'verifying' | 'verified' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  useEffect(() => {
    checkStatus();
  }, []);

  async function checkStatus() {
    const result = await getVerificationStatus();

    if (!result.success) {
      setStatus('error');
      setError(result.error || 'Failed to check status');
      return;
    }

    if (result.verified) {
      setStatus('verified');
      // Redirect to next step after 2 seconds
      setTimeout(() => {
        router.push('/onboarding/membership');
      }, 2000);
      return;
    }

    setStatus('ready');
  }

  async function startVerification() {
    setStatus('verifying');
    setError(null);

    const result = await createVerificationSession();

    if (!result.success) {
      setStatus('error');
      setError(result.error || 'Failed to start verification');
      return;
    }

    setClientSecret(result.clientSecret || null);

    // Here you would initialize Stripe Identity Element
    // See Step 6 for the component implementation
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-[#E8E6E3] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#008080] animate-spin" />
      </div>
    );
  }

  if (status === 'verified') {
    return (
      <div className="min-h-screen bg-[#E8E6E3] flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-[#252627] mb-2">Identity Verified!</h1>
          <p className="text-gray-600 mb-4">
            Your identity has been successfully verified. Redirecting...
          </p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-[#E8E6E3] flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-[#252627] mb-2">Verification Error</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => {
              setStatus('ready');
              setError(null);
            }}
            className="px-6 py-3 bg-[#008080] text-white rounded-lg hover:bg-[#006666] transition"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#E8E6E3] flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
        <div className="text-center mb-6">
          <Shield className="w-16 h-16 text-[#008080] mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-[#252627] mb-2">Verify Your Identity</h1>
          <p className="text-gray-600">
            To ensure the safety and security of our community, we require identity verification for all partnerships.
          </p>
        </div>

        <div className="space-y-4 mb-6">
          <div className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-[#008080] mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="font-medium text-[#252627]">Quick & Secure</h3>
              <p className="text-sm text-gray-600">Takes less than 2 minutes to complete</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-[#008080] mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="font-medium text-[#252627]">Your Privacy Protected</h3>
              <p className="text-sm text-gray-600">Powered by Stripe Identity, bank-level encryption</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-[#008080] mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="font-medium text-[#252627]">Required Documents</h3>
              <p className="text-sm text-gray-600">Government-issued ID (passport, driver's license, or ID card)</p>
            </div>
          </div>
        </div>

        {status === 'ready' && (
          <button
            onClick={startVerification}
            className="w-full px-6 py-3 bg-[#008080] text-white rounded-lg hover:bg-[#006666] transition font-medium"
          >
            Start Verification
          </button>
        )}

        {status === 'verifying' && clientSecret && (
          <div className="border-2 border-[#008080] rounded-lg p-4">
            {/* Stripe Identity Element will be mounted here - See Step 6 */}
            <p className="text-center text-gray-600">Loading verification form...</p>
          </div>
        )}
      </div>
    </div>
  );
}
```

---

## Step 6: Stripe Identity Component (30 minutes)

### Task: Create reusable Stripe Identity verification component

**Create File**: `components/stripe/StripeIdentityVerification.tsx`

```typescript
'use client';

import { useEffect, useRef } from 'react';
import { loadStripe } from '@stripe/stripe-js';

interface Props {
  clientSecret: string;
  onVerified: () => void;
  onError: (error: string) => void;
}

export function StripeIdentityVerification({ clientSecret, onVerified, onError }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    initializeStripe();
  }, [clientSecret]);

  async function initializeStripe() {
    try {
      const stripe = await loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

      if (!stripe || !containerRef.current) {
        onError('Failed to load verification');
        return;
      }

      // Mount Stripe Identity Element
      // Documentation: https://stripe.com/docs/identity/verification-sessions#web
      const verificationSession = await stripe.verifyIdentity(clientSecret);

      if (verificationSession.error) {
        onError(verificationSession.error.message || 'Verification failed');
        return;
      }

      // Handle verification completion
      if (verificationSession.status === 'verified') {
        onVerified();
      }

      setMounted(true);
    } catch (error) {
      console.error('Stripe initialization error:', error);
      onError('Failed to initialize verification');
    }
  }

  return (
    <div ref={containerRef} className="w-full min-h-[400px]">
      {!mounted && (
        <div className="flex items-center justify-center h-[400px]">
          <Loader2 className="w-8 h-8 text-[#008080] animate-spin" />
        </div>
      )}
    </div>
  );
}
```

**Note**: The exact implementation depends on Stripe's latest SDK. Refer to: https://stripe.com/docs/identity/verification-sessions

---

## Step 7: Webhook Handler (1 hour)

### Task: Create API endpoint to handle Stripe webhooks

**Create File**: `app/api/webhooks/stripe-identity/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe/config';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

// Initialize Supabase admin client for webhook (bypasses RLS)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // Admin key needed for webhooks
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

/**
 * Webhook handler for Stripe Identity events
 * Events: identity.verification_session.verified, canceled, requires_input, processing
 */
export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'No signature' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    // Verify webhook signature
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (error) {
    console.error('Webhook signature verification failed:', error);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  // Handle the event
  try {
    switch (event.type) {
      case 'identity.verification_session.verified':
        await handleVerified(event.data.object as Stripe.Identity.VerificationSession);
        break;

      case 'identity.verification_session.requires_input':
        await handleRequiresInput(event.data.object as Stripe.Identity.VerificationSession);
        break;

      case 'identity.verification_session.canceled':
        await handleCanceled(event.data.object as Stripe.Identity.VerificationSession);
        break;

      case 'identity.verification_session.processing':
        await handleProcessing(event.data.object as Stripe.Identity.VerificationSession);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook handler error:', error);
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }
}

/**
 * Handle successful verification
 */
async function handleVerified(session: Stripe.Identity.VerificationSession) {
  const partnershipId = session.metadata?.partnership_id;

  if (!partnershipId) {
    console.error('No partnership_id in metadata');
    return;
  }

  // Update partnership as verified
  const { error } = await supabaseAdmin
    .from('partnerships')
    .update({
      identity_verified: true,
      verified_at: new Date().toISOString(),
      verification_session_id: session.id,
    })
    .eq('id', partnershipId);

  if (error) {
    console.error('Failed to update partnership:', error);
    throw error;
  }

  console.log(`Partnership ${partnershipId} verified successfully`);
}

/**
 * Handle verification requiring more input
 */
async function handleRequiresInput(session: Stripe.Identity.VerificationSession) {
  console.log(`Verification session ${session.id} requires additional input`);
  // Could send notification to user here
}

/**
 * Handle canceled verification
 */
async function handleCanceled(session: Stripe.Identity.VerificationSession) {
  const partnershipId = session.metadata?.partnership_id;

  console.log(`Verification session ${session.id} was canceled`);

  // Could update a status field or send notification
  if (partnershipId) {
    await supabaseAdmin
      .from('partnerships')
      .update({
        verification_session_id: null, // Allow retry
      })
      .eq('id', partnershipId);
  }
}

/**
 * Handle verification in processing state
 */
async function handleProcessing(session: Stripe.Identity.VerificationSession) {
  console.log(`Verification session ${session.id} is being processed`);
  // Just log for now - verification will complete via 'verified' event
}
```

**Important**: This route needs the `SUPABASE_SERVICE_ROLE_KEY` environment variable (admin key) to bypass RLS.

---

## Step 8: Update Onboarding Flow (30 minutes)

### Task: Add verification step to onboarding sequence

**Update File**: `app/onboarding/survey/page.tsx`

Find the completion redirect (around line 250-260) and update:

```typescript
// After survey completion, redirect to identity verification
if (allSectionsComplete) {
  router.push('/onboarding/verify-identity'); // Changed from /onboarding/membership
}
```

**Update File**: `app/onboarding/membership/page.tsx`

Add verification check at the top:

```typescript
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getVerificationStatus } from '@/lib/actions/identity-verification';

export default function MembershipPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkVerification();
  }, []);

  async function checkVerification() {
    const result = await getVerificationStatus();

    if (!result.success || !result.verified) {
      // Not verified - redirect back to verification
      router.push('/onboarding/verify-identity');
      return;
    }

    // Verified - continue with membership page
    setLoading(false);
  }

  if (loading) {
    return <div className="min-h-screen bg-[#E8E6E3] flex items-center justify-center">
      <Loader2 className="w-8 h-8 text-[#008080] animate-spin" />
    </div>;
  }

  // Rest of membership page code...
}
```

---

## Step 9: Feature Gating (30 minutes)

### Task: Require verification for sensitive features

**Update File**: `lib/actions/handshakes.ts`

Add verification check to `sendHandshakeRequest`:

```typescript
export async function sendHandshakeRequest(targetId: string, message: string) {
  try {
    const supabase = await createClient();

    // Get sender's partnership
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    const { data: senderPartnership, error: senderError } = await supabase
      .from('partnerships')
      .select('id, identity_verified') // Added identity_verified
      .eq('user_id', user.id)
      .single();

    if (senderError || !senderPartnership) {
      return { success: false, error: 'Partnership not found' };
    }

    // NEW: Require verification before sending handshakes
    if (!senderPartnership.identity_verified) {
      return {
        success: false,
        error: 'Please verify your identity before sending handshake requests',
        requiresVerification: true,
      };
    }

    // Rest of existing handshake logic...
  } catch (error) {
    console.error('Error sending handshake:', error);
    return { success: false, error: 'Failed to send handshake request' };
  }
}
```

**Update File**: `components/handshake/SendHandshakeModal.tsx`

Handle verification requirement:

```typescript
async function handleSubmit(e: React.FormEvent) {
  e.preventDefault();
  setLoading(true);
  setError(null);

  const result = await sendHandshakeRequest(targetPartnershipId, message);

  if (!result.success) {
    // Check if verification is required
    if (result.requiresVerification) {
      setError('Please verify your identity first');
      // Could also redirect: router.push('/onboarding/verify-identity');
    } else {
      setError(result.error || 'Failed to send request');
    }
    setLoading(false);
    return;
  }

  // Success - rest of existing code...
}
```

---

## Step 10: Add Verification Badge (15 minutes)

### Task: Show verified badge on profiles

**Create File**: `components/profile/VerificationBadge.tsx`

```typescript
import { ShieldCheck } from 'lucide-react';

interface Props {
  verified: boolean;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export function VerificationBadge({ verified, size = 'md', showLabel = false }: Props) {
  if (!verified) return null;

  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  return (
    <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-blue-50 rounded-full">
      <ShieldCheck className={`${sizeClasses[size]} text-blue-600`} />
      {showLabel && (
        <span className="text-xs font-medium text-blue-600">Verified</span>
      )}
    </div>
  );
}
```

**Update File**: `components/matches/PartnershipCard.tsx`

Add verification badge display:

```typescript
import { VerificationBadge } from '@/components/profile/VerificationBadge';

// In the render, add badge next to name:
<div className="flex items-center gap-2 mb-2">
  <h3 className="text-xl font-bold text-[#252627]">
    {partnership.name}
  </h3>
  <VerificationBadge verified={partnership.identity_verified} size="sm" />
</div>
```

---

## Step 11: Environment Variables (5 minutes)

### Task: Ensure all environment variables are set

**Check `.env.local`**:
```bash
# Stripe API Keys
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...

# Stripe Webhook Secret
STRIPE_WEBHOOK_SECRET=whsec_test_...

# Stripe Identity
NEXT_PUBLIC_STRIPE_IDENTITY_ENABLED=true

# Supabase Admin (for webhooks)
SUPABASE_SERVICE_ROLE_KEY=eyJh... # Get from Supabase dashboard
```

**Verify Vercel Environment Variables**:
- All above variables added to Vercel
- Correct values for each environment (Preview vs Production)

---

## Step 12: Testing (1 hour)

### Task: Test complete verification flow

**Test Checklist**:
- [ ] Navigate to `/onboarding/verify-identity`
- [ ] Click "Start Verification"
- [ ] Complete Stripe Identity verification with test mode
- [ ] Verify webhook received (check Vercel logs or Stripe dashboard)
- [ ] Verify database updated (`identity_verified = true`)
- [ ] Verify redirect to membership page
- [ ] Try sending handshake (should work now)
- [ ] Try sending handshake from unverified account (should be blocked)
- [ ] Verify badge appears on profile

**Test Documents** (Stripe Test Mode):
Stripe provides test document numbers for testing:
- Use test mode to avoid real document submission
- See: https://stripe.com/docs/identity/testing

---

## Step 13: Update Database with Migration (5 minutes)

### Task: Apply migration to production database

**Steps**:
1. Open Supabase Dashboard
2. Navigate to SQL Editor
3. Run migration 013 (created in Step 2)
4. Verify columns added
5. Test queries to ensure no errors

---

## Step 14: Deploy to Staging (15 minutes)

### Task: Deploy verification feature to staging

**Steps**:
1. Commit all changes: `git add . && git commit -m "feat: Add Stripe Identity verification"`
2. Push to GitHub: `git push origin main`
3. Verify Vercel deployment succeeds
4. Check Vercel logs for any errors
5. Test staging environment end-to-end

---

## Step 15: Production Deployment (15 minutes)

### Task: Deploy to production with live Stripe keys

**Pre-deployment Checklist**:
- [ ] All tests passing in staging
- [ ] Live Stripe API keys added to Vercel production environment
- [ ] Live webhook endpoint configured in Stripe
- [ ] Database migration applied to production
- [ ] Monitoring/error tracking configured (Sentry)

**Deploy**:
1. Ensure main branch is stable
2. Vercel will auto-deploy to production
3. Verify production environment variables
4. Test production verification with real ID (recommended: test with your own ID first)

---

## 🎯 Post-Implementation Verification

### Success Criteria:
- ✅ Users can complete identity verification
- ✅ Webhooks update database correctly
- ✅ Unverified users cannot send handshakes
- ✅ Verified badge appears on profiles
- ✅ Onboarding flow includes verification step
- ✅ No errors in production logs

### Monitoring:
- Check Stripe Dashboard → Identity for verification sessions
- Monitor Vercel logs for webhook errors
- Check Supabase for verification status updates
- Track verification completion rates

---

## 🚨 Rollback Plan

If critical issues arise:

1. **Quick Fix**: Disable verification requirement
   ```typescript
   // In lib/actions/handshakes.ts
   // Comment out verification check temporarily
   // if (!senderPartnership.identity_verified) { ... }
   ```

2. **Full Rollback**: Revert deployment
   ```bash
   git revert <commit-hash>
   git push origin main
   ```

3. **Database Rollback**: Remove columns (if needed)
   ```sql
   ALTER TABLE partnerships
   DROP COLUMN IF EXISTS identity_verified,
   DROP COLUMN IF EXISTS verification_session_id,
   DROP COLUMN IF EXISTS verified_at;
   ```

---

## 📝 Final Checklist

Before marking Phase 3 complete:

- [ ] All code files created and tested
- [ ] Database migration applied
- [ ] Environment variables configured
- [ ] Webhooks configured in Stripe
- [ ] End-to-end testing completed
- [ ] Staging deployment successful
- [ ] Production deployment successful
- [ ] No errors in logs
- [ ] User can complete full flow
- [ ] Documentation updated

---

## 📚 Resources

- [Stripe Identity Documentation](https://stripe.com/docs/identity)
- [Stripe Identity Verification Sessions](https://stripe.com/docs/identity/verification-sessions)
- [Stripe Webhooks Guide](https://stripe.com/docs/webhooks)
- [Stripe Testing](https://stripe.com/docs/identity/testing)

---

**Estimated Total Time**: 4-5 hours
**Status After Completion**: HAEVN platform 100% ready for production launch
**Next Phase**: Production monitoring and user feedback

---

**Document Version**: 1.0
**Last Updated**: October 10, 2025
**For Use With**: HAEVN-STARTER-INTERFACE
