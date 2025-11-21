
haevn-dashboard-and-post-onboarding.md

*(Add date suffix if you want consistency:* *haevn-dashboard-and-post-onboarding-2025-11-20.md**.)*

This spec covers EVERYTHING after the survey:

photos → plan selection → dashboard → matches → connections → nudges → safety → account → early matching wiring.

Written in the same surgical, Claude-ready style.

* * * * *

**haevn-dashboard-and-post-onboarding.md**
==========================================

**Purpose**
-----------

Define all post-survey UI/UX, behavior, and data layer changes required for HAEVN Sprint 02.

This file governs everything from **photo upload** → **plan selection** → **dashboard** → **matches/connections/nudges** → **account → safety → matching scaffolding**.

All instructions here must be implemented exactly as in Rik's Revisions PDF (Nov 2025).

If anything conflicts with older code, the PDF wins.

* * * * *

**1\. Global Post-Survey Rules**
================================

### **1.1 Mobile-First**

-   All dashboard screens must be optimized for **handheld mobile**.

-   Horizontal scroll must feel native (iOS-like snap points).

### **1.2 Default Background**

-   All post-onboarding screens use #FFFFFF unless a specific background asset is in the PDF.

### **1.3 Back Navigation**

-   Back button must not return users to survey or onboarding after completion.

-   Screen order always respects the canonical flow:

    -   Survey → Photos → Plan → Dashboard

* * * * *

**2\. Photo Upload Step (Mandatory)**
=====================================

### **2.1 Placement**

Photos must appear **immediately after the survey** and **before plan selection**.

### **2.2 Screen: Add Your Photos**

**Heading:**

> "Add your photos"

**Description:**

Use PDF-provided copy if available; otherwise keep minimal.

### **2.3 Requirements**

-   Min photos: **As defined in PDF** (usually 1--3).

-   Max photos: **Use existing backend limits or PDF-specified cap**.

-   Photo picker must support:

    -   Camera

    -   Library

    -   Crop/resize to consistent aspect ratio

-   All photos must upload before proceeding.

### **2.4 Data Persistence**

-   Store photo metadata in user profile.

-   Add/update DB fields as required (image URLs, ordering).

### **2.5 Editing Later**

-   After onboarding, users must be able to edit photos from **Account → Photos**.

* * * * *

**3\. Plan Selection (If Applicable)**
======================================

### **3.1 Screen**

**Heading:**

> "Choose your plan"

Pull exact copy + options from PDF / business rules.

### **3.2 Payment Integration**

-   Use PayPal or chosen provider when ready.

-   For this sprint:

    -   Implement UI + routing

    -   Backend scaffolding

    -   Mock success/failure flows if real payment not live yet.

### **3.3 Post-Payment**

On successful plan confirmation → route to **Dashboard Introduction** screen.

* * * * *

**4\. Dashboard**
=================

The dashboard is the **central home** for the user after onboarding.

### **4.1 Dashboard Introduction Screen (One-Time)**

**Heading:**

> "Welcome to your Dashboard"

**Subtext:**

(Text pulled from PDF explaining Matches, Connections, Nudges.)

CTA:

-   "Continue" → full dashboard

This screen shows **ONLY the first time** after onboarding.

* * * * *

**4.2 Dashboard Structure**
---------------------------

### **Sections**

Dashboard must include:

1.  **Matches**

2.  **Connections**

3.  **Nudges**

Each appears as its own card container.

### **Design Rules**

-   Each section shows **one match card at a time**.

-   Card occupies ~85--95% of screen width.

-   Horizontal scroll with snap points.

-   Pagination indicators ("1 of 12" or dot indicators) must match PDF.

### **Card Contents (Mandatory):**

Per PDF:

-   User photo

-   Username

-   Compatibility %

-   Compatibility factor (top 1--2 drivers)

-   Location (ZIP-level or city-level)

-   Optional badges (if PDF lists them)

### **"View All" Behavior**

-   When user taps "View All" → open vertical list showing all cards for that category.

-   Vertical list = simple, scrollable, clean.

* * * * *

**5\. Matches**
===============

### **5.1 Definition**

Profiles that match based on:

-   Survey compatibility

-   Orientation alignment

-   Location radius

-   Values & boundaries alignment

-   Additional rules in matching logic file

### **5.2 Behavior**

-   Appears at the top of dashboard (unless PDF dictates otherwise).

-   Card order: highest compatibility → lowest.

### **5.3 Interaction**

-   Tap card → open profile preview or full profile (use current UI).

-   Swipe horizontally to navigate.

* * * * *

**6\. Connections**
===================

### **Definition**

People who have either:

-   Viewed your profile

-   Appeared in your mutual interest band

-   Triggered a compatibility threshold

    (specific definition from PDF)

### **Behavior & UI**

Same card structure as Matches, but content may vary slightly per PDF.

* * * * *

**7\. Nudges**
==============

### **Definition**

People who:

-   Fit your profile

-   Have not interacted yet

-   Are compatible based on secondary matching factors

    (as defined in PDF)

### **UI**

Same horizontal card structure.

Lower priority than Matches/Connections unless PDF indicates otherwise.

* * * * *

**8\. Messaging & Safety**
==========================

### **8.1 Block User**

Must implement **block user** functionality.

**Behavior:**

-   Once blocked, the other user must no longer appear in:

    -   Matches

    -   Connections

    -   Nudges

    -   Messaging

-   Should not be able to message or view profile again.

**UI Placement:**

-   Inside profile preview

-   Or messaging thread

    (as PDF dictates or where most logical)

**Data Layer:**

-   Add blocked_users table or array field.

-   Soft block only.

* * * * *

### **8.2 Stop Messaging**

-   Separate from block.

-   Conversation becomes read-only or archived.

-   Not fully blocked, but muted/silenced.

* * * * *

**9\. Account Settings**
========================

### **9.1 Profile & Photos**

Users must be able to:

-   Edit photos

-   Change bio or self-description fields

-   Update location (ZIP)

### **9.2 Delete Account**

-   Accessible from Settings.

-   Should trigger soft-delete or cleanse depending on backend schema.

-   Confirmation modal required.

### **9.3 Cancel Subscription**

-   Must be visible.

-   Must be easy to access.

-   Must link to PayPal or internal billing logic.

* * * * *

**10\. Early Matching Logic Wiring**
====================================

### **10.1 Objective**

Not the full ML system --- just the **functional backend** needed to:

-   Compute a compatibility %

-   Determine Matches vs Connections vs Nudges lists

-   Sort in correct order

### **10.2 Minimum Viable Matching**

Based on PDF + call summary:

-   Weight key categories higher:

    -   Relationship intent

    -   Orientation

    -   Values

    -   Boundaries

    -   Intimacy alignment

-   Lower weight categories:

    -   Hobbies

    -   Logistics

    -   Lifestyle

### **10.3 Deterministic Output (for QA)**

We should implement:

-   Fixed weighting map

-   Predictable scoring

-   Test users (as defined in separate matching doc)

This sprint = basic + predictable, not full ML.

* * * * *

**11\. Implementation Steps for Claude (Plan Mode)**
====================================================

When Claude loads this MD file, it must:

1.  Identify all components in the dashboard directory.

2.  Implement photo upload step with routing + persistence.

3.  Implement plan selection or stub if not launched yet.

4.  Build dashboard introduction screen.

5.  Rebuild Matches, Connections, Nudges UI per PDF.

6.  Add snapping horizontal scroll with card pagination indicators.

7.  Add "View All" vertical list views.

8.  Wire block user + stop messaging.

9.  Add account settings screens (delete account, cancel subscription).

10. Integrate basic matching logic + sorting.

11. Test on mobile with real data.

12. Validate UI matches the PDF image-by-image.

13. Run regression checks on onboarding → survey → dashboard pipeline.

* * * * *

**12\. Done Criteria**
======================

Sprint-level UI is complete when:

-   Dashboard looks & behaves exactly like PDF

-   Photos onboarding works

-   Matching list generation works deterministically

-   User can block + stop messaging

-   User can delete account or cancel subscription

-   Zero navigation bugs

-   No broken flows

-   Fully mobile polished
