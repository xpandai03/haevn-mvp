
Let me restate your understanding back to you **exactly**, then I'll lock the definitions so we don't drift again.

* * * * *

**✅ Your intended model (confirmed)**
-------------------------------------

> When a **Pro user** sees a **system-recommended match** and clicks **Connect**:

-   > If the **other user is Pro** → it becomes a **pending connection request** for them

-   > If the **other user is Free** → it becomes a **Nudge** for them

>

> In both cases:

-   > The initiating Pro user is expressing *intent*

-   > The recipient sees a *signal*

-   > The difference is **what actions are unlocked on the receiving side**

✅ **This is correct.**

✅ This matches your product intent.

✅ This matches how we should test the system.

* * * * *

**🔑 Let's lock the model with precise language**
-------------------------------------------------

### **1️⃣ Match (system-generated)**

-   Created by the matching engine

-   Exists **before any user intent**

-   Shown to both users

-   No communication yet

* * * * *

### **2️⃣ Connect (Pro user action)**

**Connect = "I want to connect with this match."**

This is a **single action** by the initiating Pro user.

What happens next depends on the recipient's tier.

* * * * *

### **3️⃣ Recipient outcomes (branching logic)**

#### **A) Recipient is **

#### **Pro**

-   A **pending connection request** appears for them

-   They can:

    -   Accept → Connection formed → Profile + Chat unlocked

    -   Decline → Nothing happens

#### **B) Recipient is **

#### **Free**

-   A **Nudge** appears for them

-   They can:

    -   See that someone is interested

    -   **Not respond**

    -   Must upgrade to act

-   No connection or chat yet

So:

> **Nudge is not a separate user action.**

> **It is the Free-user representation of a Connect attempt.**

That's the cleanest way to think about it.

* * * * *

**🧠 Why this framing matters (and why you're right)**
------------------------------------------------------

Instead of thinking:

-   "Connect" vs "Nudge" as two different buttons/actions

You're correctly thinking:

-   **Connect is the action**

-   **Nudge is the downgraded receipt state**

This avoids:

-   duplicate logic

-   confusing UX

-   separate test paths too early

* * * * *

**🧪 How this affects testing (important)**
-------------------------------------------

### **Core test you're about to run**

You should test **Connect behavior**, not "Nudge behavior" separately.

The test matrix is:

|

**Initiator**

 |

**Recipient**

 |

**Expected Result**

 |
| --- | --- | --- |
|

Pro

 |

Pro

 |

Pending connection request

 |
|

Pro

 |

Free

 |

Nudge appears

 |
|

Free

 |

Anyone

 |

Cannot initiate Connect

 |

So the flow you test is:

```
Match
→ Pro clicks Connect
→ Recipient sees:
     - Connection request (if Pro)
     - Nudge (if Free)
```

Everything else (upgrade, chat) comes later.

* * * * *

**🔒 Final locked definitions (use these going forward)**
---------------------------------------------------------

-   **Match** = system suggestion

-   **Connect** = Pro expresses intent

-   **Pending Connection** = Pro recipient state

-   **Nudge** = Free recipient state of a Connect

-   **Connection** = mutual Pro consent

-   **Chat** = unlocked by Connection only

If you stick to this language, the system stays coherent.

* * * * *

**✅ Conclusion**
----------------

-   Yes, we are aligned

-   Your understanding is correct

-   This is the right abstraction

-   This is the right time to test it

-   And it explains why "Nudge ≠ Connect" but **is downstream of Connect**

Next step, if you want:

I can rewrite the **end-to-end test checklist** using this exact branching model so you can validate both Pro→Pro and Pro→Free paths cleanly without confusion.
You are working on the HAEVN codebase.

Before proposing any new features or fixes, you must **align with the product's mental model**, which is documented in:

> **haevn-mental-model.md**

This file defines the authoritative meanings of:

-   Match

-   Connect

-   Nudge

-   Pending Connection

-   Connection

-   Profile visibility

-   Chat gating

You must treat that file as **ground truth**.

* * * * *

**🎯 OBJECTIVE**
----------------

Determine what remains to be **tested, validated, or minimally hardened** to make HAEVN **usable**, defined as:

> Two users can match, express interest, connect, view each other's profiles, and chat --- without system confusion.

This is NOT a feature roadmap.

This is a **usability readiness checklist**.

* * * * *

**🧪 YOUR TASK**
----------------

### **Step 1 --- Restate the Core Loop (Briefly)**

Using haevn-mental-model.md, restate the intended flow:

```
Match → Connect → (Pending/Nudge) → Accept → Profile View → Chat
```

Confirm no ambiguity.

* * * * *

### **Step 2 --- Produce a Step-by-Step Test Plan**

Create a **manual test checklist** covering:

1.  Pro → Pro flow

2.  Pro → Free flow

3.  Profile visibility before and after connection

4.  Chat creation and persistence

For each step, include:

-   Action taken

-   Expected system behavior

-   What record/state should exist (conceptually)

* * * * *

### **Step 3 --- Identify Likely Failure Points**

For each step, list:

-   Where bugs are most likely (UI surface, query, state mismatch)

-   What to check if it fails (without writing code yet)

* * * * *

### **Step 4 --- Classify Remaining Work**

Separate remaining items into:

-   **Must-fix to be usable**

-   **Nice-to-have polish**

-   **Explicitly defer**

Be conservative.

* * * * *

**🚫 CONSTRAINTS**
------------------

-   ❌ Do NOT propose new features

-   ❌ Do NOT redesign UI

-   ❌ Do NOT change the mental model

-   ❌ Do NOT write code yet

This is about **testing and validation**, not building.

* * * * *

**🛑 STOP CONDITION**
---------------------

End your response with:

> **"This test plan reflects the HAEVN mental model and defines the remaining path to usability."**

* * * * *
