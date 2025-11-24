**haevn-dashboard-phase3-spec-2025-11-23.md**
=============================================

**HAEVN PHASE 3 --- DASHBOARD, MATCHES, MESSAGING & NUDGES**
==========================================================

**Purpose**
-----------

This document defines the **complete specification** for Phase 3 of HAEVN's MVP:

-   Dashboard UI overhaul (matches the PDF: Pages 33--34)

-   Matches, Connections, Nudges logic + UI

-   Messaging system (Inbox + Threads)

-   Full Nudge system (sending, aging, gating, premium flow)

-   Dedicated profile viewer (/profiles/[id])

-   Backend logic, data models, and API endpoints

-   Routing and access control

-   QA requirements

This spec **fully replaces** the current /dashboard and /partner-profile pages and adds multiple new UI + logic layers.

* * * * *

**1\. ROUTING & ENTRY LOGIC**
=============================

**1.1 Dashboard Route**
-----------------------

-   Dashboard lives at:

    **/dashboard**

**1.2 Access Requirements**
---------------------------

Dashboard should only load if:

1.  Verification completed

2.  Pre-survey welcome completed

3.  Full survey completed

### **Redirect rules:**

```
if (!verified) → /onboarding/verification
if (!surveyCompleted) → /onboarding/survey
else → /dashboard
```

This preserves existing behavior.

**1.3 Profile View Page**
-------------------------

Profiles should open via:

**/profiles/[profileId]**

and display:

-   Photo

-   Handle / Name

-   Bio

-   Compatibility %

-   Top compatibility factor

-   Location

-   All survey-based profile sections (goals, communication, energy, boundaries, body type, intimacy style, etc.)

-   Message CTA

-   Nudge CTA (if user is free)

-   Block user

-   Report user

* * * * *

**2\. DASHBOARD LAYOUT (TOP-LEVEL)**
====================================

Matches the PDF exactly (pages 33--34).

### **2.1 Layout Structure**

Dashboard is composed of:

```
HEADER (HAEVN logo, icons)
PROFILE SUMMARY CARD
SECTIONS:
 - Matches
 - Connections
 - Nudges
PERSONAL NAVIGATION:
 - Messages
 - Account Details
 - Survey

RESOURCES:
 - Events
 - Glossary
 - Learn
```

We will remove all old partner-related UI and completely replace with this.

* * * * *

**3\. PROFILE SUMMARY CARD (TOP CARD)**
=======================================

### **3.1 Layout**

A mobile-first card showing:

-   Profile photo (or silhouette icon)

-   Username / handle

-   Badge: FREE or PLUS

-   Stats row:

    -   Matches count

    -   New Messages count

    -   Connections count

    -   Profile views

### **3.2 Data Sources**

-   Matches count → computed

-   New Messages → unread messages count

-   Connections → active conversations or mutual matches

-   Profile views → from profile_views table (simple count)

* * * * *

**4\. THREE CORE DASHBOARD SECTIONS**
=====================================

Based on PDF (pages 33--34).

**4.1 Matches**
---------------

### **Definition:**

Profiles surfaced by HAEVN's compatibility engine that likely align with identity, values, and relationship intentions.

### **UI:**

-   "Matches (x of y)"

-   "View All"

-   Horizontal card scroll

-   Each card shows:

    -   Photo

    -   Username

    -   City / Distance

    -   Compatibility % (big)

    -   Top Compatibility Factor

    -   Tap → /profiles/[id]

* * * * *

**4.2 Connections**
-------------------

### **Definition:**

Profiles where a **mutual match** or **active messaging** exists.

(Your "active network.")

### **UI:**

-   "Connections (x of y)"

-   "View All"

-   Horizontal card scroll

-   Each card shows:

    -   Photo

    -   Username

    -   Latest message preview

    -   Unread badge

    -   Compatibility %

    -   Tap → /profiles/[id]

* * * * *

**4.3 Nudges**
--------------

### **Definition:**

Premium feature for paid users to notify free members.

### **UI:**

-   "Nudges (x of y)"

-   "View All"

-   Horizontal card scroll

-   Each card shows:

    -   Photo

    -   Username

    -   Nudge aging text ("Nudged 3 days ago")

    -   Compatibility %

    -   Top factor

    -   "Reply → Upgrade to respond" gating if free

    -   Tap → profile view

* * * * *

**5\. CARD DESIGN (ALL THREE SECTIONS)**
========================================

### **Card Elements:**

-   Size: ~85% width of screen

-   Rounded corners (xl or 2xl)

-   Drop shadow (subtle)

-   Background white

-   Inset border (very light gray)

-   Photo:

    -   If missing → use HAEVN silhouette icon from assets

-   Title: Username / Handle

-   Subtitle:

    -   City name OR distance

-   Compatibility %:

    -   Large

    -   Bold

    -   HAΕVN teal color

-   Top factor:

    -   Shown below compatibility

    -   Example: "Shared intimacy values"

### **Behavior:**

-   Horizontal scroll snaps to full card

-   Tap → profile page

-   "View All" → vertical list

* * * * *

**6\. "VIEW ALL" SCREENS**
==========================

### **Routes:**

-   /dashboard/matches

-   /dashboard/connections

-   /dashboard/nudges

### **UI:**

-   List view of cards

-   Vertical scrolling

-   Same card layout as dashboard

-   No horizontal scroll

-   Search bar (optional future)

-   Pull-to-refresh (optional)

* * * * *

**7\. MESSAGING SYSTEM (FULL)**
===============================

Messaging is part of Phase 3 because it's required for Connections and Nudges.

**7.1 Inbox**
-------------

### **Route:**

/messages

### **UI:**

-   List of conversations

-   Each item:

    -   Profile photo

    -   Username

    -   Last message snippet

    -   Timestamp ("2h ago")

    -   Unread indicator

**7.2 Thread**
--------------

### **Route:**

/messages/[conversationId]

### **UI:**

-   Bubble chat

-   Timestamp per message

-   Composer at bottom

-   Send button

-   Scroll to bottom

**7.3 Backend tables**
----------------------

### **messages**

```
id (uuid)
conversation_id (uuid)
sender_id
recipient_id
content (text)
created_at
read_at
```

### **conversations**

```
id
participant1_id
participant2_id
created_at
updated_at
```

* * * * *

**8\. NUDGE SYSTEM --- FULL LOGIC**
=================================

**8.1 Table: nudges**
---------------------

```
id (uuid)
sender_id
recipient_id
created_at
```

**8.2 Nudge Aging**
-------------------

In card:

-   <1h → "Just now"

-   <24h → "X hours ago"

-   1--7 days → "X days ago"

-   > 7 days → "A week ago"

**8.3 Premium Gating**
----------------------

-   Free users can **see** nudges

-   Free users **cannot reply** via message

    -   They see:

        -   Modal: "You've been nudged! Upgrade to continue."

-   Premium users can:

    -   Reply freely

    -   Nudge unlimited users

**8.4 API Endpoints**
---------------------

-   /api/nudges/send

-   /api/nudges/list

-   /api/nudges/mark-read

* * * * *

**9\. MATCHING ENGINE (LOGIC)**
===============================

**9.1 Inputs**
--------------

From Phase 2 survey:

-   Relationship orientation

-   Emotional exclusivity

-   Sexual exclusivity

-   Emotional availability

-   Body type & preferences

-   Love languages

-   Meeting style

-   Substance uses

-   Privacy / discretion

-   Goals & intentions

-   Chemistry vs emotional connection

-   Kink preferences

-   Boundaries

-   Location (city / ZIP)

-   Couple/single profile type

**9.2 Compatibility % Calculation**
-----------------------------------

Weighted formula:

```
Score = Σ (weight_i * match_i_value)
Normalize to 0--100%
```

**9.3 Top Factor Extraction**
-----------------------------

Pick the dimension contributing MOST to compatibility.

Examples:

-   "Shared intentions"

-   "Strong intimacy alignment"

-   "Aligned meeting styles"

-   "Emotional compatibility"

* * * * *

**10\. CONNECTIONS LOGIC**
==========================

Connections = any profile where:

-   Mutual match **OR**

-   Active conversation exists

Sorting:

-   Active conversations at top

-   New messages indicator

-   Recently matched next

-   Fallback: alphabetical

* * * * *

**11\. PROFILE VIEW PAGE (/profiles/[id])**
===========================================

**11.1 Layout**
---------------

-   Photo (circle or square)

-   Username / handle

-   Badge (Free / Plus)

-   Compatibility %

-   City / Distance

-   Bio

-   Tabs:

    -   Goals

    -   Communication

    -   Energy

    -   Boundaries

    -   Interests

    -   Body type

    -   Love languages

    -   Kinks (soft display)

    -   Preferences

**11.2 CTAs**
-------------

-   **Message** (always visible)

-   **Nudge** (only for premium users)

-   **Upgrade CTA** (if free + replying to nudge)

-   **Block**

-   **Report**

* * * * *

**12\. API LAYER**
==================

Explicit endpoints:

### **/api/dashboard/matches**

Returns:

-   Match cards (profileId, photo, factors, %)

### **/api/dashboard/connections**

Returns:

-   Active conversations + profiles

### **/api/dashboard/nudges**

Returns:

-   People who nudged you

-   Aging metadata

### **/api/messages/send**

### **/api/messages/list**

### **/api/messages/thread**

### **/api/messages/mark-read**

### **/api/nudges/send**

### **/api/nudges/list**

* * * * *

**13\. DATA MODELS --- SUPABASE**
===============================

We will need:

### **profiles**

Expand with:

-   body_type

-   body_type_preferences

-   intimacy_score

-   energy_level

-   connection_style

-   etc.

### **nudges**

### **messages**

### **conversations**

### **profile_views**

All defined above.

* * * * *

**14\. REMOVE OLD /partner-profile PAGE**
=========================================

### **Action:**

-   Delete /partner-profile entirely

-   Replace with /profiles/[id]

-   Route all access through new dashboard cards

* * * * *

**15\. GLOBAL MOBILE REQUIREMENTS**
===================================

-   No horizontal scroll except where designed (cards)

-   No whitespace gaps

-   No giant cards

-   All "View All" pages scroll vertically

-   Bottom nav stays fixed (if implemented)

* * * * *

**16\. QA CHECKLIST**
=====================

### **Must test:**

-   Dashboard loads correctly

-   Horizontal scroll snapping

-   "View All" works

-   Profile view loads

-   Messaging works

-   Nudges work

-   Premium gating works

-   Redirect rules correctly enforced

-   All styling matches PDF

-   Responsive on iPhone 14/15 dimensions

-   No console errors

* * * * *

**17\. DONE CRITERIA**
======================

Phase 3 is complete when:

-   Dashboard matches PDF design exactly

-   Profile summary card works

-   Matches / Connections / Nudges work

-   Messaging works (inbox + thread)

-   Nudge logic fully implemented

-   Profile view page works

-   Old partner profile removed

-   All API routes functional

-   All tables populated correctly

-   No console errors

-   Production deploy passes

-   Mobile UX is excellent

* * * * *

**END OF MD FILE**
