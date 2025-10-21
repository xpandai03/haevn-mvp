# 🔍 Root Cause: Session Persists in Server Cookies

## 🚨 THE ACTUAL BUG

**The problem is NOT in React state or localStorage!**

The issue is a **client-server session mismatch**:

1. **Client-side** (`lib/auth/context.tsx`):
   - Uses browser Supabase client
   - Stores session in **localStorage** as `'haevn-auth'`
   - `signOut()` clears localStorage ✅

2. **Server-side** (`lib/actions/survey-user.ts`):
   - Uses server Supabase client via `lib/supabase/server.ts`
   - Reads session from **HTTP cookies** (NOT localStorage!)
   - Calls `await supabase.auth.getUser()` to get current user

---

## 💥 Why user.id Stays the Same

### The Flow (Broken):

```
1. User A signs up (tester32@test.com)
   ├─ Browser: session → localStorage['haevn-auth']
   ├─ Server: session → HTTP cookies (sb-*-auth-token)
   └─ getUserSurveyData() reads from cookies → user.id = abc-123

2. User A signs out
   ├─ signOut() clears localStorage ✅
   ├─ signOut() calls supabase.auth.signOut()
   └─ ❌ BUT: HTTP cookies might not be cleared!

3. User B signs up (tester33@test.com)
   ├─ Browser: new session → localStorage['haevn-auth']
   ├─ Server: ??? (depends if cookies cleared)
   └─ getUserSurveyData() reads from cookies → OLD user.id = abc-123 ❌
```

**Result:** Server-side `getUserSurveyData()` reads old cookies, returns old user_id!

---

## 🔬 Evidence

### File: `lib/supabase/server.ts:6-34`

```typescript
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()  // ← Reads HTTP cookies
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, { ... })  // ← Sets HTTP cookies
          })
        },
      },
    }
  )
}
```

**This creates a server client that:**
- Reads session from Next.js cookies
- Does NOT read from localStorage
- Completely separate from browser client!

### File: `lib/actions/survey-user.ts:18-29`

```typescript
export async function getUserSurveyData() {
  const supabase = await createClient()  // ← Server client (reads cookies)

  const { data: { user }, error: userError } = await supabase.auth.getUser()  // ← Gets user from cookies!

  console.log('[getUserSurveyData] Loading survey for user:', user.id)
  // ← This user.id comes from cookies, not localStorage!
}
```

**The server action:**
- Uses server Supabase client
- Calls `getUser()` which reads from HTTP cookies
- If cookies weren't cleared, returns old user!

---

## ❓ Why Doesn't signOut Clear Cookies?

### Current signOut implementation:

```typescript
const signOut = async () => {
  // Clear localStorage
  localStorage.removeItem('haevn-auth')  // ✅ Client-side only

  // Call Supabase signOut
  await supabase.auth.signOut()  // ← Uses BROWSER client, not server client!
}
```

**The issue:**
- `supabase` in auth context is the BROWSER client (`lib/supabase/client.ts`)
- Browser client can't directly manipulate HTTP cookies (browser security)
- Supabase SSR is supposed to sync cookies, but might not be working

---

## ✅ The Fix

We need to clear cookies **server-side** when signing out.

### Option 1: Use Server Action for SignOut (RECOMMENDED)

Create a server action that clears cookies:

```typescript
// lib/actions/auth.ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

export async function serverSignOut() {
  const supabase = await createClient()

  // Sign out via server client (clears cookies)
  await supabase.auth.signOut()

  // Manually clear any remaining auth cookies
  const cookieStore = await cookies()
  const allCookies = cookieStore.getAll()

  // Clear all Supabase auth cookies
  allCookies.forEach(cookie => {
    if (cookie.name.startsWith('sb-') && cookie.name.includes('auth')) {
      cookieStore.delete(cookie.name)
    }
  })
}
```

Then call from client:

```typescript
// lib/auth/context.tsx
const signOut = async () => {
  // Clear localStorage
  localStorage.removeItem('haevn-auth')
  localStorage.removeItem('haevn_onboarding')

  // Clear server-side cookies via server action
  await serverSignOut()

  // Clear React state
  setSession(null)
  setUser(null)
}
```

### Option 2: Redirect to Server Route

Create an API route that handles signout:

```typescript
// app/api/auth/signout/route.ts
import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST() {
  const supabase = await createClient()
  await supabase.auth.signOut()

  // Clear cookies
  const cookieStore = await cookies()
  const allCookies = cookieStore.getAll()

  allCookies.forEach(cookie => {
    if (cookie.name.startsWith('sb-') && cookie.name.includes('auth')) {
      cookieStore.delete(cookie.name)
    }
  })

  return NextResponse.json({ success: true })
}
```

---

## 🧪 How to Verify

### Test 1: Check Cookies in DevTools

1. Sign in as user
2. Open DevTools → Application → Cookies
3. Look for cookies starting with `sb-`
4. Sign out
5. **Check:** All `sb-*-auth-*` cookies should be GONE
6. If cookies remain → Bug still exists

### Test 2: Check Server Logs

1. Sign up as tester100
2. Fill survey
3. Sign out
4. Sign up as tester101
5. Go to survey
6. **Check terminal:**
   ```
   [getUserSurveyData] Loading survey for user: <NEW_USER_ID>
   [getUserSurveyData] No existing data found
   ```
7. If shows "Found existing data" → Server still has old cookies

---

## 📊 Full System Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ CLIENT-SIDE (Browser)                                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  AuthContext (lib/auth/context.tsx)                        │
│  └─ uses: browser Supabase client                          │
│     └─ stores session in: localStorage['haevn-auth']       │
│                                                             │
│  signOut() clears:                                         │
│  ✅ localStorage['haevn-auth']                              │
│  ❌ HTTP cookies (can't access from browser JS)            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                           ↕
                    (HTTP Requests)
                           ↕
┌─────────────────────────────────────────────────────────────┐
│ SERVER-SIDE (Next.js Server Actions)                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  getUserSurveyData() (lib/actions/survey-user.ts)         │
│  └─ uses: server Supabase client                           │
│     └─ reads session from: HTTP cookies (sb-*-auth-token)  │
│                                                             │
│  If cookies not cleared:                                   │
│  ❌ getUser() returns OLD user from cookies                 │
│  ❌ Survey data loaded for WRONG user                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**The gap:**
- Client clears localStorage ✅
- Server reads cookies ❌
- No synchronization between them!

---

## 🎯 Summary

**Problem:**
- Client-side signOut clears localStorage
- Server-side getUserSurveyData reads from cookies
- Cookies not cleared → Server returns old user → Survey data leaks

**Solution:**
- Create server action to clear cookies
- Call it from client signOut
- Ensure both localStorage AND cookies are cleared

**Why this wasn't caught earlier:**
- We focused on React state and localStorage
- Didn't realize server actions use separate cookie-based auth
- Next.js App Router separates client/server execution contexts

---

**Next Steps:**
1. Implement `serverSignOut()` server action
2. Update auth context to call server action
3. Test cookie clearing in DevTools
4. Verify new user gets new user.id

This is the REAL fix!
