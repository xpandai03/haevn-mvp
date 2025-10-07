Based on the pending tasks, I'll break this
     into bite-sized phases that can be 
    completed, tested, and pushed to Git one at
     a time.

    ---
    🎯 PHASE 1: Profile Data & Settings 
    Consolidation (30-45 min)

    What We're Building:

    - Consolidate /settings into 
    /partner-profile 
    - Add settings/edit mode to partner profile
    - Create redirect from old settings page
    - Ensure all profile data persists 
    correctly

    Tasks:

    1. Update partner-profile to include 
    editable fields
      - Add "Edit Profile" button/mode toggle
      - Include inline editing for: 
    display_name, bio, relationship goals
      - Integrate photo upload directly in 
    partner profile
    2. Add redirect from /settings → 
    /partner-profile
      - Create redirect in 
    /app/settings/page.tsx
      - Show toast: "Settings moved to Partner 
    Profile"
    3. Update navigation links
      - Dashboard "Settings" button → 
    /partner-profile
      - Any menu items pointing to settings
    4. Verify data persistence
      - Test: Edit display name → refresh → 
    still shows
      - Test: Upload photo → refresh → avatar 
    persists
      - Test: Update bio → refresh → bio 
    persists

    Git Commit:

    Consolidate settings into partner profile 
    page

    - Redirect /settings to /partner-profile
    - Add edit mode to PartnerProfile component
    - Integrate photo upload in profile view
    - Update navigation to use partner-profile

    Acceptance Criteria:
    ✅ /settings redirects to /partner-profile
    ✅ Can edit profile fields inline
    ✅ Photo upload accessible from partner 
    profile
    ✅ All changes persist after refresh

    ---
    🎯 PHASE 2A: Handshake Data Layer (30 min)

    What We're Building:

    - Database tables for partnership 
    invites/requests
    - Server actions for creating and accepting
     handshakes
    - Real-time updates when partnership forms

    Tasks:

    1. Create migration for 
    partnership_requests table
    CREATE TABLE partnership_requests (
      id UUID PRIMARY KEY,
      from_user_id UUID REFERENCES 
    auth.users(id),
      to_email TEXT,
      partnership_id UUID REFERENCES 
    partnerships(id),
      status TEXT CHECK (status IN ('pending', 
    'accepted', 'declined')),
      code TEXT UNIQUE,
      created_at TIMESTAMPTZ
    )
    2. Create server actions
      - createPartnershipInvite(email) - sends 
    invite
      - acceptPartnershipInvite(code) - joins 
    partnership
      - checkPendingInvites(userId) - shows 
    pending
    3. Add RLS policies
      - Users can create invites for their 
    partnerships
      - Users can see invites sent to their 
    email
      - Users can accept invites with valid 
    code

    Git Commit:

    Add partnership invitation system (data 
    layer)

    - Create partnership_requests table
    - Add server actions for invite/accept flow
    - Configure RLS policies for invitations

    Acceptance Criteria:
    ✅ Can insert partnership_requests via 
    server action
    ✅ RLS blocks unauthorized access
    ✅ Invite codes are unique and secure

    ---
    🎯 PHASE 2B: Handshake UI Flow (45 min)

    What We're Building:

    - "Invite Partner" modal on partner profile
    - Pending invite banner when invite exists
    - Accept invite flow for invited users

    Tasks:

    1. Create InvitePartnerModal component
      - Input: partner email
      - Button: "Send Invite"
      - Shows: Invite code after sending
      - Copies code to clipboard
    2. Add pending invite banner
      - Shows on partner profile if user has 
    pending invite
      - "You have a partnership invite from X"
      - Button: "Accept Invite" or "Decline"
    3. Update usePartnerStats hook
      - Check for pending invites
      - Update hasPartnership based on accepted
     invite
      - Refresh avatar after partnership formed
    4. Add "Invite Partner" button to profile
      - Shows when user has NO partnership
      - Opens InvitePartnerModal
      - Disabled when invite already sent

    Git Commit:

    Implement partnership invitation UI

    - Add InvitePartnerModal component
    - Show pending invite banner
    - Handle invite acceptance flow
    - Update partner profile with invite button

    Acceptance Criteria:
    ✅ Can send invite via modal
    ✅ Invited user sees banner
    ✅ Accept button creates partnership
    ✅ Profile updates immediately after accept

    ---
    🎯 PHASE 3: Dashboard Stats Integration (45
     min)

    What We're Building:

    - Real dashboard with live stats from 
    Supabase
    - Matches, Connections, Nudges cards
    - Links to detailed views

    Tasks:

    1. Update dashboard to use real stats
      - Remove mock getMatches('Bronze') call
      - Use getPartnershipStats() for real data
      - Show: Matches (count from partnerships 
    in city)
      - Show: Nudges (count from signals table)
      - Show: Connections (count from 
    handshakes table)
    2. Add navigation cards
      - "View Matches" → /matches page
      - "View Connections" → /connections page 
     
      - "View Nudges" → /nudges page
    3. Create placeholder pages
      - /app/matches/page.tsx - "Coming soon"
      - /app/connections/page.tsx - "Coming 
    soon"
      - /app/nudges/page.tsx - "Coming soon"
    4. Add "Go to Partner Profile" CTA
      - Prominent button on dashboard
      - Links to /partner-profile

    Git Commit:

    Connect dashboard to live stats

    - Use real Supabase data for 
    Matches/Nudges/Connections
    - Add navigation to detailed view pages
    - Create placeholder pages for 
    matches/connections/nudges
    - Add Partner Profile CTA

    Acceptance Criteria:
    ✅ Dashboard shows real counts from 
    database
    ✅ Clicking cards navigates to detail pages
    ✅ "Partner Profile" button works
    ✅ No mock data remains

    ---
    🎯 PHASE 4: Design Polish Pass (30 min)

    What We're Building:

    - Visual consistency across all pages
    - Brand compliance check
    - Typography and spacing refinement

    Tasks:

    1. Typography audit
      - Headings: Roboto Black (900)
      - Labels: Roboto Medium (500)
      - Body: Roboto Light (300)
      - Update any off-brand weights
    2. Color audit
      - Background: #E8E6E3
      - Navy: #1E2A4A
      - Gold: #E29E0C
      - Teal: #008080
      - Text: #252627
      - Replace any incorrect colors
    3. Logo placement
      - All pages: 75px minimum height
      - Consistent padding/clearspace
      - Use HaevnLogo component everywhere
    4. Spacing consistency
      - Card padding: p-6
      - Section gaps: space-y-6
      - Page margins: max-w-7xl mx-auto
      - Mobile responsive: p-4

    Git Commit:

    Design polish - brand compliance pass

    - Standardize typography weights (Roboto 
    Black/Medium/Light)
    - Enforce brand colors across all pages
    - Consistent logo sizing and placement
    - Unified spacing with Tailwind tokens

    Acceptance Criteria:
    ✅ All text uses correct Roboto weights
    ✅ All colors match brand guide
    ✅ Logo consistent across pages
    ✅ Spacing uniform on mobile/desktop

    ---
    🎯 PHASE 5: Deployment Prep (30 min)

    What We're Building:

    - Vercel deployment configuration
    - Environment variable setup
    - Production testing checklist

    Tasks:

    1. Create Vercel project
      - Connect GitHub repo
      - Set environment variables:
          - NEXT_PUBLIC_SUPABASE_URL
        - NEXT_PUBLIC_SUPABASE_ANON_KEY
        - SUPABASE_SERVICE_ROLE_KEY
    2. Test production build locally
    npm run build
    npm start
      - Fix any build errors
      - Test critical flows
    3. Create deployment checklist
      - Auth: Login → Onboarding → Dashboard 
    works
      - Profile: Can edit fields, upload photos
      - Mobile: Responsive on iPhone/Android 
    sizes
      - Performance: Lighthouse score >90
    4. Deploy to staging
      - Push to staging branch
      - Get Vercel preview URL
      - Share for testing

    Git Commit:

    Add Vercel deployment configuration

    - Configure build settings
    - Add environment variable template
    - Create production testing checklist
    - Deploy to staging environment

    Acceptance Criteria:
    ✅ Build completes without errors
    ✅ Environment variables configured
    ✅ Staging URL accessible
    ✅ All critical flows work in production

    ---
    📋 Implementation Order

    Session 1 (1.5 hrs)

    1. ✅ Phase 1 - Profile consolidation (45 
    min)
    2. ✅ Phase 2A - Handshake data layer (30 
    min)
    3. ⏸️ Git push + break

    Session 2 (1.5 hrs)

    4. ✅ Phase 2B - Handshake UI (45 min)
    5. ✅ Phase 3 - Dashboard stats (45 min)
    6. ⏸️ Git push + break

    Session 3 (1 hr)

    7. ✅ Phase 4 - Design polish (30 min)
    8. ✅ Phase 5 - Deployment (30 min)
    9. 🚀 Final push to production

    ---
    🔄 Git Workflow

    After each phase:
    # Test the feature
    npm run dev
    # Verify it works

    # Commit and push
    git add .
    git commit -m "Phase X: [description]"
    git push origin main

    # Quick break, then next phase

    ---
    ⚠️ Key Dependencies

    Phase 1 requires:
    - Photo upload working (✅ Done)
    - usePartnerStats hook (✅ Done)
    - PartnerProfile component (✅ Done)

    Phase 2 requires:
    - Phase 1 complete
    - Supabase migration applied

    Phase 3 requires:
    - Partnership data working
    - Stats hooks functional

    Phase 4 requires:
    - All pages built
    - Components finalized

    Phase 5 requires:
    - Everything working locally
    - No critical bugs

    ---
    🎯 Success Metrics

    By end of all phases:
    - ✅ User can invite + accept partnership
    - ✅ Dashboard shows real stats
    - ✅ Profile editing works seamlessly
    - ✅ Design matches brand guide 100%
    - ✅ App deployed to staging
    - ✅ All code pushed to Git

    Estimated Total Time: 3-4 hours

    Ready to start with Phase 1?





