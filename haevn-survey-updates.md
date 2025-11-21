haevn-survey-updates.md

*(You can add date suffix if you want consistency, e.g.,* *haevn-survey-updates-2025-11-20.md**.)*

This MD is intentionally **modular, direct, and execution-ready**, and it mirrors the structure of Rik's revisions PDF --- screen-by-screen, section-by-section, with each instruction tied to a UI or data change Claude needs to perform.

No fluff. No guesswork. Only what's needed to implement exactly what Rik wants.

* * * * *

**haevn-survey-updates.md**
===========================

**Purpose**
-----------

Define the **complete set of content, component, and UX updates** for the HAEVN Profile Builder Survey based on Rik's Revisions PDF (Nov 2025).

This file overrides all previous survey definitions.

Claude must follow PDF instructions **literally 1:1**.

All updates here apply across:

-   Titles

-   Subheadings

-   Descriptions

-   Option lists

-   Input types (single-select / multi-select / radio / date / text)

-   Navigation

-   Layout

-   Validation

Survey → MUST be mobile-first and must reflect the exact updated copy + phrasing from the PDF.

* * * * *

**1\. Global Survey Rules**
===========================

### **1.1 Section Completion Popup**

-   Must appear **only after the user taps Continue** on the last question in a section.

-   Must NOT trigger on typing or when last field gains focus.

* * * * *

### **1.2 "Other / Prefer to describe" Rules**

For **every** multi-select or radio group that includes "Other":

-   Display a **text field** as soon as the option is selected.

-   Persist to backend under a consistent *_other naming convention.

-   Text field required only when "Other" is selected.

* * * * *

### **1.3 Age → Birthdate**

Replace age input with **birthdate**:

-   Use date picker UI (mobile-friendly).

-   Validate minimum age if needed (as per backend logic).

* * * * *

### **1.4 Slider → Discrete Options**

Where the PDF replaces sliders, convert to:

-   Radio button set (vertical)

-   Each option = 1 line of text + optional subtext if provided.

* * * * *

### **1.5 Layout Requirements**

-   All title/subheading/description text must be readable without scroll whenever the PDF indicates "no scroll required".

-   Question options should not wrap excessively; consider multi-column only if PDF indicates.

-   "Continue" always visible at bottom.

* * * * *

**2\. Survey Structure (High-Level Order)**
===========================================

Follow the order and grouping from Rik's Revisions PDF:

1.  Identity & Basics

2.  Orientation & Relationship Intent

3.  Relationship Style / What You're Looking For

4.  Intimacy / Chemistry / Boundaries

5.  Lifestyle / Logistics / Values

6.  Final summary (if applicable)

Each section below corresponds to a set of screens in the PDF.

* * * * *

**3\. Section-by-Section Updates**
==================================

Below is the **exact playbook** Claude uses.

Each subsection = one or more screens in the PDF.

* * * * *

**3.1 Identity & Basics**
-------------------------

### **Screen: How would you like to show up here?**

(Previously: "Who are you on HAEVN?")

-   **Title:** "How would you like to show up here?"

-   **Description:** Use the text exactly from the PDF.

-   **Input Type:** Single-select.

-   **Options:** Update option labels per PDF.

-   **Layout:** Must fit on mobile **without scroll**.

* * * * *

### **Screen: Relationship Orientation**

-   **Title:** "What is your relationship orientation?"

-   **Subheading/Description:** Use the guiding copy from the PDF (explains what orientation means).

-   **Input Type:** Single select or multi-select **as specified in PDF**.

-   **Options:** Replace with the updated full list (monogamous, polyamorous, open, etc.).

-   **Other Option:** Must expose text field.

* * * * *

### **Screen: Birthdate**

-   **Replace age with birthdate** input.

-   **Input Type:** Date picker.

-   **Validation:** Ensure consistent min age if enforced by backend.

* * * * *

**3.2 Relationship Style & Intentions**
---------------------------------------

### **Screen: What relationship style(s) interest you?**

-   **Title:** As per PDF.

-   **Input Type:**  **Multi-select**.

-   **Options:** Use the revised list (long-term, casual-but-intentional, friends-to-more, exploring, etc.).

-   **Other Option:** Add text field when selected.

* * * * *

### **Screen: What are you looking for on HAEVN?**

-   **Title / Description:** As per PDF.

-   **Input Type:** Single-select unless PDF says multi.

-   **Options:** Must match exactly (dating, relationship, open to seeing what feels right, etc.).

* * * * *

### **Screen: Fidelity / Commitment**

-   **Title:** As defined in the PDF.

-   **Description:** MUST include example bullet points (complete monogamy, emotional exclusivity w/ some openness, etc.).

-   **Input Type:** Single-select or multi-select per PDF.

-   **Options:** Replace entire list with PDF options.

-   **Other Option:** Include text field.

* * * * *

**3.3 Intimacy, Chemistry, Boundaries**
---------------------------------------

### **Screen: Love Languages**

-   **Title:** "Which love languages resonate most for you?"

-   **Description:** Use PDF helper explanation.

-   **Input Type:**  **Multi-select**.

-   **Options:** Updated full list from PDF.

-   **Other Option:** Include text field.

* * * * *

### **Screen: Sexual Chemistry vs Emotional Connection**

-   **Title:** As per PDF.

-   **Replace slider with radio options:**

    -   "Emotional connection first"

    -   "Both equally important"

    -   "Physical chemistry first"

    -   (Any additional phrasing from PDF)

* * * * *

### **Screen: Body Type (Self)**

-   **Title:** As per PDF.

-   **Input Type:** Single-select.

-   **Options:** Slim/lean, athletic, curvy, plus-size, etc. (full list from PDF)

-   **Other Option:** Include text field.

* * * * *

### **Screen: Body Type Preferences (Partner)**

-   Same structure as above.

-   **Add optional nuance text box** for additional preference detail.

* * * * *

### **Screen: Kink / Fetish Interest**

-   **Title:** As per PDF.

-   **Input Type:** Single-select or multi-select (follow PDF).

-   **Options:**

    -   Not into kink

    -   Open to light experimentation

    -   Into BDSM community

    -   Curious

    -   Prefer not to answer

    -   (Full list from PDF)

-   **Other Option:** Include text field.

* * * * *

### **Screen: Absolute Boundaries / Hard No's**

-   **Title:** "Are there any clear limits or always-off-limits boundaries for you?"

-   **Input Type:** Optional **open text** field.

-   No options unless PDF lists examples (then include as read-only helpers).

* * * * *

**3.4 Lifestyle, Logistics & Values**
-------------------------------------

### **Screen: Alcohol / Substance Use**

-   **Input Type:**  **Multi-select**.

-   **Options:**

    -   "Alcohol socially"

    -   "Sober"

    -   "Cannabis friendly"

    -   "Psychedelics friendly"

    -   "Prefer to avoid substances"

    -   "Other" (with text box)

    -   (Match exact PDF list)

* * * * *

### **Screen: Privacy / Discretion Preferences**

-   **Input Type:** Single or multi per PDF.

-   **Description:** Update copy to align with PDF's framing around comfort, visibility, and intention.

* * * * *

### **Screen: First Meeting Style**

-   **Input Type:** Single-select.

-   **Options:** Coffee, walk, dinner, casual, spontaneous, structured, etc. (PDF list).

-   **Other Option:** Include text field.

* * * * *

### **Screen: Logistics / Time / Location**

-   Rework any outdated fields to match PDF's expectations.

-   Input types must match PDF (e.g., radio vs dropdown).

-   Use PDF phrasing.

* * * * *

**4\. Backend & Data Model Notes**
==================================

### **4.1 Field Mapping**

For each question:

-   Ensure DB fields match updated question structures.

-   For "Other" fields: store as {fieldName}_other.

-   For multi-select: store as array or comma-separated depending on existing schema.

### **4.2 Migration Requirements**

-   Remove fields no longer used.

-   Add new fields for new questions.

-   Update enums as needed.

### **4.3 Must NOT Break Existing Users**

-   Existing answers should still load correctly.

-   New questions should gracefully default to null/empty.

* * * * *

**5\. Navigation Rules**
========================

-   Each screen must have a **top-left back button**, except when PDF removes it.

-   "Continue" always visible bottom-fixed.

-   Entire survey must support resuming from any point.

* * * * *

**6\. Validation Rules**
========================

-   Required fields must block "Continue".

-   Optional fields must allow skipping.

-   "Other" fields must validate only when "Other" is selected.

-   Email/ZIP logic handled in onboarding, not here.

* * * * *

**7\. Implementation Steps (Claude Plan Mode)**
===============================================

When Claude loads this MD file, it must:

1.  Identify all survey screen components.

2.  Apply **content updates** exactly as PDF details.

3.  Apply **input type changes** (slider → radio, single → multi, etc.).

4.  Implement "Other" logic.

5.  Implement new questions, fields, copy.

6.  Update backend field mappings.

7.  Verify mobile rendering.

8.  Validate all updated screens.

9.  Ensure navigation continuity.

10. Ensure login-resume logic routes correctly into the survey.

11. Run a final pass comparing UI to PDF images.
