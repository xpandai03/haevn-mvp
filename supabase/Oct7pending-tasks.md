Perfect --- sounds like you made major progress tonight 🔥

Let's lock in a clean **morning roadmap** so you can wake up and move fast without re-context switching.

* * * * *

**☀️ HAEVN Morning Sprint Plan**
--------------------------------

### **🧩 1️⃣ Finalize Profile Data Layer**

**Goal:** Ensure the /partner-profile screen is 100% live and stable.

-   Verify Supabase profiles + partnerships tables both sync.

-   Confirm avatarUrl, username, and tier fields persist and update.

-   Remove redundant /settings references.

-   Add redirect /settings → /partner-profile.

🪄 *Prompt to use:*

> "Claude, help me refactor the /settings route to redirect to /partner-profile and confirm all live profile fields persist correctly after refresh."

* * * * *

### **💬 2️⃣ Implement "Handshake" Flow**

**Goal:** Enable partner matching / invite / acceptance.

-   Build lightweight "Invite Partner" modal.

-   Trigger partnership creation (partner_email or code).

-   Handle "pending handshake" and "confirmed partnership" states.

-   Confirm UI reflects connection dynamically.

🪄 *Prompt to use:*

> "Claude, create a simple 'Invite Partner' modal that triggers a Supabase insert into partnership_requests and updates the partnerships table when accepted. Use the same design language as the profile page."

* * * * *

### **🖥️ 3️⃣ Build Core Dashboard**

**Goal:** Bring the app past the payment success screen into the main experience.

-   Dashboard cards for Matches / Connections / Nudges (from the UI PDF).

-   Make these cards link to detailed list pages.

-   Pull live stats from Supabase partnerships, signals, handshakes tables.

-   Add a CTA "Go to Partner Profile."

🪄 *Prompt to use:*

> "Claude, help me scaffold the main HAEVN dashboard (Matches, Connections, Nudges) using the same design tokens as Partner Profile. Use real data from Supabase stats hooks."

* * * * *

### **🧠 4️⃣ "Polish Pass" (Design Fidelity)**

**Goal:** Bring the new pages visually in line with the PDF and branding doc.

-   Check typography weights (Roboto Black / Medium / Light).

-   Verify all brand colors (#E8E6E3, #1E2A4A, #E29E0C, #008080, #252627).

-   Center and scale the HAEVN logo consistently.

-   Align margins and white space using Tailwind spacing tokens.

🪄 *Prompt to use:*

> "Claude, do a design polish pass across /partner-profile and /dashboard to ensure every color, font, and spacing matches the HAEVN Branding Guidelines PDF."

* * * * *

### **🚀 5️⃣ Deployment & Testing Prep**

**Goal:** Get ready for live testing by tomorrow night.

-   Run full Supabase auth test for new users → onboarding → dashboard → profile.

-   Verify mobile responsiveness.

-   Add Vercel build pipeline.

-   Push staging deployment link.

🪄 *Prompt to use:*

> "Claude, help me create a production-ready Vercel deploy plan for the HAEVN app, including environment variables for Supabase URL and anon key."

* * * * *

### **✅ Priority Order for Tomorrow**

1.  **Finish data + redirect (1 hr)**

2.  **Implement handshake flow (1.5 hrs)**

3.  **Scaffold dashboard base (1 hr)**

4.  **Quick design polish (30 min)**

5.  **Deploy to staging (15 min)**

* * * * *

Would you like me to turn this into a **timestamped 3-hour "morning build checklist"** (like 8--11 AM with prompts + targets per 30 min)?

That version keeps you locked in flow when you start coding again.