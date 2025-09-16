# HAEVN Discovery Feature

## Overview
Implemented a complete discovery/matching system with compatibility scoring and proper gating.

## Key Components

### 1. Compatibility Scoring (`lib/matching/stub.ts`)
- Deterministic scoring algorithm (0-100)
- Weighs 3 key dimensions:
  - **Intent alignment** (40 points): What users are looking for
  - **Relationship structure** (35 points): Mono/poly/open compatibility
  - **Privacy alignment** (25 points): Discretion preferences
- Bonus points for lifestyle matches
- Buckets: High (≥75), Medium (45-74), Low (<45)

### 2. Gates System (`hooks/useGates.ts`)
Three protection layers:
- **useSurveyGate**: Ensures 100% survey completion
- **useCityGate**: Checks if user's city is live
- **useMembershipGate**: Verifies subscription tier

### 3. MatchCard Component (`components/MatchCard.tsx`)
- NO photos (privacy-first until handshake)
- Shows: Name, score, bucket, badges
- Like button disabled for free users
- Upgrade CTA for free tier

### 4. Connections Page (`app/connections/page.tsx`)
- Three tabs: High / Medium / Low matches
- Real-time compatibility calculation
- Enforces all gates before access
- Falls back to demo data if no DB

### 5. Data Helpers (`lib/data/partnerships.ts`)
- `getCurrentUserPartnership()`: Gets logged-in user's partnership
- `getCandidatePartnerships()`: Fetches potential matches
- `getPartnershipDisplayName()`: Formats names (Alex & Jordan)

## How It Works

### User Flow:
1. User completes survey → Unlocks discovery
2. Navigate to `/connections`
3. See matches bucketed by compatibility
4. Free users can browse but not like
5. Plus/Select users can send likes
6. Mutual likes create handshakes (separate feature)

### Scoring Example:
```javascript
User A: Looking for "Dating, Friendship", Polyamorous, Open privacy
User B: Looking for "Dating, Casual", Open relationship, Open privacy
Score: ~85 (High Match)

User A: Looking for "Marriage", Monogamous, Very private
User B: Looking for "Casual", Polyamorous, Open privacy
Score: ~25 (Low Match)
```

## Testing Without Database

The system includes demo partnerships that work without Supabase:
- Alex Chen & Jordan Smith (Open/Poly)
- Sam Wilson (Monogamous)

These appear automatically when no real data exists.

## Gating Rules

✅ **Survey Gate**: Redirects to `/onboarding/survey` if incomplete
✅ **City Gate**: Shows waitlist message if city not live
✅ **Membership Gate**: Shows upgrade CTA if free tier

## Access Points

- Dashboard → Connections tile → `/connections`
- Direct URL: `http://localhost:3000/connections`

## Next Steps

1. Implement signal tracking (likes/passes)
2. Add handshake creation on mutual likes
3. Build chat system for matched partnerships
4. Add photo reveal after handshake
5. Implement blocking/reporting