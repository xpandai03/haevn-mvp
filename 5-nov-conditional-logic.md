got it --- here's the **detailed but still focused MD file** for Claude.

it fully explains what's wrong now, how the survey is structured, and exactly how the conditional logic should behave (no prompts or directives, just context).

* * * * *

**🧠 HAEVN Onboarding Survey --- Conditional Logic Context & Clarification**
==========================================================================

**🧩 Overview**
---------------

The HAEVN onboarding survey currently suffers from **misaligned conditional logic**, inconsistent numbering, and broken skip/display triggers --- especially within the **Relationship Preferences** section.

This document provides the complete logic reference, structured flow, and source-of-truth alignment using both:

-   **Master Survey (09222025)**

-   **Conditional Branching Sheet (latest CSV)**

    as well as feedback from Rick (JNR).

* * * * *

**⚠️ What's Broken Right Now**
------------------------------

1.  **Logic begins too early**

    -   Some "Basic Info" questions (e.g., Kinsey Scale, Fidelity) were incorrectly made conditional based on sexual orientation (Q3).

    -   These should always display, regardless of prior answers.

2.  **Incorrect conditions in Relationship Preferences**

    -   Questions like Q6C, Q7, Q8, and Q10 are firing at the wrong times.

    -   Logic that depends on multiple variables (Q4 + Q6) was never implemented properly.

3.  **Missing nesting behavior**

    -   Sub-questions (e.g., Q6D after Q6C, Q33a after Q33) were not linked.

4.  **Survey numbering & section grouping mismatched with Master CSV.**

    -   Some question IDs used in the app (e.g., q3b_kinsey) don't align with the official IDs (Q3b).

* * * * *

**🧠 How the Survey Should Be Structured**
------------------------------------------

### **Section 1 --- Basic Information (No conditional logic)**

|

**ID**

 |

**Question**

 |

**Notes**

 |
| --- | --- | --- |
|

Q1

 |

How old are you?

 |

Free input

 |
|

Q2

 |

How do you describe your gender identity?

 |

Multiple select

 |
|

Q2a

 |

Which pronouns do you use?

 |

Always shown

 |
|

Q3

 |

How do you describe your sexual orientation?

 |

Always shown

 |
|

Q3a

 |

How do you define fidelity / commitment?

 |

**Always shown**

 |
|

Q3b

 |

Where do you land on the Kinsey Scale?

 |

**Always shown**

 |
|

Q4

 |

What is your current relationship status?

 |

Always shown

 |
|

Q5

 |

Where do you live (City/Zip)?

 |

Always shown

 |

**Current problem:**

Q3a and Q3b are gated by Q3 = "Bisexual / Pansexual / Queer" → ❌ remove this.

Basic info must not branch.

* * * * *

### **Section 2 --- Relationship Preferences (Conditional starts here)**

This is where the **branching logic actually begins** and the CSVs agree with Rick's explanation.

|

**ID**

 |

**Question**

 |

**Display Logic**

 |

**Notes**

 |
| --- | --- | --- | --- |
|

Q6

 |

What relationship style(s) interest you?

 |

---

 |

Always shown

 |
|

Q6a

 |

How would you like to meet people here?

 |

---

 |

Always shown

 |
|

Q6b

 |

Who are you hoping to meet?

 |

---

 |

Always shown

 |
|

**Q6C**

 |

*If connecting as a couple, how?*

 |

Show if **Q4 ∈ {Dating, Married, Partnered, Couple}**

 |

Couples only

 |
|

**Q6D**

 |

*Couple permissions*

 |

Show if **Q6C = 'Custom'**

 |

Nested logic

 |
|

**Q7**

 |

*How important is emotional exclusivity?*

 |

Show if **Q6 includes Open / Polyamory / Don't know yet**

 |

Skip for Monogamy

 |
|

**Q8**

 |

*How important is sexual exclusivity?*

 |

Show if **Q6 includes Open / Polyamory / Don't know yet**

 |

Same trigger as Q7

 |
|

**Q9 / Q9a**

 |

*Intentions & Sex-or-more*

 |

Always shown

 |

---

 |
|

**Q10**

 |

*Which attachment style best describes you?*

 |

Show if **(Q4 = 'Single') AND (Q6 includes Monogamy or Polyamory)**

 |

Compound logic

 |
|

**Q12**

 |

*How do you handle conflict?*

 |

Mirror Q10 logic

 |

Companion question

 |
|

**Q33 / Q33a**

 |

*Kinks & Experience Level*

 |

Q33a only shows if **Q33 answered**

 |

Nested conditional

 |

* * * * *

### **Section 3 --- Communication & Connection**

Follows standard logic, minimal gating:

|

**ID**

 |

**Question**

 |

**Notes**

 |
| --- | --- | --- |
|

Q10a

 |

Emotional availability

 |

Always shown

 |
|

Q11

 |

Love languages

 |

Always shown

 |
|

Q12a

 |

Messaging pace

 |

Always shown

 |

* * * * *

### **Section 4+ --- Lifestyle, Intimacy, Expression, Personality**

No major branching; only Q33--Q33a depend on user responses.

* * * * *

**✅ Correct Conditional Logic Summary**
---------------------------------------

**Simplified hierarchy for implementation:**

```
Basic Info (no gating)
└─ Q1--Q5 (always visible)
Relationship Preferences (branching begins)
 ├─ Q6--Q6b (always visible)
 ├─ Q6C → Show if Q4 ∈ {Dating, Married, Partnered, Couple}
 │   └─ Q6D → Show if Q6C = 'Custom'
 ├─ Q7/Q8 → Show if Q6 includes {Open, Polyamory, Don't know yet}
 ├─ Q10/Q12 → Show if Q4='Single' AND Q6 includes {Monogamy, Polyamory}
 └─ Q33a → Show if Q33 answered
Remaining Sections
└─ No branching beyond Q33a
```

* * * * *

**⚙️ Implementation Considerations**
------------------------------------

-   All **question IDs** should align exactly with Master CSV (use csvQuestionId in backend).

-   Previous conditions like:

```
show_if: Q3 in {Bisexual, Pansexual, Queer}
```

-   → ❌ remove entirely.

-   Evaluate all logic through a centralized parser instead of per-component gating.

* * * * *

**🧪 Testing Matrix (Expected Outcomes)**
-----------------------------------------

|

**Q4 (Status)**

 |

**Q6 (Style)**

 |

**Expected Visible Questions**

 |
| --- | --- | --- |
|

Single + Monogamy

 |  |

Q6C hidden, Q10+Q12 shown

 |
|

Single + Polyamory

 |  |

Q6C hidden, Q10+Q12 shown

 |
|

Married + Open

 |  |

Q6C shown, Q6D hidden unless Custom, Q7+Q8 shown

 |
|

Partnered + Custom (Couple)

 |  |

Q6C+Q6D both shown

 |
|

Monogamous Couple

 |  |

Q6C shown, Q6D hidden, Q7+Q8 hidden

 |
|

Any + Don't know yet

 |  |

Q7+Q8 shown

 |

* * * * *

**🧩 Deliverables (for reference when building)**
-------------------------------------------------

-   Update logic structure in lib/survey/questions.ts.

-   Remove wrong conditions in Basic Info.

-   Apply new conditions for Q6C--Q12.

-   Ensure numbering / csvQuestionId alignment.

-   Verify data saves and loads with no skipped questions.

* * * * *

**Source of Truth:**

-   HAEVN_Onboarding_Survey_Master_DEV 09222025 Update (2).xlsx

-   HAEVN-SURVEY-conditional-branch.xlsx

-   Rick (JNR) call feedback --- branching starts only in **Relationship Preferences**, not before.

* * * * *

Once you review and confirm, this will be saved as

CONDITIONAL_LOGIC_CONTEXT.md --- the file Claude reads first before applying survey logic fixes.