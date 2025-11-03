# HAEVN User Onboarding Flow - Complete Question List

## Overview
This document captures all questions asked to users during signup and onboarding, from welcome screen to dashboard. The flow consists of 10 steps with 60+ questions, including conditional logic.

---

## STEP 1: Account Creation (/auth/signup)
**Screen Type:** Signup Form

**Questions Asked:**
1. What is your name?
2. What is your email?
3. Create a password
4. What is your zip code? (validates city availability - live or waitlist)

**User Actions:**
- Submit to create account
- Auto-login after successful signup
- System stores onboarding progress in localStorage

**Routes to:** `/onboarding/expectations`

---

## STEP 2: Expectations ("Before We Continue") (/onboarding/expectations)
**Screen Type:** Informational Page

**Content Presented (Not Questions):**
- Takes 10-15 minutes to complete full setup
- Progress saves automatically
- Can come back anytime
- Every step matters (required for introductions)

**User Action:** Continue button

**Routes to:** `/onboarding/welcome`

---

## STEP 3: Welcome Screen (/onboarding/welcome)
**Screen Type:** Informational/Educational Page

**Content Presented (Not Questions):**
Three key value propositions:
1. Built for real relationships (solo, partnered, pods)
2. Community, not just dating (dates, friends, play partners, events)
3. Verified, safe, and private (verified members, consent-based)

**User Action:** "Let's Start" button

**Routes to:** `/onboarding/identity`

---

## STEP 4: Identity Questions (/onboarding/identity)
**Screen Type:** Multi-select Form

### Question 1: Profile Type (REQUIRED)
**Question:** "I am here as..."
**Options:**
- Solo
- Couple
- Pod

**Impact:** Determines what types of connections to show

### Question 2: Relationship Orientation (REQUIRED)
**Question:** "My relationship orientation is..."
**Options:**
- Monogamous
- Open
- Polyamorous
- Exploring
- Other/Prefer to describe

**Impact:** Core matching parameter

**Data Storage:** Saved to partnerships table with profile_type and relationship_orientation fields

**Routes to:** `/onboarding/verification`

---

## STEP 5: Verification (/onboarding/verification)
**Screen Type:** Identity Verification Flow

**Process (No Direct Questions, But User Action Required):**
- Uses third-party provider (Veriff) for liveness check
- Requires selfie video + government ID verification
- ID is encrypted and never stored by HAEVN

**Key Info Presented:**
- Covers: Liveness check, ID verification, age confirmation
- Privacy: ID handled by trusted third-party, encrypted
- Result: Verified badge unlocks full access to introductions

**User Options:**
1. Start Verification (redirects to Veriff)
2. Skip for Now (allowed in Phase 1, continues to survey)

**Routes to:** `/onboarding/survey-intro`

---

## STEP 6: Survey Introduction (/onboarding/survey-intro)
**Screen Type:** Informational Page

**Key Information Presented (Not Questions):**
- Survey is foundation of HAEVN
- Answers are private (only used for matching)
- Progress saves automatically
- Can take breaks and return anytime
- It's required (without it, can't make introductions)

**User Action:** "Start the survey" button

**Routes to:** `/onboarding/survey`

---

## STEP 7: Relationship Survey (/onboarding/survey)
**Screen Type:** Dynamic Multi-Section Questionnaire with Conditional Logic

The survey has **8 sections** with **60+ questions**

---

### SECTION 1: Basic Information

#### Q1: Age (REQUIRED)
**Question:** "How old are you?"
**Input Type:** Number (18-120)

#### Q2: Gender Identity (REQUIRED)
**Question:** "What is your gender identity?"
**Options:**
- Man
- Woman
- Non-binary
- Trans man
- Trans woman
- Genderfluid
- Agender
- Two-Spirit
- Other

#### Q2a: Pronouns (REQUIRED)
**Question:** "What are your pronouns?"
**Options:**
- she/her
- he/him
- they/them
- she/they
- he/they
- ze/zir
- xe/xem
- Other

#### Q3: Sexual Orientation (REQUIRED)
**Question:** "What is your sexual orientation?"
**Options:**
- Straight
- Gay/Lesbian
- Bisexual
- Pansexual
- Queer
- Fluid
- Asexual
- Demisexual
- Questioning/Unsure
- Prefer not to say
- Other

#### Q3a: Fidelity Definition (CONDITIONAL - Textarea)
**Question:** "How do you define fidelity in your relationships?"
**Condition:** Shows IF Q3 is {Bisexual, Pansexual, Queer, Fluid, Other} AND Q4 is {Single, Solo Poly, Dating}
**Input Type:** Long text area

#### Q3b: Kinsey Scale (CONDITIONAL)
**Question:** "Where do you fall on the Kinsey scale?"
**Condition:** Shows IF Q3 is {Bisexual, Pansexual, Queer, Fluid, Other}
**Options:**
- 0: Exclusively heterosexual
- 1: Predominantly heterosexual, incidentally homosexual
- 2: Predominantly heterosexual, more than incidentally homosexual
- 3: Equally heterosexual and homosexual
- 4: Predominantly homosexual, more than incidentally heterosexual
- 5: Predominantly homosexual, incidentally heterosexual
- 6: Exclusively homosexual

#### Q3c: Partner Kinsey Preference (CONDITIONAL - Multiselect)
**Question:** "What Kinsey scale range are you interested in for potential partners?"
**Condition:** Shows IF Q3 is {Bisexual, Pansexual, Queer, Fluid, Other}
**Options:** (Can select multiple)
- 0: Exclusively heterosexual
- 1: Predominantly heterosexual
- 2: Mostly heterosexual
- 3: Bisexual/Fluid
- 4: Mostly homosexual
- 5: Predominantly homosexual
- 6: Exclusively homosexual
- Open to any

#### Q4: Relationship Status (REQUIRED)
**Question:** "What is your current relationship status?"
**Options:**
- Single
- Dating
- Married
- Partnered
- Couple
- In a polycule
- Solo Poly
- Exploring
- Prefer not to say

---

### SECTION 2: Relationship Preferences

#### Q6: Relationship Styles (REQUIRED)
**Question:** "What relationship style(s) are you interested in?"
**Options:**
- Monogamous
- Monogamish
- ENM (Ethical Non-Monogamy)
- Polyamorous
- Open
- Exploring

#### Q6a: Connection Type (REQUIRED - Multiselect)
**Question:** "I'm looking to connect..."
**Options:** (Can select multiple)
- As an individual
- As a couple
- As a polycule/pod
- Open to any

#### Q6b: Who to Meet (REQUIRED - Multiselect)
**Question:** "I'm interested in meeting..."
**Options:** (Can select multiple)
- Individuals
- Couples
- People of any gender
- People of specific genders
- Groups/communities

#### Q6c: Couple Connection (CONDITIONAL)
**Question:** "How do you and your partner(s) connect with others?"
**Condition:** Shows IF Q4 is {Dating, Married, Partnered, Couple}
**Options:**
- Always together
- Separately with permission
- Separately without needing permission
- Custom / differs by partner

#### Q6d: Couple Permissions (CONDITIONAL - Textarea)
**Question:** "Please describe your arrangement:"
**Condition:** Shows IF Q6c = 'Custom / differs by partner'
**Input Type:** Text area

#### Q7: Emotional Exclusivity (CONDITIONAL)
**Question:** "How would you describe your approach to emotional exclusivity?"
**Condition:** Shows IF Q6 is {Monogamish, Open, Polyamorous, Exploring}
**Input Type:** Slider (1-10)
- 1 = Completely open to deep emotional bonds with multiple people
- 10 = Prefer to reserve deep emotional intimacy for one person

#### Q8: Sexual Exclusivity (CONDITIONAL)
**Question:** "How would you describe your approach to sexual exclusivity?"
**Condition:** Shows IF Q6 is {Monogamish, Open, Polyamorous, Exploring}
**Input Type:** Slider (1-10)
- 1 = Completely open to sexual connections with multiple people
- 10 = Prefer sexual exclusivity with one person

#### Q9: Intentions (REQUIRED - Multiselect)
**Question:** "What are you looking for? (Select all that apply)"
**Options:** (Can select multiple)
- Long-term partnership
- Casual dating
- Play partners
- Community
- Friendship
- Learning/exploration
- Not sure yet

#### Q9a: Sex or More (OPTIONAL)
**Question:** "Are you primarily looking for sex, or something more?"
**Options:**
- Primarily sex
- Primarily relationship/connection
- Both equally
- Not sure yet

---

### SECTION 3: Communication & Connection

#### Q10: Attachment Style (REQUIRED)
**Question:** "What's your attachment style?"
**Options:**
- Secure
- Anxious
- Avoidant
- Disorganized
- Not sure

#### Q10a: Emotional Availability (REQUIRED)
**Question:** "How emotionally available are you right now?"
**Input Type:** Slider (1-10)
- 1 = Not very available
- 10 = Very available

#### Q11: Love Languages (REQUIRED - Multiselect)
**Question:** "What are your primary love languages?"
**Options:** (Can select multiple)
- Words of affirmation
- Quality time
- Physical touch
- Acts of service
- Receiving gifts

#### Q12: Conflict Resolution (CONDITIONAL)
**Question:** "How do you prefer to handle conflict?"
**Condition:** Shows IF Q4 = 'Single' AND Q6 is {Monogamous, Monogamish, Polyamorous}
**Options:**
- Talk it through immediately
- Take time to process first
- Prefer mediation/neutral third party
- Avoid conflict when possible
- Depends on the situation

#### Q12a: Messaging Pace (REQUIRED)
**Question:** "What's your ideal messaging pace with someone you're interested in?"
**Options:**
- Constant communication throughout the day
- Multiple times daily
- Once a day
- Every few days
- Only when we're meeting in person
- Flexible/depends on connection

---

### SECTION 4: Lifestyle & Values

#### Q13: Lifestyle Alignment (REQUIRED)
**Question:** "How important is lifestyle alignment to you?"
**Input Type:** Slider (1-10)
- 1 = Not important, opposites attract
- 10 = Very important, need similar lifestyle

#### Q13a: Languages (REQUIRED)
**Question:** "What language(s) do you speak?"
**Input Type:** Text field

#### Q14a: Cultural Alignment (OPTIONAL)
**Question:** "How important is cultural or ethnic alignment to you?"
**Input Type:** Slider (1-10)
- 1 = Not important
- 10 = Very important

#### Q14b: Cultural Identity (OPTIONAL - Textarea)
**Question:** "Tell us about your cultural or ethnic background (optional):"
**Input Type:** Text area

#### Q15: Time Availability (REQUIRED)
**Question:** "How much time do you have available for new connections?"
**Options:**
- Unlimited - I have lots of time
- Several days per week
- Once or twice a week
- A few times a month
- Once a month or less
- Varies greatly

#### Q16: Typical Availability (REQUIRED - Multiselect)
**Question:** "When are you typically available?"
**Options:** (Can select multiple)
- Weekday mornings
- Weekday afternoons
- Weekday evenings
- Weekend days
- Weekend evenings
- Late nights
- Flexible/varies

#### Q16a: First Meet Preference (REQUIRED)
**Question:** "For a first meeting, I prefer:"
**Options:**
- Coffee or tea
- Drinks at a bar
- Meal/dinner
- Activity or event
- Video call first
- Group event or mixer
- Flexible/open to suggestions

#### Q18: Substances (REQUIRED)
**Question:** "What's your relationship with alcohol and substances?"
**Options:**
- Completely sober
- Social drinker
- Regular drinker
- Cannabis-friendly
- 420 friendly
- Sober curious
- In recovery
- Prefer not to say

#### Q19a: Max Distance (REQUIRED)
**Question:** "What's the maximum distance you'd be willing to travel for a connection?"
**Options:**
- My neighborhood only
- Within 10 miles
- Within 25 miles
- Within 50 miles
- Within 100 miles
- Any distance

#### Q19b: Distance Priority (OPTIONAL)
**Question:** "How much does distance matter to you?"
**Options:**
- Must be close by
- Prefer close but open to travel
- Distance doesn't matter much
- Open to long-distance

#### Q19c: Mobility (OPTIONAL)
**Question:** "Do you have any mobility considerations we should know about?"
**Options:**
- No limitations
- Prefer accessible venues
- Limited mobility
- Use mobility aid
- Prefer not to say

---

### SECTION 5: Privacy & Community

#### Q20: Discretion (REQUIRED)
**Question:** "How important is discretion/privacy to you?"
**Input Type:** Slider (1-10)
- 1 = I'm an open book
- 10 = Very private/discreet

#### Q20a: Photo Sharing (OPTIONAL)
**Question:** "When are you comfortable sharing photos?"
**Options:**
- Yes, immediately
- After we've chatted a bit
- After we've met in person
- Very selective about photo sharing
- I prefer not to share photos

#### Q20b: How "Out" (REQUIRED)
**Question:** "How 'out' are you about your relationship style?"
**Options:**
- Completely private, no one knows
- Only close friends know
- Most people in my life know
- Fully open and public
- It depends on the context

#### Q21: Platform Use (REQUIRED - Multiselect)
**Question:** "What are you hoping to use this platform for?"
**Options:** (Can select multiple)
- Dating and connections
- Learning about non-monogamy
- Attending events
- Finding community
- Support and resources
- Sexual exploration
- Not sure yet, just exploring

#### Q22: Spirituality & Sexuality (OPTIONAL)
**Question:** "Do spirituality and sexuality intersect for you?"
**Options:**
- Yes, deeply connected
- Somewhat connected
- Not really connected
- Not sure
- Prefer not to say

---

### SECTION 6: Intimacy & Sexuality

#### Q23: Erotic Styles (REQUIRED - Multiselect)
**Question:** "Which of these describe your erotic style(s)?"
**Options:** (Can select multiple)
- Sensual
- Playful
- Romantic
- Kinky
- Vanilla
- Experimental
- Tantric
- Primal
- Still exploring/learning

#### Q24: Experiences (REQUIRED - Multiselect)
**Question:** "What kinds of experiences are you interested in?"
**Options:** (Can select multiple)
- Private one-on-one encounters
- Play parties
- Workshops and classes
- Retreats or immersive events
- Online/virtual exploration
- Group dynamics
- One-on-one only

#### Q25: Chemistry vs Emotion (REQUIRED)
**Question:** "In intimate connections, how do you balance physical chemistry and emotional connection?"
**Input Type:** Slider (1-10)
- 1 = Physical chemistry is most important
- 10 = Emotional connection is most important

#### Q25a: Frequency (REQUIRED)
**Question:** "How often do you typically want sexual intimacy in a relationship?"
**Options:**
- Daily
- Several times per week
- Weekly
- A few times per month
- Monthly
- Occasionally
- Rarely
- It varies greatly

#### Q26: Roles (OPTIONAL - Multiselect)
**Question:** "Do you identify with any of these roles in intimate contexts?"
**Options:** (Can select multiple)
- Dominant
- Submissive
- Switch
- Top
- Bottom
- Verse
- Master/Mistress
- Slave/servant
- Primal
- Caregiver
- Little
- Pet/animal
- None of these
- Still exploring

#### Q27: Physical Preferences (OPTIONAL)
**Question:** "Are there physical traits or types you're particularly drawn to? (Optional - be respectful)"
**Input Type:** Text field

#### Q28: Hard Boundaries (REQUIRED - Multiselect)
**Question:** "What are your hard boundaries? (Select all that apply)"
**Options:** (Can select multiple)
- No pain play
- No marks/bruises
- No photos or video
- No group play
- No substances during play
- No roleplay scenarios
- No power exchange
- Other (please specify)

#### Q29: Maybe Boundaries (OPTIONAL - Multiselect)
**Question:** "What are your 'maybe' or soft boundaries - things you might explore with the right person/context?"
**Options:** (Can select multiple)
- Impact play
- Restraints/bondage
- Roleplay
- Group play
- Power exchange
- Sensation play
- Public play
- Recording/photos
- Other

#### Q30: Safer Sex (REQUIRED - Multiselect)
**Question:** "What safer sex practices are important to you?"
**Options:** (Can select multiple)
- Barrier use (condoms, dental dams) always
- Barriers with new partners
- Regular STI testing
- PrEP/PEP awareness
- Fluid bonding only with long-term partners
- Discussion before any intimacy
- Other

#### Q30a: Fluid Bonding (OPTIONAL)
**Question:** "What's your approach to fluid bonding?"
**Options:**
- Only with long-term committed partners
- With multiple trusted partners
- After testing and discussion
- Not interested in fluid bonding
- Not sure yet

#### Q31: Health Testing (REQUIRED)
**Question:** "How often do you get tested for STIs?"
**Options:**
- Regularly (every 3 months)
- Quarterly (every 3-4 months)
- Biannually (every 6 months)
- Annually
- Before new partners
- It's been a while
- Prefer not to say
- Other

---

### SECTION 7: Personal Expression

#### Q32: Looking For (REQUIRED - Textarea)
**Question:** "In your own words, what are you looking for here?"
**Input Type:** Long text area
**Purpose:** Open-ended expression of desires and goals

#### Q33: Kinks (OPTIONAL - Multiselect)
**Question:** "Are there specific kinks or interests you'd like to explore? (Optional - select all that apply)"
**Options:** (Can select multiple)
- BDSM
- Rope/bondage
- Impact play
- Roleplay
- Age play
- Pet play
- Sensory play
- Voyeurism/exhibitionism
- Group dynamics
- Tantra
- Edging/orgasm control
- Cuckolding/hotwifing
- Polyamory-specific dynamics
- Primal play
- Other

#### Q33a: Experience Level (CONDITIONAL)
**Question:** "What's your experience level with these interests?"
**Condition:** Shows IF Q33 is answered
**Options:**
- Very experienced
- Some experience
- Curious beginner
- Just exploring the idea

---

### SECTION 8: Personality Insights

All questions in this section use **Slider format (1-10)** where:
- 1 = Strongly disagree
- 10 = Strongly agree

#### Q34: Exploration (REQUIRED)
**Statement:** "I enjoy exploring new erotic or relational experiences."
**Input Type:** Slider (1-10)

#### Q34a: Variety (REQUIRED)
**Statement:** "I'm drawn to variety and creativity in intimacy."
**Input Type:** Slider (1-10)

#### Q35: Agreements (REQUIRED)
**Statement:** "I value clear agreements and follow through on commitments."
**Input Type:** Slider (1-10)

#### Q35a: Structure (REQUIRED)
**Statement:** "I like erotic and relational experiences to have some structure or plan."
**Input Type:** Slider (1-10)

#### Q36: Social Energy (REQUIRED)
**Statement:** "I gain energy from social or erotic spaces with multiple people."
**Input Type:** Slider (1-10)

#### Q36a: Outgoing (REQUIRED)
**Statement:** "In new erotic or social situations, I'm usually outgoing and expressive."
**Input Type:** Slider (1-10)

#### Q37: Empathy (REQUIRED)
**Statement:** "I'm empathetic and attuned to my partner's emotional needs."
**Input Type:** Slider (1-10)

#### Q37a: Harmony (REQUIRED)
**Statement:** "I like finding harmony and avoiding unnecessary conflict in relationships."
**Input Type:** Slider (1-10)

#### Q38: Jealousy (OPTIONAL)
**Statement:** "I sometimes struggle with jealousy or insecurity in relationships."
**Input Type:** Slider (1-10)

#### Q38a: Emotional Reactivity (OPTIONAL)
**Statement:** "I can be emotionally reactive in intimate or erotic situations."
**Input Type:** Slider (1-10)

---

## Survey Features

**Auto-Save:**
- Survey responses auto-save every 500ms (debounced)
- Can pause and resume at any time
- "Save & Exit" button available throughout

**Progress Tracking:**
- Progress bar showing completion percentage
- Section celebrations when section completes
- Auto-detection of 100% completion

**Navigation:**
- Back/Previous button (except at first question)
- Can review and change previous answers
- Auto-advances when 100% complete

**Conditional Rendering:**
- Questions appear/disappear based on skip logic
- Seamless experience for conditional branches

**Routes to:** `/onboarding/celebration` (auto-advances when 100% complete)

---

## STEP 8: Celebration Page (/onboarding/celebration)
**Screen Type:** Achievement/Confirmation Page

**Content Presented (Not Questions):**
- Congratulatory message: "You're all set!"
- Confirmation: "Your survey is complete. We'll use your responses to help you find compatible connections."
- What happens next:
  1. We'll review your responses to find compatible people
  2. Explore dashboard, update profile, see potential matches
  3. Choose membership plan to unlock messaging

**User Action:** "Choose your membership" button

**Routes to:** `/onboarding/membership`

---

## STEP 9: Membership Selection (/onboarding/membership)
**Screen Type:** Pricing/Plans Comparison Page

**Question (Implicit):** "Which membership tier would you like?"

### HAEVN Free ($0 - Forever)
**Features:**
- View compatibility scores
- Limited daily matches
- Basic profile

**Limitations:**
- No messaging
- No photo sharing
- No advanced filters

### HAEVN Plus ($19.99/month) - **MARKED AS "MOST POPULAR"**
**Features:**
- Unlimited matches
- Send likes and nudges
- Chat after handshake
- Share photos
- Advanced filters
- Priority support

**Limitations:** None

### HAEVN Select ($49.99/month)
**Features:**
- Everything in Plus +
- Verified badge
- Concierge matchmaking
- First access to new features
- Exclusive events
- Background verification

**Limitations:** None

**User Flow:**
- If "Free" selected: Toast notification + routes to `/dashboard`
- If "Plus" or "Select" selected: Routes to `/onboarding/payment?tier={tierId}`

---

## STEP 10: Dashboard (/dashboard)
**Screen Type:** Home/Feed Page

**Available Features (No Questions, Active Use Phase):**
- View potential matches (matching algorithm based on survey responses)
- Compatibility scores
- Match details modal
- Connection/handshake notifications
- Nudges
- Profile settings
- Sign out

**Key Actions:**
- View matches
- Send likes/nudges (depending on membership)
- Initiate handshakes
- Message (if membership allows)
- Update profile

---

## Conditional Logic Summary

### Major Conditional Branches:

#### 1. Sexual Orientation Branch
**Trigger:** Q3 = {Bisexual, Pansexual, Queer, Fluid, Other}
**Shows:**
- Q3b: Kinsey Scale question
- Q3c: Partner Kinsey preferences
- Q3a: Fidelity definition (if also Single/Solo Poly/Dating)

#### 2. Relationship Status Branch
**Trigger:** Q4 = {Dating, Married, Partnered, Couple}
**Shows:**
- Q6c: Couple connection type
- Q6d: Couple permissions (if "Custom")

#### 3. Relationship Style Branch
**Trigger:** Q6 = {Monogamish, Open, Polyamorous, Exploring}
**Shows:**
- Q7: Emotional exclusivity slider
- Q8: Sexual exclusivity slider

#### 4. Kink Experience Branch
**Trigger:** Q33 (kinks) is answered
**Shows:**
- Q33a: Experience level with those kinks

---

## Onboarding State Tracking

### Stored Completion Flags:
- `expectations_viewed` - User saw time estimate
- `welcome_viewed` - User saw welcome/values screen
- `identity_completed` - User answered profile type + orientation
- `verification_skipped` - User skipped ID verification (optional in Phase 1)
- `survey_intro_viewed` - User saw survey introduction
- `survey_completed` - User completed all required survey questions (100%)
- `celebration_viewed` - User saw completion celebration
- `membership_selected` - User chose a membership tier

### Progress Calculation:
- Based on required steps completed
- Excludes verification (optional in Phase 1)
- Shows percentage complete in progress indicators

### Resume Capability:
- Auto-saves all survey progress to database
- Can resume from exact question left off
- Safe for logout/return workflows
- localStorage tracks onboarding state

---

## Key File Locations

1. **Onboarding Flow:** `/lib/onboarding/flow.ts` - Defines steps and navigation
2. **Survey Questions:** `/lib/survey/questions.ts` - All 60+ questions with skip logic
3. **Database Schema:** `/lib/db/onboarding.ts` - State persistence
4. **Server Actions:** `/lib/actions/onboarding.ts` - Backend operations
5. **Survey Pages:** `/app/onboarding/survey/page.tsx` - Interactive survey UI
6. **Individual Steps:** `/app/onboarding/[step]/page.tsx` - Each onboarding screen component

---

## Total Question Count

**Direct Questions: 60+**
- Account creation: 4 questions
- Identity: 2 questions
- Survey Section 1: 5 required + 3 conditional = 8 questions
- Survey Section 2: 4 required + 5 conditional = 9 questions
- Survey Section 3: 5 questions
- Survey Section 4: 10 questions
- Survey Section 5: 5 questions
- Survey Section 6: 12 questions
- Survey Section 7: 2 questions
- Survey Section 8: 10 questions
- Membership: 1 implicit question (tier selection)

**Total: 68 questions** (including conditional branches when triggered)

---

## User Experience Highlights

1. **Progressive Disclosure:** Questions appear contextually based on previous answers
2. **No Dead Ends:** All paths lead to dashboard, even with minimal answers
3. **Privacy First:** Survey answers are private, used only for matching
4. **Flexibility:** Can pause/resume at any point
5. **Transparency:** Clear explanations at each step about why information is needed
6. **Optional Verification:** Can skip ID verification in Phase 1
7. **Freemium Model:** Can use free tier or upgrade to paid plans
