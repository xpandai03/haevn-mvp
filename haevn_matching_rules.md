Got it --- the next most useful context file is **haevn_matching_rules.md**.

This will distill Rik's *Matching Instructions* PDF into something Claude can reference quickly.

Here's a draft structure:

* * * * *

**haevn_matching_rules.md**
===========================

**Overview**
------------

Matching in HAEVN is **survey-driven**. Each partnership's compatibility score is calculated from individual + shared survey responses.

Weights are applied across four pillars:

-   **Boundaries (40%)**

-   **Intentions (30%)**

-   **Attractions (20%)**

-   **Identity (10%)**

Compatibility outputs a **0--100 score**, bucketed into:

-   High (≥75)

-   Medium (45--74)

-   Low (<45)

* * * * *

**Scoring Methods**
-------------------

1.  **Binary**

    -   1 = perfect match, 0 = no match.

    -   Example: "Kids in the future?"

2.  **Jaccard Similarity**

    -   Overlap ÷ Union of selections.

    -   Example: "Kinks we're into."

3.  **Matrix Lookup**

    -   Predefined scoring table for cross-values.

    -   Example: "Relationship orientation" (Mono vs Poly).

4.  **Distance-Based**

    -   Numerical scale differences normalized.

    -   Example: "Desired age range."

5.  **Sum Bonus**

    -   Extra points for aligned optional values.

* * * * *

**Workflow**
------------

1.  **Collect survey responses** → store as JSON.

2.  **Apply scoring function per field**.

3.  **Weight category totals** according to pillar distribution.

4.  **Aggregate into final 0--100 score**.

5.  **Assign bucket**.

* * * * *

**Rules**
---------

-   **All partners must complete survey** before matches unlock.

-   **Advocate mode**: scores calculated even if only Partner A completes (flagged as partial).

-   **Free tier**: see compatibility bucket but not partner details.

-   **Photo reveal**: locked until handshake.

* * * * *

Would you like me to flesh this out with **specific question-to-method mappings** (e.g., "Q23 uses Jaccard," "Q10 uses Binary") based on the Matching Instructions PDF, or keep it high-level for now?