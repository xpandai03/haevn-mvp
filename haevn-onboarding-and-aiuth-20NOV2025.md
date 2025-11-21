Perfect — here is the clean, surgical, ready-to-use MD file for Claude.

Name:
haevn-onboarding-and-auth.md
(You can optionally rename with today’s date the same way as the master file, but not required.)

Style:
Terse, directive, implementation-oriented, anchored to the revisions PDF.
Everything is written so Claude can immediately load → Plan Mode → execute.

⸻

haevn-onboarding-and-auth.md

Purpose

Define all onboarding + authentication changes required for HAEVN Sprint 02.
This file governs everything from opening the app → completion of verification → user is ready to begin the Profile Builder Survey.

All instructions here must be implemented exactly as described in Rik’s Revisions PDF (Nov 2025).
If code diverges, follow PDF first, then this MD.

⸻

1. Global Requirements
	•	Full onboarding must be mobile-first, optimized for small screens.
	•	Default screen background = #FFFFFF unless a hero image is specified.
	•	All CTA buttons follow HAEVN spacing, typography, and bottom-fixed placement.
	•	No redundant screens. Remove unnecessary steps to streamline the funnel.
	•	Navigation must be linear, predictable, and match the revised flow.

⸻

2. Revised Onboarding Flow (Screen-by-Screen)

2.1 NEW Welcome / Intro Screen (Hero Screen)

Replace current welcome screen entirely.

Layout
	•	Full-bleed hero image (from the provided assets).
	•	Title text over image or below depending on readability.
	•	Subtext + CTA placed below fold if needed but on mobile should appear without scrolling.

Copy (from PDF)

“Thoughtful introductions based on compatibility, values, and what you’re actually looking for.”

Footer Links (must exist on this screen)
	•	Terms of Service
	•	Privacy Policy
	•	Cookies Policy
(All link to haevn.co versions.)

CTA Button
	•	“Get Started”
	•	Leads immediately to Create Account – Step 1.

⸻

2.2 Remove Redundant Screens

Delete/remove the following:
	•	Extra “Welcome to HAEVN” screen (the info-heavy one).
	•	“Already logged in?” intermediary screen unless absolutely required by auth library.
	•	Any screen that duplicates information from the PDF hero screen or the survey intro screen.

⸻

3. Create Account Flow (3-Step Minimalist Flow)

This is a major change and must be implemented exactly.

3.1 Step 1 — Basic Identity

Heading:

“What should we call you?”

Fields:
	•	First Name (required)
	•	Handle / Username (optional or required depending on existing backend rules)

UX Notes:
	•	Spacious design, minimal text.
	•	No “junk” UI — keep it clean and Apple-like.
	•	Continue button always visible.

⸻

3.2 Step 2 — Email + Password

Heading:

“Set up your account”

Fields:
	•	Email (required)
	•	Password (required, follow existing validation rules)

UX Notes:
	•	Inline validation; errors must appear immediately.
	•	Keep layout centered, airy, mobile-first.

⸻

3.3 Step 3 — Zip Code

Heading:

“What’s your ZIP code?”

Field:
	•	Zip Code (required)

Purpose:
Location-based matching and feed relevance.

UX Notes:
	•	Prevent multi-line wrapping.
	•	Validate format if applicable based on locale.

⸻

4. Verification Flow (Identity Verification)

4.1 Remove “Skip Verification”
	•	Delete skip option unless Veriff integration requires fallback UX.
	•	Verification must be presented as a required step in the onboarding journey.

⸻

4.2 Verification Screen (Updated Copy)

Heading:

“Verify your identity”

Description:
(As provided in the PDF. Brief, reassuring, trust-building.)

Elements:
	•	Veriff start button
	•	Device permission prompts if required

⸻

4.3 Post-Verification Confirmation Screen

After successful verification, user must see:

Heading:

“Thanks for verifying, [First Name]”

Subheading:

“Next up: Your Profile Builder”

CTA:
	•	“Start” → goes into survey intro.

⸻

5. Pre-Survey Warm-Up Screen (“Before we continue”)

Heading Change:
Replace with:

“Welcome to HAEVN, [First Name]!”

Bullet Points (Follow exact order from PDF):
	1.	“This will take about 10–15 minutes.”
	2.	“Every step matters — your answers help us understand your intentions, values, and what feels right for you.”
	3.	“You can come back any time. Your progress is saved.”

UX Notes:
	•	Make this screen lightweight and visually appealing.
	•	Ensure it fits mobile without scrolling.
	•	CTA → “Start Profile Builder”.

⸻

6. Login Resume Logic (Critical Behavior Change)

If user has NOT completed the survey:

On login → take them directly to the last unanswered question
NOT “Before we continue”.

If user HAS completed the survey:

On login → take them to the Dashboard.

If user is partway through onboarding but before survey:

Resume at the screen where they left off (create account step, verification, etc.).

If just completed verification and app restarts:

Return to Profile Builder Welcome screen.

This logic is global and must override previous flows.

⸻

7. Interaction Rules

Apply consistently across all onboarding screens.

Continue Button
	•	Always anchored bottom center.
	•	Disabled until mandatory fields are filled.
	•	No floating/scroll-dependent behavior.

Back Button
	•	Visible on top-left except where PDF explicitly removes it.
	•	Should never take users to removed screens.

Scrolling Constraints
	•	Screens flagged in PDF as “no scroll required” must fit vertically on standard mobile viewport (iPhone 14/15 sizing).

⸻

8. Assets
	•	Use hero images from the updated album Rik provided.
	•	Background images only where the PDF explicitly shows them.
	•	All other pages default to white.

⸻

9. Implementation Notes for Claude

When executing this MD:
	1.	Identify affected components (e.g., /app/onboarding/*, auth flows, verification screens).
	2.	Update all screen files to match PDF content.
	3.	Ensure 3-step create-account flow is wired into existing auth backend.
	4.	Update navigation routes to remove deprecated screens.
	5.	Implement login-resume behavior with persistence checks.
	6.	Maintain type safety + no breaking of survey contexts downstream.
	7.	After implementing:
	•	Validate navigation
	•	Validate state persistence
	•	Validate mobile rendering
	•	Validate Veriff flow end-to-end

Claude must not infer new content; always use PDF text + this MD.

