# HAEVN Testing Guide
*Updated: October 8, 2025*

This guide will walk you through testing all the features we've built so far.

---

## 🚀 Quick Start

**Access the app:**
1. Make sure dev server is running: `npm run dev`
2. Open browser: `http://localhost:3000`
3. Have multiple browser windows/incognito windows ready for testing handshakes

**Test accounts needed:**
- Partnership A: `raunek@tester.com` + password
- Partnership B: Create new account or use `raunek+test2@haevn.com`
- Partnership C: Create new account or use `raunek+test3@haevn.com`

---

## 📋 PHASE 1: Handshake/Matching System Testing

### Test 1.1: View Matches
**Location:** Dashboard → Matches Card (or `/matches`)

**Steps:**
1. Log in as Partnership A
2. Click on "Matches" card from dashboard OR navigate to `/matches`
3. You should see a grid of compatible partnerships

**What to test:**
- ✅ Match cards display partnership names
- ✅ Compatibility score shows (Platinum/Gold/Silver/Bronze)
- ✅ City/location visible
- ✅ "Send Handshake" button present
- ✅ Filter dropdown works (Bronze & up, Silver & up, etc.)
- ✅ Mobile: Grid stacks to 1 column on small screens

**Expected Result:** You see at least 1-3 matches (if database has partnerships)

---

### Test 1.2: Send Handshake Request
**Location:** `/matches`

**Steps:**
1. On matches page, click "Send Handshake" on any match
2. Modal should open with match preview
3. Optionally add a personal message
4. Click "Send Handshake"

**What to test:**
- ✅ Modal opens with correct partnership info
- ✅ Message field is optional
- ✅ "Send" button works
- ✅ Success toast appears
- ✅ Button changes to "Pending" after sending
- ✅ Can't send duplicate handshake to same partnership

**Expected Result:**
- Toast: "Handshake sent!"
- Button shows "Pending" with disabled state

---

### Test 1.3: Receive Handshake Request (Switch Accounts)
**Location:** `/connections`

**Steps:**
1. **Log out** from Partnership A
2. **Log in** as Partnership B (the one you sent handshake to)
3. Navigate to `/connections` page
4. You should see incoming handshake request

**What to test:**
- ✅ Incoming request shows sender's name
- ✅ "Accept" and "Decline" buttons visible
- ✅ Can view sender's partial profile info
- ✅ Optional message shows if Partnership A included one

**Expected Result:**
- Card shows "Handshake Request from [Partnership A]"
- Accept/Decline buttons present

---

### Test 1.4: Accept Handshake
**Location:** `/connections`

**Steps:**
1. Still logged in as Partnership B
2. Click "Accept" on the incoming request
3. Confirm in modal if prompted

**What to test:**
- ✅ Success toast appears
- ✅ Request moves to "Connected" section
- ✅ Full profile details now visible (photos, bio, survey answers)
- ✅ Dashboard "Connections" count updates (+1)

**Expected Result:**
- Toast: "Connection established!"
- Can now see full partnership profile

---

### Test 1.5: View Connection (Both Sides)
**Location:** `/connections`

**Steps:**
1. As Partnership B, verify connection shows in `/connections`
2. Log out, log in as Partnership A
3. Navigate to `/connections`
4. Verify connection shows on Partnership A's side too

**What to test:**
- ✅ Both partnerships see each other in connections
- ✅ Full profiles visible (no anonymization)
- ✅ Photos accessible
- ✅ Survey answers visible
- ✅ Dashboard counts updated on both sides

**Expected Result:**
- Mutual connection visible to both partnerships
- All profile data unlocked

---

### Test 1.6: Decline Handshake (Optional)
**Location:** `/connections`

**Steps:**
1. Send another handshake from Partnership A → Partnership C
2. Log in as Partnership C
3. Click "Decline" on the request

**What to test:**
- ✅ Request disappears
- ✅ No connection established
- ✅ Partnership A sees no change (request still pending or removed)

**Expected Result:**
- Clean decline without errors

---

## 📋 PHASE 2: Survey Enhancements Testing

### Test 2.1: Start Survey
**Location:** `/onboarding/survey` OR Dashboard → Survey Results → Continue Survey

**Steps:**
1. Create a **new account** (or reset survey data in database)
2. Navigate to `/onboarding/survey`
3. Survey should start at Question 1

**What to test:**
- ✅ Progress bar at top (starts at 0%)
- ✅ Section title shows (e.g., "Basic Information")
- ✅ Question counter: "Question X of Y in [Section]"
- ✅ Overall counter at bottom: "Question 1 of [Total]"
- ✅ "Back" button disabled on first question
- ✅ "Save & Exit" button works

**Expected Result:**
- Clean survey interface with clear progress indicators

---

### Test 2.2: Answer Questions in First Section
**Location:** `/onboarding/survey`

**Steps:**
1. Answer all questions in "Basic Information" section
2. Watch the progress bar increase
3. Pay attention when you complete the LAST question of the section

**What to test:**
- ✅ Progress bar updates in real-time
- ✅ "Question X of Y" updates per section
- ✅ "Continue" button only enabled when question answered
- ✅ Auto-save indicator shows "Saving..." then "Saved"
- ✅ "Back" button works to go to previous question

**Expected Result:**
- Smooth answering experience with live progress

---

### Test 2.3: Section Celebration Modal 🎉
**Location:** `/onboarding/survey` (after completing a section)

**Steps:**
1. Answer the **last question** of the first section
2. Click "Continue"
3. **Celebration modal should appear!**

**What to test:**
- ✅ Modal appears with confetti animation
- ✅ Shows "Section Complete!" title
- ✅ Shows section name (e.g., "Basic Information")
- ✅ Shows celebration message (e.g., "Great start! 🎉")
- ✅ Shows progress dots: "1 of 8 complete"
- ✅ "Continue" button closes modal
- ✅ Auto-closes after 3 seconds
- ✅ Next section starts after modal closes

**Expected Result:**
- 🎊 Confetti animation for ~3 seconds
- Encouraging message
- Smooth transition to next section

---

### Test 2.4: Section Progress Tracking
**Location:** `/onboarding/survey`

**Steps:**
1. Continue through multiple sections
2. Watch for celebration after each section completion
3. Note different celebration messages

**What to test:**
- ✅ Each section gets its own celebration
- ✅ Messages vary by section:
  - Section 1: "Great start! 🎉"
  - Section 2: "You're doing amazing! 💫"
  - Section 3: "Keep going, you're a third of the way there! 💪"
  - Section 4: "Halfway there! You're crushing it! ⭐"
  - etc.
- ✅ Progress dots fill in (1 of 8 → 2 of 8 → 3 of 8...)
- ✅ No duplicate celebrations for same section

**Expected Result:**
- Unique celebration per section completion
- Progress tracking accurate

---

### Test 2.5: Save & Resume
**Location:** `/onboarding/survey`

**Steps:**
1. Start survey, answer a few questions
2. Click "Save & Exit"
3. Log out and log back in
4. Navigate back to `/onboarding/survey`

**What to test:**
- ✅ Survey resumes at last answered question
- ✅ Previous answers preserved
- ✅ Progress bar shows correct percentage
- ✅ Section celebrations don't re-trigger
- ✅ Completed sections stay completed

**Expected Result:**
- Seamless resume experience
- No data loss

---

### Test 2.6: Survey Completion
**Location:** `/onboarding/survey`

**Steps:**
1. Complete ALL sections (all 8)
2. Answer the very last question
3. Click "Continue" or "Complete Survey"

**What to test:**
- ✅ Final section celebration appears
- ✅ Progress bar reaches 100%
- ✅ Redirects to `/onboarding/celebration` or next step
- ✅ Toast: "Survey Complete!"
- ✅ Database marks survey as complete

**Expected Result:**
- 🎊 Final celebration
- Redirect to next onboarding step

---

## 📋 PHASE 3: Nudges/Activity Feed Testing

### Test 3.1: View Nudges Page
**Location:** Dashboard → Nudges Card OR `/nudges`

**Steps:**
1. Log in to any account
2. Click "Nudges" card on dashboard
3. Should navigate to `/nudges` page

**What to test:**
- ✅ Page loads without errors
- ✅ Shows "Nudges" title
- ✅ Shows subtitle: "Stay updated with your activity"
- ✅ Back button returns to dashboard
- ✅ Empty state if no notifications: "No notifications yet"

**Expected Result:**
- Clean activity feed page

---

### Test 3.2: Generate Nudges (Handshake Request)
**Location:** Multiple pages

**Steps:**
1. Log in as Partnership A
2. Send a handshake to Partnership B
3. Log out, log in as Partnership B
4. Navigate to `/nudges`

**What to test:**
- ✅ "New Handshake Request" notification appears
- ✅ Shows sender's name: "[Partnership A] wants to connect!"
- ✅ Grouped under "Today"
- ✅ Unread indicator (red dot) visible
- ✅ Click notification → navigates to `/connections`

**Expected Result:**
- Incoming handshake shows in nudges feed

---

### Test 3.3: Generate Nudges (Handshake Accepted)
**Location:** Multiple pages

**Steps:**
1. As Partnership B, accept the handshake
2. Navigate to `/nudges` (or refresh)
3. Should see "New Connection!" notification

**What to test:**
- ✅ "New Connection!" notification appears
- ✅ Shows: "You're now connected with [Partnership A]"
- ✅ Grouped under "Today"
- ✅ Unread indicator present
- ✅ Click notification → navigates to `/connections`

**Expected Result:**
- Accepted handshake shows in feed

---

### Test 3.4: Generate Nudges (Survey Section Complete)
**Location:** Survey + Nudges

**Steps:**
1. Complete a section of the survey
2. Navigate to `/nudges`

**What to test:**
- ✅ "Survey Progress!" notification appears
- ✅ Shows: "You completed the [section name] section"
- ✅ Grouped by date
- ✅ Click notification → navigates to `/onboarding/survey`

**Expected Result:**
- Survey milestones tracked in nudges

---

### Test 3.5: Date Grouping
**Location:** `/nudges`

**Steps:**
1. If possible, create notifications from different days (modify database timestamps)
2. OR just verify current grouping

**What to test:**
- ✅ Notifications grouped by:
  - Today
  - Yesterday
  - This Week
  - Older
- ✅ Each group has header label
- ✅ Sorted newest first within each group

**Expected Result:**
- Clean date-based organization

---

### Test 3.6: Dashboard Nudges Count
**Location:** Dashboard

**Steps:**
1. Have some unread notifications
2. Navigate to `/dashboard`
3. Check "Nudges" card

**What to test:**
- ✅ Count shows number of unread nudges
- ✅ Clicking card navigates to `/nudges`
- ✅ Count updates when new notification arrives
- ✅ Mobile: Card stacks properly

**Expected Result:**
- Live unread count on dashboard

---

## 📱 PHASE 4: Mobile Responsiveness Testing

### Test 4.1: Mobile Dashboard
**Location:** `/dashboard`

**How to test:**
1. Open Chrome DevTools (F12 or Cmd+Option+I)
2. Click "Toggle Device Toolbar" (Cmd+Shift+M)
3. Select device: iPhone SE (375px), iPhone 12 Pro (390px), iPad (768px)
4. OR resize browser to < 640px width

**What to test:**
- ✅ Logo scales down on mobile (h-14 instead of h-20)
- ✅ "Profile & Settings" → "Profile" on small screens
- ✅ Header stacks vertically on mobile
- ✅ Stats cards stack 1-column on mobile
- ✅ Matches grid stacks 1-column on mobile
- ✅ Compatibility breakdown: 2 columns on mobile (4 on desktop)
- ✅ Touch targets ≥ 44px (test tap buttons)
- ✅ No horizontal overflow/scroll

**Expected Result:**
- Dashboard fully usable on 320px+ screens

---

### Test 4.2: Mobile Survey
**Location:** `/onboarding/survey`

**Steps:**
1. Enable device toolbar (mobile view)
2. Navigate to survey
3. Answer questions on mobile

**What to test:**
- ✅ Progress bar fits viewport
- ✅ "Back" and "Save & Exit" buttons accessible
- ✅ Button text readable (xs on mobile, sm on desktop)
- ✅ Main card padding reduced (p-6 on mobile vs p-12 on desktop)
- ✅ "Continue" button full-width and tappable
- ✅ Question text readable without zoom
- ✅ Input fields accessible
- ✅ Celebration modal fits screen
- ✅ Confetti doesn't break layout

**Expected Result:**
- Smooth survey experience on mobile

---

### Test 4.3: Mobile Matches Page
**Location:** `/matches`

**Steps:**
1. Mobile view enabled
2. Navigate to matches

**What to test:**
- ✅ Filter dropdown full-width on mobile
- ✅ Match cards stack 1-column
- ✅ "Send Handshake" button tappable
- ✅ Modal fits viewport
- ✅ Back button accessible

**Expected Result:**
- Matches browsable on mobile

---

### Test 4.4: Mobile Connections
**Location:** `/connections`

**Steps:**
1. Mobile view
2. Navigate to connections

**What to test:**
- ✅ Connection cards stack properly
- ✅ Accept/Decline buttons accessible
- ✅ Text readable
- ✅ No overflow

**Expected Result:**
- Connections manageable on mobile

---

### Test 4.5: Mobile Photo Grid
**Location:** `/partner-profile` OR `/add-photos`

**Steps:**
1. Mobile view
2. Navigate to profile or add photos

**What to test:**
- ✅ Photo grid: 2 columns on mobile (3 on desktop)
- ✅ Upload buttons tappable
- ✅ Delete buttons accessible
- ✅ Images scale properly
- ✅ Aspect ratio maintained

**Expected Result:**
- Photos manageable on small screens

---

### Test 4.6: Real Device Testing (Optional but Recommended)

**If you have access to:**
- iPhone (iOS Safari)
- Android phone (Chrome)

**Test on real device:**
1. Find your local IP: `ipconfig getifaddr en0` (Mac) or `ipconfig` (Windows)
2. Access from phone: `http://[YOUR_IP]:3000`
3. Test touch interactions, keyboard, photo upload

**What to test:**
- ✅ Touch targets work well
- ✅ Keyboard doesn't break layout
- ✅ Photo upload from camera works
- ✅ Modals scroll properly
- ✅ No viewport zoom issues

---

## 🐛 Common Issues & Troubleshooting

### Issue: "No matches showing"
**Cause:** Database might not have enough partnerships
**Fix:** Create 2-3 test partnerships with completed surveys

### Issue: "Can't send handshake"
**Cause:** Might be trying to send to yourself
**Fix:** Ensure you're logged in as different partnership

### Issue: "Survey won't resume"
**Cause:** Database might not be saving properly
**Fix:** Check Supabase connection, check console for errors

### Issue: "Celebration modal doesn't appear"
**Cause:** Section might already be marked as completed
**Fix:** Start fresh survey or check `completed_sections` in database

### Issue: "Nudges not showing"
**Cause:** No activity in last 7 days
**Fix:** Create fresh handshake requests or survey completions

### Issue: "Mobile view broken"
**Cause:** Browser cache or viewport meta tag
**Fix:** Hard refresh (Cmd+Shift+R), check `<meta name="viewport">` in layout

---

## ✅ Testing Checklist

Use this for comprehensive testing:

### Handshake System
- [ ] View matches
- [ ] Send handshake request
- [ ] Receive handshake request (different account)
- [ ] Accept handshake
- [ ] View connection from both sides
- [ ] Decline handshake (optional)

### Survey Enhancements
- [ ] Start survey from beginning
- [ ] Answer questions and see progress
- [ ] Complete first section → see celebration
- [ ] Complete multiple sections → different messages
- [ ] Save & Exit → Resume works
- [ ] Complete entire survey

### Nudges
- [ ] View empty nudges page
- [ ] Generate handshake request nudge
- [ ] Generate handshake accepted nudge
- [ ] Generate survey section nudge
- [ ] Verify date grouping
- [ ] Check dashboard count

### Mobile Responsiveness
- [ ] Dashboard on 375px
- [ ] Survey on 375px
- [ ] Matches on 375px
- [ ] Connections on 375px
- [ ] Photos on 375px
- [ ] All buttons tappable (≥44px)
- [ ] No horizontal overflow
- [ ] Text readable without zoom

---

## 📊 Expected Results Summary

After testing everything, you should have:
- ✅ 2-3 partnerships with mutual connections
- ✅ Survey completion with celebration animations working
- ✅ Nudges feed populated with activity
- ✅ All pages responsive on mobile
- ✅ No console errors
- ✅ Smooth user experience across features

---

## 🎯 Next Steps After Testing

1. **Document bugs** - Create GitHub issues for any problems found
2. **Test with real users** - Get feedback from friends/colleagues
3. **Performance testing** - Check page load times
4. **Cross-browser testing** - Test on Safari, Firefox, Edge
5. **Accessibility testing** - Test with screen readers, keyboard navigation

---

## 📝 Feedback Template

When testing, use this to track issues:

```markdown
## Bug Report

**Feature:** [Handshake System / Survey / Nudges / Mobile]
**Page:** [URL]
**Device:** [Desktop / Mobile - specify]
**Browser:** [Chrome / Safari / Firefox]

**What I did:**
1.
2.
3.

**What happened:**
[Describe the issue]

**What should happen:**
[Expected behavior]

**Screenshots:**
[If applicable]
```

---

**Happy Testing! 🚀**

*If you encounter any issues or need help, check the console (F12 → Console) for error messages.*
