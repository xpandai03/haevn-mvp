haevn-sprint-02-master-2025-11-20.md

**Style:**

Short, directive, no fluff, built for Claude Plan Mode, with clear boundaries and references to the revisions PDF as the canonical source.

* * * * *

**haevn-sprint-02-master-2025-11-20.md**
========================================

**Purpose**
-----------

This is the **master spec** for HAEVN Sprint 02 (Nov 20, 2025).

Claude should load this MD file for **all tasks in this sprint**.

This file defines:

-   The full sprint scope

-   Global UX & behavioral rules

-   The correct execution order

-   How to use subsidiary MD files

-   The canonical source of truth (Rik's Revisions PDF)

* * * * *

**Sprint Objective**
--------------------

Deliver a **shippable mobile-first MVP** that includes:

1.  Clean, modern onboarding → verification → survey flow

2.  Fully updated survey content (all questions updated per the revisions PDF)

3.  Photo upload in onboarding

4.  Plan selection

5.  Finalized dashboard (Matches / Connections / Nudges)

6.  Account-level features: block user, delete account, cancel subscription

7.  Basic matching logic wired & testable

Everything must reflect the **Revisions Guide** provided by Rik (Nov 2025).

* * * * *

**Canonical Source**
--------------------

**The Revisions PDF is the highest authority.**

MD files must follow it 1:1.

If any PDF instructions contradict existing code, **PDF wins**.

* * * * *

**Global UX Rules (Apply Everywhere)**
--------------------------------------

-   **Mobile-first** layout is mandatory on every screen.

-   **Default background** = pure white #FFFFFF unless a specific background image is required.

-   **"Continue" button** = bottom, fixed, consistent across all screens.

-   All screens must be **scroll-light**; if the PDF calls out "no scroll", respect it.

-   **Text hierarchy**:

    -   Title (bold, clear)

    -   Subheading (optional)

    -   Description (light, concise)

-   Buttons & CTAs follow the HAEVN color palette + spacing patterns defined in UI/UX.

* * * * *

**Global Behavioral Rules**
---------------------------

These apply across onboarding and survey:

### **Login Resume Logic**

-   If survey **incomplete** → user returns to last unanswered question.

-   If survey **complete** → user lands on **Dashboard**.

-   No "Before we continue" screen on returning users.

### **Section Completion Popup**

-   Only trigger after user taps **Continue** on the final question in a section.

-   Do **not** trigger on text input or last keystroke.

### **"Other / Prefer to describe"**

-   Always include a revealable text field.

-   Field must persist to backend.

### **Sliders → Radio Options**

If PDF calls for removing sliders, convert to discrete radio choices.

### **Age → Birthdate**

Replace age input with birthdate field.

* * * * *

**Flow Overview (End-to-End)**
------------------------------

1.  **Welcome Screen (new)**

2.  Create Account (3-step)

3.  Verification (no skip unless legally required)

4.  "Thanks for verifying" → "Profile Builder" intro

5.  Multi-section survey (all updated per PDF)

6.  Photo upload (before plan selection)

7.  Plan selection

8.  Dashboard introduction

9.  Dashboard with:

    -   Matches

    -   Connections

    -   Nudges

10. Messaging + Block user

11. Account section:

-   Edit photos

-   Delete account

-   Cancel subscription

* * * * *

**Sprint Deliverables (High Level)**
------------------------------------

### **1\. Onboarding + Auth (MD #2)**

-   Welcome hero screen

-   Removal of redundant screens

-   3-step account creation

-   Verification updates

-   Resume logic

-   Pre-survey "Welcome to HAEVN, [Name]" content

### **2\. Survey Overhaul (MD #3)**

-   Every question's copy updated

-   New questions added

-   Input types corrected (single/multi/radio/date/text)

-   "Other" behavior implemented

-   New content for relationship styles, intimacy, boundaries, etc.

-   PDF screenshots must translate exactly into UI components

### **3\. Photos + Dashboard + Account (MD #4)**

-   Photo onboarding step implemented

-   Dashboard scrolling + card layout built

-   Matches/Connections/Nudges card copy + fields

-   Block user

-   Delete account

-   Cancel subscription

-   Early matching logic + test users

* * * * *

**Execution Order**
-------------------

Claude must follow this exact order:

1.  **Load this MD file first** (master).

2.  Load:

    -   haevn-onboarding-and-auth.md

    -   Implement all onboarding work.

3.  Load:

    -   haevn-survey-updates.md

    -   Implement survey updates section-by-section.

4.  Load:

    -   haevn-dashboard-and-post-onboarding.md

    -   Implement photos + dashboard + safety + account features.

5.  Review against this master file + the Revisions PDF.

6.  Run QA pass using defined test cases.

All work must strictly follow the revisions PDF.

* * * * *

**Claude Plan Mode Expectations**
---------------------------------

When using this file + a sub-MD:

-   Identify all impacted components/screens

-   List necessary code changes (frontend + backend if needed)

-   Execute in **small safe steps**

-   After each change:

    -   Verify rendering

    -   Verify navigation

    -   Verify data persistence

-   Ask for confirmation only when ambiguous or risky

-   Never drift from PDF requirements

* * * * *

**Definition of "Done" for Sprint 02**
--------------------------------------

Sprint 02 is done when:

-   Onboarding → verification → survey → photos → plan → dashboard is **polished, mobile-first, bug-free**

-   All survey screens match the PDF exactly

-   Dashboard shows correct cards + scroll behavior

-   Account deletion + unsubscribe flows work

-   Block user works

-   Matching logic produces deterministic results for test users

-   No broken links, missing images, or layout issues

-   No regressions from Sprint 01

* * * * *