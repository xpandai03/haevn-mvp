# HAEVN — Emergent Demo vs. Live App: Full UI/UX Gap Analysis

**Date:** 2026-06-03
**Author:** Frontend engineering (investigation only — no app files modified)
**Goal:** Document every discrepancy between the Emergent design demo and the live HAEVN app so we can systematically close gaps toward the client's "zero variation" requirement.

**Sources:**
- Emergent demo source (cloned): `https://github.com/xpandai03/haevn-emergent-demo.git` → `frontend/src/` (Create-React-App / craco, React Router, `.jsx`, **Outfit** font)
- Emergent demo live preview: `https://dashboard-demo-9.preview.emergentagent.com/?utm_source=share`
- Live HAEVN app source: this repo (`/Users/raunekpratap/Desktop/haevn-mvp`, Next.js App Router, `.tsx`, Cabinet Grotesk / `font-heading`)
- Live HAEVN app: `https://haevn.app`

> **Method note on live browsing.** Playwright is not installed in this environment, and both targets resist headless fetching (the Emergent preview is a client-rendered SPA that returns only "Loading…"; HAEVN gates everything behind auth). The comparison below is therefore driven by **source-code inspection of both codebases**, which is the authoritative reference for "what the demo actually renders." Where a live visual nuance can't be confirmed from code, it's flagged as `[verify in browser]`.

---

## 1. Executive Summary

The live app and the demo now share the same **information architecture and most page-level structure** (sidebar, match cards, match detail, chat, profile, upgrade nudge, Match Monday framing). The remaining gaps are concentrated in a few areas:

| # | Area | Severity | One-line gap |
|---|------|----------|--------------|
| 1 | **Meetups page** | 🔴 HIGH | Live app organizes by **activity type** (Coffee/Drinks/Activity/Dinner) with emoji cards + a 5-venue placeholder list. Demo organizes by **neighborhood accordions** (7 neighborhoods × 5 venues) with "Best for" copy and external links. Completely different page. |
| 2 | **Top context bar** | 🔴 HIGH | Demo has a black sticky context bar — `Viewing as Emily · Austin · Long-term` + a **"View as HAEVN+ Member"** toggle (and the inverse on the plus side). Live app's black bar just says **"HAEVN"** with no context text and no view toggle. |
| 3 | **Hidden page** | 🔴 HIGH | Demo ships a working Hidden Matches screen (pass → hide → restore). Live app's "Hidden" nav item is a disabled **"Soon"** stub that fires a toast. |
| 4 | **Match detail view** | 🟠 MED | Demo is a rich single scroll: hero photo → identity → big % → AI intro → **"Why this match works" 5-dimension expandable accordion** → contextual actions (Connect/Message/Nudge) → free-tier "Unlock this match" benefits list. Live app routes to a generic `/profiles/[id]` (shared profile component) with a 2×2 **Message/Nudge/Block/Report** button grid and a `🔒` full-screen gate for free users — no compatibility-dimension accordion, no nudge-vs-connect logic, no upgrade-benefits list. |
| 5 | **Match card details** | 🟠 MED | Live card is missing: per-card **Nudge-to-Connect flow** for free matches, the **"Where you might differ" contrast** line, the **Connect/Message/Pass action row**, and the free-tier **"Nudge received"** banner. Live card is click-only (no inline actions). |
| 6 | **Chat — icebreakers & feedback** | 🟠 MED | Live chat has the meetup-pin bottom-sheet ✅ but is **missing AI "Suggested opening lines" (icebreakers)** on the empty state, and there is **no post-date check-in / feedback card**. |
| 7 | **Matches "system signal" banner** | 🟡 LOW | Demo shows an "It's Match Monday — X of N revealed" → "You currently have N matches above 80% alignment / Click username to view full profile" banner above the grid. Live app has the header subtitle only, no in-grid signal banner or the "Click username" hint. |
| 8 | **Typography & surface tints** | 🟡 LOW | Demo uses **Outfit** for everything; live uses Cabinet Grotesk headings + a different body font. Demo screen backgrounds alternate `#FAFAF8` and `#EEECEA`; verify the live cream matches. |
| 9 | **Sidebar nav order** | 🟡 LOW | Demo sidebar order: Matches · Messages · **Hidden · Meetups** · Profile. Live order: Matches · Messages · **Meetups · Hidden** · Profile. (Demo bottom-nav order differs again — see §6.) |
| 10 | **Profile "Demo Controls"** | ⚪ N/A | Demo profile has a "Switch to Free/HAEVN+" demo toggle — intentionally **not** wanted in production. Listed for completeness only. |

**Estimated effort to reach "zero variation":** ~1 high-effort page rebuild (Meetups), ~2 medium rebuilds (Match detail, Match card actions), ~3 medium additions (context bar + view toggle, Hidden screen, chat icebreakers + check-in), plus polish (banner, fonts). Roughly **3–5 focused days**.

---

## 2. Reference: Demo Routing & Architecture

The demo is a single React app with two parallel "tenant" layouts, selected up-front:

- `/demo-member/*` → `DemoLayout mode="member"` (free user, `isFreeUser = true`)
- `/demo-plus/*` → `DemoLayout mode="plus"` (HAEVN+ user)
- `/demo-admin/*` → hidden `AdminLayout` + `SelectorPage` (internal view switcher)

Inside a layout, the routes are:

| Demo route | Screen file | Live HAEVN equivalent |
|---|---|---|
| `/…/matches` | `pages/MatchesScreen.jsx` | `app/dashboard/matches/page.tsx` |
| `/…/match/:id` | `pages/MatchDetailScreen.jsx` | `app/profiles/[id]/page.tsx` (generic) |
| `/…/messages` | `pages/MessagesScreen.jsx` | `app/messages/page.tsx` |
| `/…/messages/:id` | `pages/ConversationScreen.jsx` | `app/chat/[connectionId]/page.tsx` |
| `/…/guide` (labeled **"Meetups"**) | `pages/MatchGuideScreen.jsx` | `app/dashboard/meetups/page.tsx` |
| `/…/hidden` | `pages/HiddenMatchesScreen.jsx` | *none (nav stub "Soon")* |
| `/…/profile` | `pages/ProfileScreen.jsx` | `app/profile/page.tsx` |

**Key insight:** in the demo, the "Meetups" nav item routes to `/guide` → `MatchGuideScreen`, which is the neighborhood venue guide. There is no separate "match guide" concept in the live app — the live `/dashboard/meetups` is the page that must match `MatchGuideScreen`.

Shared chrome: `DemoLayout` renders a black **context bar** (top, sticky, `z-60`), an optional teal **upgrade nudge** banner (member only, after 15 s), the desktop `Sidebar`, and the mobile `BottomNav`. Demo brand colors (`tailwind.config.js`): gold `#E29E0C`, teal `#008080`, navy `#1E2A4A`, "cream" `#E8E6E3`. Screen bg `#FAFAF8`; Matches/Meetups bg `#EEECEA`.

---

## 3. Page-by-Page Comparison

### 3.1 Entry / Landing

**Emergent Demo** (`DemoEntryPage.jsx` → `DemoLoadingPage` → `DemoLoginPage` → `DemoSplashPage` → `IntroPage` → `SelectorPage`)
- Black full-screen entry: heading **"This is what Match Monday feels like"**, a tappable `phone-mockup.png` push-notification image, subcopy "Tap the notification to enter", backup link "Open Match Monday".
- `SelectorPage` (internal): HAEVN wordmark + "Select a view to preview", two big cards — **HAEVN+ / With Matches** and **Member / With Matches** — plus two text links for the "No Matches Yet" states.

**Live HAEVN App**
- Entry is the real auth flow (`app/auth/*`, onboarding). Out of scope per brief.

**Gaps** — Not directly comparable; the demo entry funnel is a demo artifact. **No action** (auth handled separately). The one reusable idea is the "Match Monday" framing, which the live app already echoes on the Matches header.
**Priority:** ⚪ N/A

---

### 3.2 Matches Page

**Emergent Demo** — `pages/MatchesScreen.jsx`
- Bg `#EEECEA`. Mobile sticky header (logo + "Austin" + Member/HAEVN+ pill). Desktop header: **"Your Matches"** (3xl) + subtitle `"{N} curated matches based on your survey"` + a **"Change View"** outline link.
- **System Signal banner** (white card) above the grid:
  - During reveal: **"It's Match Monday"** / "Your matches are arriving — {revealed} of {N} revealed".
  - After reveal: "You currently have **{N} matches above 80% alignment**" / "New matches are evaluated weekly" / bold teal **"Click username to view full profile."**
- **Staggered reveal:** first card at 800 ms, then one every 700 ms (opacity + translate-y).
- **Post-date check-in** card (HAEVN+ + a mutually-ready connected match): "Post-date check-in / You and {name} made plans to meet" with 3 buttons — **We clicked / It was okay / Not a match** (green/amber/red) → confirmation copy → Dismiss.
- Grid: `md:grid-cols-2 xl:grid-cols-3`. Renders `MatchCard` per match.
- Hidden-matches link at the bottom when any are hidden: "👁 {N} hidden matches".
- Free users get a fixed bottom **UpgradeBar** ("Unlock your matches" + "Upgrade to HAEVN+").

**Live HAEVN App** — `app/dashboard/matches/page.tsx` + `components/dashboard/ProfileCard.tsx`
- Header: eyebrow **"Match Monday"** + **"Your Matches"** (3xl/4xl) + subtitle `"{N} matches curated for you this week."` / empty: "New matches are released every Monday at 8 AM ET."
- Staggered reveal via framer-motion: first at 200 ms, then 700 ms each (opacity + y:12). ✅ close.
- Grid `sm:grid-cols-2 lg:grid-cols-3`. Renders `ProfileCard variant="match"`.
- Empty state is a custom "Your matches are being curated." block with a "While you wait" list.
- Cards are **click-only**: free → `/onboarding/membership`; plus → `/profiles/{id}`.

**Gaps**
1. **No "system signal" banner.** Live app has no in-grid "It's Match Monday — X of N revealed" / "N matches above 80% alignment" / **"Click username to view full profile"** card. (Demo: `MatchesScreen.jsx:170-196`.) — 🟡 LOW
2. **No post-date check-in card** on the Matches screen (`MatchesScreen.jsx:198-279`). The live "Ready to Meet" lives on the card but there's no post-meet feedback loop anywhere. — 🟠 MED (also see §5.3 chat)
3. **No "Change View" link / view toggle** (tied to the context-bar gap, §3.10). — 🟡 LOW
4. **No bottom "UpgradeBar"** of the demo's exact form ("Unlock your matches"). Live app's `UpgradeBar` is a teal nudge with different copy and 15 s delay (matches the demo's *nudge banner*, not its persistent bottom bar). — 🟡 LOW
5. **Empty-state copy differs** (demo: "Your matches are being curated / Check back on Match Monday" with optional upgrade box; live: "being curated." + "While you wait" list). — 🟡 LOW
6. Mobile per-screen header (logo + "Austin" + tier pill) — live relies on global chrome instead. — 🟡 LOW

**Priority:** 🟠 MEDIUM (banner + check-in are the substantive ones)

---

### 3.3 Match Card (the card itself)

**Emergent Demo** — `components/MatchCard.jsx`
- **HAEVN+ view:** 3/4 photo (lightbox on click) → `Name, age` + HAEVN+ badge → `Gender · Sexuality · Structure · Distance` → big gold **`{N}%` Match** → up to 3 teal **signal pills** → italic **AI intro** (`line-clamp-3`) → **"Where you might differ"** contrast line → optional **Ready to Meet** control → **action row**.
- **Action row logic:**
  - `default` + plus → gold **Connect** button + red **X (pass)**.
  - `connected` + plus → teal **Message** button.
  - Non-Plus match (free counterpart) → navy **"Nudge to Connect"** button + red X + helper "{name} is on the free plan. Nudge to invite them to upgrade…" → after click: "Nudge Sent" / "{name} has been notified".
- **Free-user view:** silhouette w/ "Upgrade to view", redacted name `D***`, truncated AI intro + "Unlock to read more", and a **"Nudge received"** banner when `hasNudgedYou` ("This HAEVN+ member wants to connect with you. Upgrade to respond."). No action buttons.
- **Ready to Meet** (plus + connected): toggles to a green "Both ready to meet" panel with handshake icon and "use the meetup pin in your conversation to find a halfway spot."

**Live HAEVN App** — `ProfileCard variant="match"`
- Photo band `h-[168px]` (shorter than demo's 3/4) → `Name, age` → demographics line → gold `{N}% Match` → up to 3 teal signal pills ✅ → italic `topFactor` line (`line-clamp-2`, single derived "Top factor: …" string, **not** a written AI intro) → optional **Ready to Meet** ("Meet IRL" + `ReadyToMeetButton`).
- **Locked (free) view:** `SilhouetteOverlay` with **"Unlock to Connect"** + redacted `D***` + "Full match context is available to HAEVN+ members." + "Tap the card or upgrade below…". ✅ close to demo.
- **The whole card is one big button** → no inline Connect/Message/Pass/Nudge actions.

**Gaps**
1. **No inline action row** — no **Connect**, **Message**, or **Pass (X)** buttons on the card. (Demo `MatchCard.jsx:265-339`.) — 🟠 MED
2. **No per-card Nudge-to-Connect flow** for free counterpart matches, incl. the navy button + "is on the free plan" helper + "Nudge Sent" state. — 🟠 MED
3. **No "Where you might differ" contrast line** (`MatchCard.jsx:225-235`). — 🟡 LOW
4. **No "Nudge received" banner** on the free-user card (`hasNudgedYou`). — 🟡 LOW
5. **AI intro is a derived label, not prose.** Demo shows a 3-line written `aiIntro` paragraph + "Unlock to read more"; live shows a single "Top factor: X" sentence. — 🟠 MED (content/data gap; needs AI-generated per-match blurb)
6. **Photo aspect differs:** demo 3/4 portrait (`aspect-[3/4]`) vs live fixed `h-[168px]` band. — 🟡 LOW
7. **Photo lightbox on card** (`PhotoLightbox`) not present on live card. — 🟡 LOW
8. Free silhouette label wording: demo "Upgrade to view" (on the image) vs live "Unlock to Connect". — ⚪ trivial

**Priority:** 🟠 MEDIUM

---

### 3.4 Match Detail / Expanded View

**Emergent Demo** — `pages/MatchDetailScreen.jsx` (`/…/match/:id`)
- Reached by clicking the card's identity/photo. Single scrolling page, NOT a modal.
- Fixed back arrow (top-left). **Hero image** (`aspect-[3/2] md:aspect-[16/7]`, gradient fade) or silhouette + "Upgrade to view" for free.
- White content card overlapping the hero (`-mt-8`): **`Name, age`** + HAEVN+ badge → big gold **`{N}%` Match** + "This match is based on your alignment across five key areas" → **AI intro** paragraph (free: truncated + gradient + "Unlock to read more").
- **"Why this match works"** section → "A closer look at your alignment" → **5 expandable dimension rows**:
  - `Goals & Expectations`, `Structure Fit`, `Boundaries & Comfort`, `Openness & Curiosity`, `Sexual Energy`.
  - Each row: label + summary; expand (plus only) → strength chip (e.g. "Strong Alignment") + detail paragraph + **bulleted checklist** (teal checks).
  - Free users see summaries only + a **"See full alignment details / Unlock with HAEVN+"** CTA.
- **Actions:** contextual — Connect / Message / Nudge-to-Connect (navy) + Pass (X); identical status logic to the card.
- **Free-only "Unlock this match"** panel: benefits list with icons — **View photos · Read full profile · See full alignment breakdown · Connect instantly** + "Upgrade to HAEVN+".

**Live HAEVN App** — clicking a match goes to **`/profiles/[id]`** (`app/profiles/[id]/page.tsx` → shared `ProfileContent`)
- This is the **generic profile view** (same component used for connections/own profile), not a bespoke match-detail screen.
- Free users hit a **full-screen `🔒` gate**: "Unlock to View Profile / Full profiles, messaging, and connections are available to HAEVN+ members." + "Upgrade to HAEVN+" / "Go Back". (So free users **never** see a match detail at all.)
- Plus users: header (back + name) → `ProfileContent` (survey-data driven) → a **2×2 button grid: Message / Nudge / Block / Report**.

**Gaps**
1. **No bespoke match-detail screen.** Live reuses the generic profile page; there is **no hero photo treatment, no big "{N}% Match", no AI intro, and no "Why this match works" 5-dimension expandable accordion.** This is the single biggest detail-view gap. (Demo `MatchDetailScreen.jsx:197-285`.) — 🔴 HIGH
2. **Free users see a hard gate, not a teaser.** Demo deliberately shows free users the redacted detail (silhouette, summaries, "Unlock this match" benefits list) to drive upgrade; live blocks entirely. — 🟠 MED
3. **Actions differ:** demo = Connect/Message + Nudge-to-Connect + Pass; live = Message/Nudge/Block/Report grid. No Connect, no Pass, no nudge-vs-connect status logic. Block/Report don't exist in the demo. — 🟠 MED
4. **No "Unlock this match" benefits panel** (View photos / Read full profile / See full alignment breakdown / Connect instantly). — 🟠 MED
5. **Compatibility dimension data** exists in the demo as written prose per dimension (`mockData.js makeDimensions`), but the live card/detail only has numeric `breakdown` scores → needs AI-written summary/detail/bullets per dimension to fully match. — 🟠 MED (data/content)

**Priority:** 🔴 HIGH

---

### 3.5 Messages (conversation list)

**Emergent Demo** — `pages/MessagesScreen.jsx`
- Header "Messages" + "Your active conversations". White bordered list; each row: avatar, name, timestamp, last-message preview, gold unread dot.
- **Free users:** rows are dimmed (`opacity-60`), avatars are silhouettes, names redacted, preview replaced with **"Upgrade to HAEVN+ to message"**, clicks `preventDefault`.
- New connections without a thread show italic teal "You connected — start the conversation".

**Live HAEVN App** — `app/messages/page.tsx`
- Header eyebrow **"Inbox"** + "Messages" + "Your active conversations" ✅. `dash-card` list with divide-y rows: avatar, first-name, time, preview (+ "You:" prefix), orange unread badge (count, "9+").
- **Free users:** a warning banner — "You're viewing as a Member. Upgrade to HAEVN+ to open chats and send messages." (+ Upgrade link). Rows themselves are not individually redacted/dimmed the way the demo does.
- Empty state: MessageCircle + "No conversations yet" + "View matches".

**Gaps**
1. Free-tier treatment differs: demo redacts **each row** (silhouette avatar, `D***`, per-row "Upgrade to HAEVN+ to message", dimmed, non-clickable); live shows **one top banner** with normal rows below. — 🟡 LOW
2. Unread indicator: demo gold **dot** vs live orange **count badge**. — ⚪ trivial
3. "You connected — start the conversation" new-thread italic state — verify live equivalent (`formatConversationPreviewText`). — 🟡 LOW

**Priority:** 🟡 LOW (structurally aligned)

---

### 3.6 Chat / Conversation View

**Emergent Demo** — `pages/ConversationScreen.jsx`
- Header: back + round avatar + name. Messages: own = navy bubble (right), them = white bordered (left), timestamps, image support.
- **Empty state with AI icebreakers (HAEVN+ only):** avatar + "You matched with {name}" + "Start the conversation — say something intentional." → **"✨ Suggested opening lines"** → 3 tappable icebreaker buttons (per-match, from `MOCK_ICEBREAKERS`) that prefill the input → footnote "Based on your alignment with {name}".
- **Input row:** image button (`ImagePlus`) + **meetup pin** (`MapPin`, HAEVN+ only) + text input + gold Send.
- **Meetup bottom sheet** (`MapPin` → slide-up): "📍 Suggested meetup spot" → venue name + descriptor + neighborhood + **"You: ~11 min / {name}: ~13 min"** distances + "Roughly halfway between the two of you" → teal **"Share in conversation"** → posts a `📍 How about {venue}? …` message.

**Live HAEVN App** — `app/chat/[connectionId]/page.tsx` + `components/chat/MeetupChatCard.tsx`
- Plus-gated (free → `/onboarding/membership`). Header (back + avatar + name → profile). Own = **orange** bubble, them = white/teal-border. Image upload ✅.
- **Meetup pin** (`MapPin`) → inline preview panel (not a bottom sheet) with a placeholder **Blue Bottle Coffee** card ("Based on your shared preference for coffee dates") → Share/Cancel → renders a `MeetupChatCard` (amber bubble) in-thread. ✅ feature present, different presentation.
- Empty state: Send icon + "No messages yet" + "Say hello to {name}".

**Gaps**
1. **No AI icebreakers / "Suggested opening lines"** on the chat empty state (`ConversationScreen.jsx:232-257`). This is a notable missing HAEVN+ feature. — 🟠 MED
2. **Meetup suggestion presentation differs:** demo = **slide-up bottom sheet** with halfway-distance estimates ("You: ~11 min / {name}: ~13 min") + "Roughly halfway between the two of you"; live = **inline preview panel**, single placeholder venue, no per-user distances. — 🟠 MED
3. **Own-bubble color:** demo **navy** `#1E2A4A` vs live **orange** (`bg-haevn-orange`). — 🟡 LOW (pick one; "zero variation" → navy)
4. The demo's shared meetup message is plain text with 📍; live posts a structured `MeetupChatCard`. Live is arguably nicer, but it's a variation. — 🟡 LOW
5. **No post-date check-in/feedback card** in chat or after meetup (demo puts it on Matches; live has neither). — 🟠 MED
6. Legacy `components/ChatConversation.tsx` (photo-grant toggle, date dividers) appears unused — ignore, but don't ship it. — ⚪ N/A

**Priority:** 🟠 MEDIUM

---

### 3.7 Meetups Page  🔴 #1 KNOWN GAP — see full deep-dive in §5.1

**Emergent Demo** — `pages/MatchGuideScreen.jsx` + `data/matchGuideData.js`
- Title **"Meetup Spots"**, intro: *"If you're looking for a good spot to meet up with your new connection, check out these local spots"*.
- **Neighborhood accordions** (first open by default). 7 neighborhoods, 5 venues each. Each row: venue name + type badge (with icon) + descriptor + teal **"Best for: …"** + external-link icon. Section header shows "{N} spots".
- Bg `#EEECEA`.

**Live HAEVN App** — `app/dashboard/meetups/page.tsx` + `lib/meetups/placeholderVenues.ts`
- Title **"Meetups"**, eyebrow "HAEVN Austin", intro about "Curated spots … placeholders while we onboard local partners".
- **Activity-type filter pills** (All / Coffee / Drinks / Activity / Dinner) + a **3-col grid of emoji venue cards** (emoji + type badge + name + "neighborhood · distance" + description + **"Suggest to match"** button → toast). Only **5 placeholder venues** total.

**Gaps** — fundamentally different organization, data, copy, and interaction. **Full detail + extracted data in §5.1.**
**Priority:** 🔴 HIGH

---

### 3.8 Hidden Page  🔴 see deep-dive §5.4

**Emergent Demo** — `pages/HiddenMatchesScreen.jsx`
- Real screen. Header "Hidden Matches" + "Matches you've passed on. You can restore them at any time." List of compact rows (`Name, age` + "{N}% match · {distance}") each with a **Restore** button (`RotateCcw`). Empty: "No hidden matches". Passing a card on Matches hides it here; Matches shows a "👁 {N} hidden matches" link.

**Live HAEVN App**
- **No page.** Sidebar/BottomNav "Hidden" item is `href="#hidden"` + `comingSoon: true` → click fires a **"Hidden — coming soon"** toast and shows a "Soon" label (sidebar) / 45% opacity (mobile).

**Gaps** — entire feature missing; plus the upstream "Pass/Hide" affordance on cards is missing too (§3.3). The latest spec adds a **30-day clear/expire** rule not present in the demo (demo restores manually, no expiry). — 🔴 HIGH
**Priority:** 🔴 HIGH

---

### 3.9 Profile Page

**Emergent Demo** — `pages/ProfileScreen.jsx`
- **Hero:** primary-photo banner (`h-96`/`28rem`, click → lightbox) + overlapping 40×40 circular avatar → `Name, age` → "{city} · Member since {month year}" → **inline stats**: Matches / Connection / Plan.
- **AI Summary** card: "Your Profile Summary" + "What HAEVN understands about you" + paragraph.
- **Photos accordion** ("Your Photos — {N}/6 · Tap the star to set your primary") with grid, upload slot, set-primary/delete.
- **Account** rows (Display Name / Email / Password "Reset" / Verification "Verified" badge).
- **Plan & Billing** (Free → Upgrade button; Plus → "6-Month Season · Renews Aug 2026" + "Manage billing").
- **Preferences** (Notifications / Privacy / Matching Preferences).
- **Danger Zone** (Pause Account / Cancel Account).
- **Demo Controls** ("Switch to Free/HAEVN+") + "Back to view selector" — demo-only.

**Live HAEVN App** — `app/profile/page.tsx` + `components/profile/ProfilePhotoHero.tsx`
- Mirrors the demo closely ✅: hero (banner + avatar + "Manage photos" FAB), stats row (Matches/Connections/Plan), AI Summary ("Your Profile Summary" + "What HAEVN understands about you" + generate CTA), Photos accordion, Account rows, Plan & Billing, Preferences, Danger Zone, Sign Out.

**Gaps**
1. Demo avatar is **40×40** overlapping a tall banner; live is **32–40** (`h-32 sm:h-40`). Verify visual parity. — 🟡 LOW
2. Demo stats use a **bare layout** vs live cards; verify label parity ("Connection" singular in demo). — ⚪ trivial
3. **"Manage photos" FAB** is orange in live; demo opens lightbox/edit differently. — ⚪ trivial
4. Demo "Demo Controls" + "Back to view selector" — **intentionally excluded** from production. — ⚪ N/A
5. Plan copy differs (demo "6-Month Season · Renews Aug 2026" vs live "Active membership · Manage from billing"). — ⚪ trivial

**Priority:** 🟡 LOW (structurally aligned — strongest match of any page)

---

### 3.10 Navigation & Chrome  🔴 see deep-dive §5.5

**Emergent Demo**
- **Context bar** (black, sticky, top): member → *"Viewing as **Emily** · Austin · Long-term"* + animated chevron + **"View as HAEVN+ Member"**; plus → *"**HAEVN+** · Full access enabled"* + **"View as Member"**.
- **Upgrade nudge** (teal `#008080`, member only, after 15 s, dismissible): "You're seeing this as a Member. Connections require access." + "View as HAEVN+ Member".
- **Sidebar** (desktop, `w-64`): logo + "Austin Network" → **Matches · Messages · Hidden · Meetups · Profile** → tier pill footer. Active = gold text on `#F9F5EB`.
- **BottomNav** (mobile): **Matches · Messages · Meetups · Hidden · Profile** (note: Hidden/Meetups order is swapped vs sidebar). Active = gold.

**Live HAEVN App**
- **Black bar** = just the word **"HAEVN"** (a "sponsor bar"), centered, no context text, no view toggle.
- **UpgradeBar** = teal, free only, 15 s, dismissible, copy "You're viewing as a Member. Upgrade to HAEVN+ to unlock full profiles, connect, and message." + "Upgrade" → `/onboarding/membership`. ✅ close to the demo nudge.
- **Sidebar:** logo + "Austin Network" → **Matches · Messages · Meetups · Hidden(Soon) · Profile** → user name + tier pill (click → sign out). Active = `font-medium` + gold (via `dash-nav-link`).
- **BottomNav:** **Matches · Messages · Meetups · Hidden(Soon) · Profile**, active gold.

**Gaps**
1. **No context bar** with "Viewing as Emily · Austin · Long-term" / "HAEVN+ · Full access enabled". The black bar shows only "HAEVN". — 🔴 HIGH (explicitly called out in brief)
2. **No "View as HAEVN+ Member" / "View as Member" toggle.** — 🔴 HIGH
3. **Nav order:** live = Matches·Messages·**Meetups·Hidden**·Profile; demo sidebar = Matches·Messages·**Hidden·Meetups**·Profile (and demo bottom-nav = Meetups·Hidden). Pick the demo's intended order. — 🟡 LOW
4. "Hidden" is live but **disabled ("Soon")** vs the demo's working link. — 🔴 HIGH (see §3.8)
5. Active-state styling: demo uses explicit gold bg `#F9F5EB`; live uses a utility class — verify the active pill background matches. — 🟡 LOW

**Priority:** 🔴 HIGH (context bar + view toggle)

---

## 4. Free vs Paid & Mobile

**Free vs Paid (demo behaviors to mirror):**
- Match card: silhouette + redacted name + truncated intro + "Nudge received" banner; no actions. ✅ partially live (silhouette/redaction yes; banner/actions no).
- Match detail: free sees redacted teaser + "Unlock this match" benefits; **live blocks with a hard gate** ❌.
- Messages: free rows redacted/dimmed + "Upgrade to message" per row; **live uses one banner** ⚠️.
- Chat / icebreakers / meetup pin: **HAEVN+ only** in both ✅.
- Sidebar/profile tier pill: Member vs HAEVN+ ✅.

**Mobile:**
- Demo has per-screen sticky mobile headers (Matches, Messages, Profile, Meetups, Hidden) with the logo/title; live leans on global chrome + page headers. Verify mobile headers match.
- Demo bottom nav order differs from sidebar (Meetups before Hidden). Live keeps them consistent. Decide canonical order.
- Meetups: demo mobile header "Meetup Spots"; live "Meetups". (See §5.1.)

---

## 5. Deep Dives

### 5.1 Meetups Page (🔴 HIGH — top priority)

**Target = demo `MatchGuideScreen.jsx`. Replace the live activity-type grid with neighborhood accordions.**

Structure to build:
- Page bg `#EEECEA`. Mobile sticky header **"Meetup Spots"**. Desktop H1 **"Meetup Spots"** (2xl).
- Intro copy (verbatim): *"If you're looking for a good spot to meet up with your new connection, check out these local spots"*.
- One **accordion per neighborhood** (`bg-white border`), first open by default. Header = neighborhood name (semibold) + right-aligned "{N} spots" + chevron (rotates).
- Each venue row is an **`<a href={link}>`** (opens new tab when not `#`): name (hover → teal) + **type badge with icon** + descriptor (muted) + teal **"Best for: {bestFor}"** + external-link icon on the right.
- Badge/icon map (`TAG_CONFIG`): Coffee→`Coffee` (gold tint), Cocktails→`Wine` (navy tint), Dinner→`UtensilsCrossed` (brown tint), Hotel→`Building2` (teal tint), Activity→`Sparkles` (purple tint).
- Only `status === "active"` venues, capped at 5 per section.

**Exact data to port** (`data/matchGuideData.js`, 7 neighborhoods × 5 venues). Fields per venue: `name, descriptor, tag, bestFor, link("#"), tier:"standard", city:"Austin", status:"active"`.

> Note: the live `placeholderVenues.ts` types (`Coffee | Drinks | Activity | Dinner`) and shape (emoji/distance) do **not** match. The demo uses tags `Coffee | Cocktails | Dinner | Hotel | Activity` with `descriptor` + `bestFor` + `link`. Replace the data model.

**Downtown** — *"The Central Anchor — ultimate neutral ground for everyone"*
- Houndstooth Coffee · Coffee · "Clean, simple, no pressure" · Best for: First meet
- Small Victory · Cocktails · "Dark, intimate cocktail bar" · Best for: Second date
- Red Ash · Dinner · "High-energy Italian, better for strong matches" · Best for: Strong match
- Proper Hotel · Hotel · "Modern luxury, rooftop bar with downtown views" · Best for: When things are going well
- Elephant Room · Activity · "Underground jazz, unique and memorable" · Best for: When things are going well

**East Austin** — *"The East Anchor — primary destination for a cool, creative vibe"*
- Flitch Coffee · Coffee · "Mobile coffee spot, casual and easy start" · First meet
- Whisler's · Cocktails · "Dim cocktail bar, strong first-meet energy" · First meet
- Suerte · Dinner · "Elevated Mexican, good for a longer sit-down" · Second or third date
- Arrive Austin · Hotel · "Boutique stay, clean and modern" · When things are going well
- Urban Axes · Activity · "Axe throwing — interactive and surprisingly fun" · Casual energy

**Domain / North Burnet** — *"The North Anchor — captures everyone north of 183"*
- Merit Coffee · Coffee · "Bright, easy daytime meet" · First meet
- The Roosevelt Room · Cocktails · "Cocktail-focused, a bit more intentional" · Second date
- Perry's Steakhouse · Dinner · "Classic dinner, more formal option" · Strong match
- Archer Hotel · Hotel · "Boutique feel in a structured area" · When things are going well
- TopGolf · Activity · "Games + drinks, lighter and interactive" · Casual energy

**South Congress** — *"The South Anchor — the gold standard for boutique hotels and walkability"*
- Jo's Coffee · Coffee · "Classic, low-pressure first meet" · First meet
- Hotel San José Courtyard · Cocktails · "Quiet, intimate outdoor drinks" · Second date
- Perla's · Dinner · "Seafood + patio, lively but still conversational" · Strong match
- Saint Cecilia · Hotel · "Intimate, exclusive boutique hotel" · When things are going well
- Continental Club · Activity · "Live music, good if things are going well" · When things are going well

**South Lamar** — *"The South-West Bridge — perfect midpoint for Westlake and East Austin"*
- Radio Coffee & Beer · Coffee · "Outdoor yard, low-key and easy" · First meet
- Infinite Monkey Theorem · Cocktails · "Urban winery, unexpected and memorable" · Second date
- Uchi · Dinner · "World-class Japanese, strong match energy" · Strong match
- Carpenter Hotel · Hotel · "Design-forward boutique, South Lamar corridor" · When things are going well
- Peter Pan Mini Golf · Activity · "Nostalgic, playful, breaks the ice" · Casual energy

**Rainey Street** — *"The High-Volume Bridge — connects East Side and Downtown"*
- Brew & Brew · Coffee · "Coffee-forward, good daytime meeting spot" · First meet
- Half Step · Cocktails · "Craft cocktails in a bungalow setting" · Second date
- Emmer & Rye · Dinner · "Inventive tasting menu, memorable and intimate" · Strong match
- Hotel Van Zandt · Hotel · "Upscale Kimpton, rooftop bar, Rainey adjacent" · When things are going well
- Banger's · Activity · "Beer garden with live music, high energy" · Weekend afternoon

**North Loop / Triangle** — *"The North-Central Bridge — geographic center for north-to-south matches"*
- Epoch Coffee · Coffee · "Chill, 24-hour vibes, no pretension" · First meet
- Workhorse Bar · Cocktails · "Dive-adjacent cocktails, approachable" · First meet
- Foreign & Domestic · Dinner · "Inventive American, intimate and chef-driven" · Second or third date
- Origin Hotel · Hotel · "New boutique on Airport Blvd corridor" · When things are going well
- Breakaway Records · Activity · "Vinyl shopping + beer — unique and low-pressure" · Casual energy

> `context` strings exist per neighborhood in the data but are **not rendered** in the demo accordion — port them into the model but they're optional to display.

---

### 5.2 Match Card Expanded / Detail View (🔴 HIGH)

See §3.4. **Recommendation:** build a dedicated `/dashboard/matches/[id]` (or `/matches/[id]`) screen modeled on `MatchDetailScreen.jsx` rather than reusing `/profiles/[id]`. Must include:
- Hero photo (16/7 desktop, 3/2 mobile) with gradient; silhouette + "Upgrade to view" for free.
- Identity + HAEVN+ badge + big gold `{N}% Match` + "based on your alignment across five key areas".
- AI intro paragraph (truncated + "Unlock to read more" for free).
- **"Why this match works"** 5-dimension expandable accordion (labels: Goals & Expectations, Structure Fit, Boundaries & Comfort, Openness & Curiosity, Sexual Energy) — strength chip + detail + teal-check bullets. Free = summaries + "Unlock with HAEVN+".
- Contextual actions (Connect/Message/Nudge + Pass).
- Free-only "Unlock this match" benefits list (View photos / Read full profile / See full alignment breakdown / Connect instantly).
- **Content dependency:** needs per-dimension prose (summary/strength/detail/bullets). The live engine outputs numeric `breakdown` scores only — an AI summarization step is required to generate this copy.

---

### 5.3 Chat Interface (🟠 MED)

To reach parity (`ConversationScreen.jsx`):
1. **Add AI icebreakers** on the empty state (HAEVN+): "✨ Suggested opening lines" → 3 tappable, per-match prompts that prefill the input → "Based on your alignment with {name}". (Live needs real per-match generation; demo hardcodes `MOCK_ICEBREAKERS`.)
2. **Meetup pin → bottom sheet** (not inline panel): venue + descriptor + neighborhood + **per-user halfway times** ("You: ~X min / {name}: ~Y min") + "Roughly halfway between the two of you" → "Share in conversation". Live currently shows a single placeholder venue with no distances.
3. **Own bubble color → navy** `#1E2A4A` (live is orange) for zero variation.
4. **Post-date check-in** card (the demo renders it on Matches, not chat — decide placement, but it must exist): "We clicked / It was okay / Not a match" → confirmation.

---

### 5.4 Hidden Page (🔴 HIGH)

Build `HiddenMatchesScreen.jsx` equivalent at a real route + wire the nav item off "Soon":
- Header "Hidden Matches" + "Matches you've passed on. You can restore them at any time."
- Compact rows: `Name, age` + "{N}% match · {distance}" + **Restore** (`RotateCcw`).
- Empty: "No hidden matches".
- **Upstream dependency:** add a **Pass (X)** affordance to the match card/detail (§3.3) that moves a match here, and a "👁 {N} hidden matches" link on the Matches screen.
- **New requirement (post-demo):** auto-clear/expire hidden matches after **30 days** (not in the demo — demo keeps them until manual restore). Confirm exact behavior with Rik.

---

### 5.5 Navigation & Chrome (🔴 HIGH)

1. **Replace the "HAEVN" sponsor bar with the demo context bar:**
   - Free/member: black bar, left = *"Viewing as {firstName} · {city} · {intent}"* (demo: "Emily · Austin · Long-term"), right = gold **"View as HAEVN+ Member"** (+ animated chevron).
   - Plus: left = gold **"HAEVN+"** + "· Full access enabled", right = muted **"View as Member"**.
   - Decide whether the view-toggle is a real demo affordance for production or staff-only. If production shouldn't switch tiers, keep the *context text* but drop the toggle — confirm with Rik (he explicitly asked about both).
2. **Nav order:** align to the demo's intended order. Sidebar: Matches · Messages · Hidden · Meetups · Profile. (Bottom-nav in the demo swaps to Meetups · Hidden — confirm which is canonical.)
3. **Un-stub "Hidden"** (ties to §5.4).
4. Verify active-state pill bg `#F9F5EB` + gold text.

---

## 6. Navigation Order — Quick Reference

| Slot | Demo Sidebar | Demo BottomNav | Live Sidebar | Live BottomNav |
|---|---|---|---|---|
| 1 | Matches | Matches | Matches | Matches |
| 2 | Messages | Messages | Messages | Messages |
| 3 | **Hidden** | **Meetups** | **Meetups** | **Meetups** |
| 4 | **Meetups** | **Hidden** | **Hidden (Soon)** | **Hidden (Soon)** |
| 5 | Profile | Profile | Profile | Profile |

The demo is internally inconsistent (sidebar vs bottom-nav swap Hidden/Meetups). **Action:** pick one canonical order and apply to both; un-stub Hidden.

---

## 7. Priority-Ranked Fix List

**🔴 HIGH (zero-variation blockers)**
1. **Meetups page** → rebuild as neighborhood accordions; port all 7×5 venue data + copy (§5.1).
2. **Match detail screen** → bespoke screen with hero + % + AI intro + "Why this match works" 5-dimension accordion + contextual actions + free "Unlock this match" panel (§5.2). *(Has an AI-content dependency.)*
3. **Top context bar** → "Viewing as {name} · {city} · {intent}" / "HAEVN+ · Full access enabled" + view toggle (§5.5).
4. **Hidden page** → real screen + Restore + card Pass affordance + 30-day expiry (§5.4).

**🟠 MEDIUM**
5. **Match card actions** → inline Connect/Message/Pass + Nudge-to-Connect flow + "Nudge received" banner + "Where you might differ" (§3.3).
6. **AI match intro** (card + detail) → replace derived "Top factor" with written per-match prose.
7. **Chat icebreakers** → "Suggested opening lines" on empty state (§5.3).
8. **Meetup bottom sheet** with halfway distances (§5.3).
9. **Post-date check-in** feedback card (§3.2 / §5.3).
10. **Matches "system signal" banner** + "Click username to view full profile" hint (§3.2).
11. **Match detail free-tier teaser** instead of hard 🔒 gate (§3.4).

**🟡 LOW (polish)**
12. Chat own-bubble navy (not orange).
13. Messages per-row free redaction (vs single banner).
14. Nav order canonicalization (§6).
15. Typography → Outfit parity (or confirm intentional divergence); surface tints `#FAFAF8`/`#EEECEA`.
16. Match card photo aspect (3/4) + card lightbox.
17. Mobile per-screen headers.

**⚪ Excluded / N/A**
- Demo entry funnel (`DemoEntryPage`, `SelectorPage`, etc.) — demo artifacts.
- Profile "Demo Controls" / "Back to view selector" — not for production.
- Demo broken images — out of scope.
- `ChatConversation.tsx` legacy component — unused.

---

## 8. File Reference Map

| Gap | Emergent target file | Live HAEVN file to change |
|---|---|---|
| Meetups (neighborhoods) | `frontend/src/pages/MatchGuideScreen.jsx` + `frontend/src/data/matchGuideData.js` | `app/dashboard/meetups/page.tsx` + `lib/meetups/placeholderVenues.ts` |
| Match card | `frontend/src/components/MatchCard.jsx` | `components/dashboard/ProfileCard.tsx` (`variant="match"`) |
| Match detail | `frontend/src/pages/MatchDetailScreen.jsx` | new `app/dashboard/matches/[id]/page.tsx` (replace reuse of `app/profiles/[id]/page.tsx`) |
| Match dimension content | `frontend/src/data/mockData.js` (`makeDimensions`) | match engine / AI summary (`lib/actions/computedMatchCards`) |
| Matches banner + check-in | `frontend/src/pages/MatchesScreen.jsx` | `app/dashboard/matches/page.tsx` |
| Messages list | `frontend/src/pages/MessagesScreen.jsx` | `app/messages/page.tsx` |
| Chat / icebreakers / meetup sheet | `frontend/src/pages/ConversationScreen.jsx` | `app/chat/[connectionId]/page.tsx` + `components/chat/MeetupChatCard.tsx` |
| Hidden | `frontend/src/pages/HiddenMatchesScreen.jsx` | new page + `components/dashboard/Sidebar.tsx` / `BottomNav.tsx` (un-stub) |
| Profile | `frontend/src/pages/ProfileScreen.jsx` | `app/profile/page.tsx` + `components/profile/ProfilePhotoHero.tsx` |
| Context bar + nudge | `frontend/src/components/DemoLayout.jsx` | `components/dashboard/DashboardShell.tsx` + `UpgradeBar.tsx` |
| Sidebar / BottomNav | `frontend/src/components/Sidebar.jsx` / `BottomNav.jsx` | `components/dashboard/Sidebar.tsx` / `BottomNav.tsx` |

---

## 9. Acceptance Checklist (from brief)

- [x] Every page in the Emergent demo visited/documented (via source — live SPA not headless-renderable)
- [x] Corresponding HAEVN pages compared
- [x] Emergent demo source cloned and read
- [x] Meetups structure fully documented + neighborhood data extracted (§5.1)
- [x] Match card expanded view differences documented (§3.4, §5.2)
- [x] Chat differences documented — meetup suggestion, icebreakers, feedback (§3.6, §5.3)
- [x] Hidden page differences documented (§3.8, §5.4)
- [x] Navigation differences documented (§3.10, §5.5, §6)
- [x] No HAEVN app files modified
- [x] Gap analysis saved to project root

**Open questions for Rik:**
1. Should the production app keep the demo's **"View as HAEVN+ Member"** tier-switch toggle, or just the context text?
2. Canonical nav order (the demo itself is inconsistent between sidebar and bottom-nav)?
3. Hidden-match **30-day expiry** — confirm exact rule (demo has none).
4. Match-card **AI intro / dimension prose** — confirm we generate this server-side (the demo hardcodes it).
