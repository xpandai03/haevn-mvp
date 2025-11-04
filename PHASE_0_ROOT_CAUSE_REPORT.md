# Phase 0: Root Cause Analysis Report
**Generated:** 2025-11-04
**Issue:** Persistent 400 Bad Request on `GET /rest/v1/user_survey_responses`

---

## Executive Summary

**ROOT CAUSE IDENTIFIED:** The `OnboardingFlowController.getResumeStep()` method is bundled into client-side JavaScript and executes Supabase queries directly from the browser using a **browser client** (createBrowserClient).

**Why This is the Problem:**
1. The browser client uses the anon key and is subject to Row Level Security (RLS)
2. When RLS policies fail or the query is invalid, Supabase returns 400 Bad Request
3. The `getResumeStep()` method is called by **client components** during render, not server-side

**Location:** Chunk file `9154-3a919c5c8c0722b6.js` (9.2KB)
**Source:** `lib/onboarding/flow.ts` → `OnboardingFlowController` class → `getResumeStep()` method

---

## Part 1: Repository Search Results

### A. Direct References to `user_survey_responses`

**Server-side (Legitimate):**
- ✅ `middleware.ts:70-72` - Uses server client with defensive guard
- ✅ `middleware.ts:193-197` - Uses server client with defensive guard
- ✅ `app/api/survey/load/route.ts:89-94` - API route with admin client
- ✅ `app/api/survey/save/route.ts:95,130` - API route with admin client

**Client-side (PROBLEMATIC):**
- ❌ **FOUND IN BUNDLE:** `lib/onboarding/flow.ts:274-278` - `getResumeStep()` method
  - Line 274: `await this.supabase.from("user_survey_responses")`
  - This entire method is bundled into client JavaScript
  - Called by client components during auth initialization

### B. Client Component Usage

**All these client components import and use the flow controller:**
```
app/auth/signup/SignupForm.tsx         - 'use client'
app/auth/login/page.tsx                - 'use client'
app/onboarding/identity/page.tsx       - 'use client'
app/onboarding/payment/page.tsx        - 'use client'
app/onboarding/expectations/page.tsx   - 'use client'
app/onboarding/welcome/page.tsx        - 'use client'
app/onboarding/survey-intro/page.tsx   - 'use client'
app/onboarding/verification/return/page.tsx - 'use client'
app/onboarding/verification/page.tsx   - 'use client'
app/onboarding/celebration/page.tsx    - 'use client'
app/onboarding/survey/page.tsx         - 'use client'
app/onboarding/membership/page.tsx     - 'use client'
components/onboarding/OnboardingLayout.tsx - 'use client'
```

### C. Browser Client References

**Browser client is properly isolated in `lib/supabase/client.ts`:**
```typescript
import { createBrowserClient } from '@supabase/ssr'

export const supabase = createBrowserClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
```

**The factory function in `lib/onboarding/flow.ts:410-414` creates browser client:**
```typescript
export function getClientOnboardingFlowController(): OnboardingFlowController {
  const { createClient } = require('@/lib/supabase/client')
  const supabase = createClient()
  return new OnboardingFlowController(supabase)  // ❌ THIS GETS BUNDLED
}
```

---

## Part 2: Bundle Scan Results

### Offending Chunk: `9154-3a919c5c8c0722b6.js`

**File size:** 9.2KB
**Contains:** 2 occurrences of `"user_survey_responses"`

**Webpack module ID:** 87520
**Exported functions:**
- `getClientOnboardingFlowController` (exported as `i`)
- `ONBOARDING_STEPS` (exported as `kd`)
- `OnboardingFlowController` class (class `n`)

**Key Evidence from Bundle:**

```javascript
// Module 87520 - lib/onboarding/flow.ts (minified)
class n {
  async getResumeStep(e) {
    try {
      console.log("[FLOW] ===== GET RESUME STEP =====");

      // ❌ FIRST QUERY - partnership_members (OK)
      let{data:r}=await this.supabase
        .from("partnership_members")
        .select("partnership_id, survey_reviewed, role")
        .eq("user_id",e)
        .maybeSingle();

      // ❌ SECOND QUERY - user_survey_responses (PROBLEMATIC!)
      let{data:n,error:i}=await this.supabase
        .from("user_survey_responses")  // ← THIS EXECUTES IN BROWSER
        .select("completion_pct")
        .eq("partnership_id",t)
        .maybeSingle();

      // ... rest of logic
    } catch(e) {
      return "/dashboard"
    }
  }

  constructor(e){
    this.supabase=e  // ← Browser client passed in
  }
}

function i(){
  let{createClient:e}=t(46414);  // ← imports lib/supabase/client
  return new n(e())  // ← Creates instance with BROWSER client
}
```

**Module 46414** is `lib/supabase/client.ts`:
```javascript
let n=(0,o(45673).createBrowserClient)(
  "https://sdepasybfkmxcswaxnsz.supabase.co",
  "eyJhbGc...UZOgbI"  // ← ANON KEY (public)
)
```

---

## Part 3: Source Mapping

### Call Chain Analysis

```
User loads page (e.g., /dashboard)
  ↓
AuthProvider initializes (lib/auth/context.tsx)
  ↓
onAuthStateChange fires
  ↓
Calls getResumeStep(user.id)  ← Client-side function
  ↓
OnboardingFlowController.getResumeStep()  ← Client-side method
  ↓
this.supabase.from("user_survey_responses")  ← BROWSER CLIENT
  ↓
HTTP GET /rest/v1/user_survey_responses?partnership_id=eq.xxx
  ↓
RLS Policy Check (using anon key)
  ↓
❌ 400 Bad Request (RLS failure or invalid query)
```

### Why getResumeStep() is in the Bundle

**The Problem:**
1. `lib/onboarding/flow.ts` exports **both** server and client factory functions
2. Client components import `getClientOnboardingFlowController`
3. **Webpack bundles the entire OnboardingFlowController class** including `getResumeStep()`
4. The class contains direct Supabase queries in its methods
5. When instantiated with browser client, these queries execute client-side

**Why Previous Fixes Didn't Work:**
- ✅ We fixed middleware to use server client → Correct
- ✅ We fixed API routes to use admin client → Correct
- ✅ We added defensive guards → Correct
- ❌ But `getResumeStep()` is still callable from client-side code
- ❌ AuthProvider or other client components call it during initialization
- ❌ This triggers the browser to make direct REST calls

---

## Part 4: Evidence of Client-Side Execution

### Browser Network Tab Shows:
```
Request URL: https://sdepasybfkmxcswaxnsz.supabase.co/rest/v1/user_survey_responses?
  select=completion_pct&
  partnership_id=eq.xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
Request Method: GET
Status Code: 400 Bad Request
```

### Console Logs Show:
```
[FLOW] ===== GET RESUME STEP =====
[FLOW] Getting resume step for user: xxx
[FLOW] Partnership membership: {hasPartnership: true, ...}
[FLOW] ✅ Guard active before user_survey_responses query: xxx
[FLOW] ❌ Error fetching survey: <error message>
```

**These console logs prove the method executes in the browser**, not on the server.

---

## Conclusion

**The `OnboardingFlowController.getResumeStep()` method should NEVER be called from client-side code.**

It was designed to run on the server (middleware, route handlers) where it can use:
- Server-side Supabase client (SSR cookies)
- Service role bypassing RLS
- Secure environment variables

But because the entire class is bundled into client JavaScript via `getClientOnboardingFlowController()`, client components can instantiate it and call `getResumeStep()`, which then:
1. Uses the browser client (anon key)
2. Makes direct REST calls to Supabase
3. Fails with 400 if RLS denies access or query is invalid

**Solution:** Remove database queries from client-accessible methods, or create API routes for this logic.

---

## Part 5: Client-Side Call Sites (CONFIRMED)

### Offending Client Components Making Direct Calls

**1. app/auth/login/page.tsx:55** ('use client')
```typescript
const flowController = getClientOnboardingFlowController()
const resumePath = await flowController.getResumeStep(signInData.session.user.id)
// ❌ This executes in browser, triggers REST call
```

**2. app/auth/signup/SignupForm.tsx:91** ('use client')
```typescript
const flowController = getClientOnboardingFlowController()
const resumePath = await flowController.getResumeStep(user.id)
router.push(resumePath)
// ❌ This executes in browser, triggers REST call
```

**3. app/auth/callback/route.ts:28** (Server Component - OK)
```typescript
const flowController = await getServerOnboardingFlowController()
const resumePath = await flowController.getResumeStep(session.user.id)
// ✅ This is correct - uses server client
```

### Call Frequency Analysis

**When does the 400 error occur?**
- Every time a user logs in → login/page.tsx calls it
- Every time a user signs up → SignupForm.tsx calls it
- After authentication on any protected page load

**Why middleware isn't catching it:**
- Middleware runs on the **server** and uses the server client correctly
- But **after middleware passes**, client components hydrate and execute their code
- Login/signup components call `getResumeStep()` from **client-side code**
- This creates a race: middleware query succeeds, client query fails

---

## Recommended Fix (Phase 3 Preview)

**Option A: Remove getResumeStep from client bundle**
- Make `getResumeStep()` server-only
- Create API route `/api/onboarding/resume-step`
- Client components fetch this route instead

**Option B: Separate client and server classes**
- Split into `ClientFlowController` (no DB queries) and `ServerFlowController` (with DB queries)
- Ensure webpack can tree-shake server code

**Preferred:** Option A - cleanest separation of concerns
