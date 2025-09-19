# HAEVN Onboarding Survey – Context File

This file defines the **survey questions, structure, and logic** for the HAEVN onboarding process.  
It combines insights from the Survey Master Excel, Onboarding Draft, and Matching Instructions.  

---

## Survey Overview
- **Purpose**: Collect consistent, partner-contributed data to generate a merged partnership profile.  
- **Completion Rule**: 100% survey completion by all partners is required to unlock Discovery.  
- **Sections**: Identity → Intentions → Boundaries → Logistics.  
- **Gating**:  
  - Survey must be complete before Discovery.  
  - City must be "live" for Discovery (waitlist = no discovery).  
  - Membership tier controls discovery/chat access.  

---

## Survey Structure

### Section 1: Identity
- **Fields**: Name, Age, Pronouns, Gender Identity, Orientation.  
- **Notes**:  
  - Each partner fills individually.  
  - Data merges into partnership profile (e.g. Alex & Jordan).  

### Section 2: Intentions
- **Question**: “What are you looking for on HAEVN?”  
- **Options** (multi-select): Dating, Casual, Marriage, Friendship, Events, Exploration.  
- **Logic**:  
  - Alignment across partners → strengthens compatibility.  
  - Divergence → lowers score (Marriage vs Casual = big drop).  

### Section 3: Boundaries
- **Questions**:  
  - “How do you describe your relationship structure?”  
    - Options: Monogamous, Polyamorous, Open, Flexible.  
  - “What level of privacy do you prefer?”  
    - Options: Very Private, Somewhat Private, Open, Flexible.  
  - “What are your dealbreakers?” (free text / checklist).  
- **Logic**:  
  - Hard gates: mismatched dealbreakers = Low compatibility regardless of other answers.  
  - Privacy mismatches heavily weighted.  

### Section 4: Logistics
- **Questions**:  
  - City (dropdown – check against live/waitlist).  
  - Availability (weeknights, weekends, flexible, travel).  
  - Lifestyle tags (multi-select chips).  
- **Logic**:  
  - City status checked before discovery.  
  - Lifestyle tags improve nuance of compatibility scoring.  

---

## Compatibility Scoring Weights
- **Intent Alignment**: 40%  
- **Relationship Structure**: 35%  
- **Privacy Alignment**: 25%  
- **Lifestyle/Other**: bonus points  

---

## Skip Logic
- If “Monogamous” selected → skip questions about multiple partners.  
- If “Very Private” → skip lifestyle tags that would imply open identity.  
- If “Marriage” selected → trigger long-term intentions questions.  

---

## Profile Integration
- Survey answers populate the **partnership profile**:  
  - Public pre-handshake: short_bio, intentions, city.  
  - Gated post-handshake: long_bio, lifestyle tags, orientation, structure.  
  - Private: dealbreakers, sensitive notes.  

---

## Open Items
- Confirm **final text** for each survey question from Survey Master Excel.  
- Confirm if **different flows** (single vs couple vs throuple) should exist.  
- Validate weighting system with Rik before launch.  