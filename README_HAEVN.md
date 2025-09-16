# HAEVN App - Core Implementation

## What's Been Built

### User Flow (Fully Connected)
1. **Landing Page** (`/`) → Buttons connect to signup
2. **Signup** (`/auth/signup`) → City check with ZIP code validation
3. **Survey** (`/onboarding/survey`) → Multi-step with save/resume
4. **Membership** (`/onboarding/membership`) → Tier selection (Free/Plus/Select)
5. **Dashboard** (`/dashboard`) → 3 pillars with gating logic
6. **Discovery** (`/discovery`) → Placeholder with enforcement
7. **Chat** (`/chat`) → Placeholder with handshake requirement

### Key Features Implemented

#### City Check System
- ZIP codes mapped to cities (NYC, LA, SF = live; Chicago, Austin = waitlist)
- Waitlist users can complete survey but not access discovery
- Test ZIPs: 10001 (NYC-live), 60601 (Chicago-waitlist)

#### Survey System
- 4 sections: Identity, Intentions, Boundaries, Logistics
- Auto-saves to localStorage
- Progress tracking (0-100%)
- Blocks discovery until 100% complete

#### Membership Gating
- Free: Can view dashboard but no discovery/chat
- Plus ($19.99): Full discovery, chat after handshake
- Select ($49.99): Premium features (stubbed)

#### Dashboard
- Connections pillar: Locked until survey complete + paid membership
- Events/Resources: Coming Phase 2
- Visual indicators for locked features

### Data Storage
Currently using localStorage for:
- User data (haevn_user)
- Survey responses (haevn_survey_responses)

### To Run
```bash
npm run dev
# Visit http://localhost:3000
```

### Testing Flow
1. Click any button on landing page
2. Enter name, email, password
3. Try ZIP 10001 (NYC-live) or 60601 (Chicago-waitlist)
4. Complete survey (or save & exit)
5. Choose membership tier
6. Explore dashboard with appropriate gating

### Next Steps for Production
- Replace localStorage with Supabase
- Implement real Stripe payments
- Add photo upload/management
- Build actual matching algorithm
- Create real chat system with websockets
- Add partner invitation system