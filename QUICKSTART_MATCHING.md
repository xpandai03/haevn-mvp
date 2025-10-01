# HAEVN Matching - 5-Minute Quick Start

## Step 1: Run Database Migrations (2 minutes)

1. Open your Supabase project → SQL Editor
2. Copy and paste `MATCHING_MIGRATION.sql`
3. Click "Run"
4. Wait for "Success" ✅

## Step 2: Seed Test Users (2 minutes)

1. **First, get real user IDs:**
   ```sql
   SELECT id, email FROM auth.users LIMIT 5;
   ```
   Copy 4 different user IDs

2. **Edit `SEED_TEST_MATCHES.sql`:**
   - Replace the `owner_id` values on lines:
     - Line 18: First user ID
     - Line 44: Second user ID
     - Line 70: Third user ID
     - Line 96: Fourth user ID

3. **Run the seed file:**
   - Paste edited SQL into Supabase SQL Editor
   - Click "Run"

## Step 3: Test Locally (1 minute)

```bash
npm run dev
```

Open http://localhost:3000

## Step 4: Test the Flow

1. **Log in** with one of the seed users
2. **Go to** `/dashboard`
3. **You should see:**
   - Match count by tier
   - 2-3 match cards
   - Click a card → modal opens ✅

---

## Troubleshooting

### "No matches found"
- Check: Did you seed data with **real** user IDs?
- Check: Is the logged-in user one of the 4 seed users?
- Check: Does `partnerships` table have the new columns? Run:
  ```sql
  SELECT column_name FROM information_schema.columns
  WHERE table_name = 'partnerships' AND column_name = 'identity';
  ```

### "Not authenticated" error
- Check: Is user logged in? Check auth state
- Check: Does user have a partnership? Run:
  ```sql
  SELECT * FROM partnership_members WHERE user_id = 'YOUR_USER_ID';
  ```

### "Failed to fetch matches"
- Check: Are server actions working? Check console
- Check: Is `lib/matching/scoring.ts` compiled? No TS errors?

---

## Quick Validation Test

Run the test suite to confirm scoring works:

```bash
npx tsx lib/matching/scoring.test.ts
```

Expected output:
```
✅ PASS: High Match (86/100 - Platinum)
✅ PASS: Excluded (0/100 - Identity mismatch)
✅ PASS: Multiple matches sorted by score
```

---

## What You Built

- ✅ Full scoring engine (6 weighted factors)
- ✅ Dashboard with matches
- ✅ Match cards + modal
- ✅ Score breakdown
- ✅ Tier system (Platinum/Gold/Silver/Bronze)

**Total time:** ~2 hours build + 5 minutes setup = **Ready to demo!** 🎉
