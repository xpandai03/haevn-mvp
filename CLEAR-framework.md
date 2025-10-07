# CLEAR Framework - Account Details & Avatar Upload

## C - Contextualize

### What are we building?
1. **Account Details Page** - A dedicated page where users can view and edit their account information (email, password, username, etc.)
2. **Avatar Upload via Click** - Users should be able to click on their profile picture circle to upload/change their avatar

### Why is this important?
- Account details is core functionality for any user account system
- Profile picture upload is a primary way users personalize their profile
- Currently, these features are missing or not easily accessible

### Current State
- Account details button exists but is disabled
- Avatar is shown but not clickable
- Photo upload functionality exists but requires going through a separate flow

## L - List Requirements

### Account Details Page Requirements
1. Display current account information:
   - Email address
   - Username
   - Account creation date
   - Partnership status
2. Allow editing:
   - Username
   - Password (change password flow)
   - Email (with verification)
3. Danger zone:
   - Delete account option
4. Navigation:
   - Back button to profile
   - HAEVN branding consistent

### Avatar Upload Requirements
1. Click on avatar circle to trigger upload
2. File picker for image selection
3. Image preview before confirming
4. Upload to Supabase storage
5. Update user profile with new avatar URL
6. Show loading state during upload
7. Error handling for failed uploads
8. Support common image formats (jpg, png, webp)
9. Limit file size (max 5MB)

## E - Establish Plan

### Phase 1: Account Details Page
**Time estimate: 15 minutes**

1. Create `/app/account-details/page.tsx`
2. Create `AccountDetailsForm` component with sections:
   - Profile Information (username, email - read-only for now)
   - Change Password (modal or separate section)
   - Account Status (creation date, partnership info)
3. Enable "Account details" button in PartnerProfile
4. Add proper navigation and back button

### Phase 2: Avatar Upload Click Handler
**Time estimate: 20 minutes**

1. Add click handler to Avatar component in PartnerProfile
2. Create file input trigger on click
3. Add image preview modal/state
4. Integrate with existing `uploadPhoto` action
5. Update avatar display after successful upload
6. Add loading spinner overlay on avatar during upload
7. Error toast notifications

### Phase 3: Testing & Polish
**Time estimate: 5 minutes**

1. Test account details page navigation
2. Test avatar click → upload → display flow
3. Test error scenarios (large file, wrong format)
4. Verify HAEVN brand styling

## A - Act & Validate

### Implementation Order

1. ✅ Create account details page structure
2. ✅ Enable navigation to account details
3. ✅ Add avatar click handler
4. ✅ Integrate photo upload on click
5. ✅ Add loading states
6. ✅ Test and validate

### Success Criteria

- [ ] Account details page loads and displays user info
- [ ] User can navigate to account details from profile
- [ ] User can click avatar to upload new photo
- [ ] Photo uploads successfully to Supabase
- [ ] Avatar updates immediately after upload
- [ ] Error messages shown for failed uploads
- [ ] All flows match HAEVN brand design

## R - Review & Commit

### Commit Strategy
- Commit 1: Account details page and navigation
- Commit 2: Avatar click upload functionality
- Final commit: Polish and error handling

### Documentation Updates
- Update README with new features
- Add to user testing guide

---

## Ready to Execute! 🚀

Estimated total time: **40 minutes**

Let's build these features!
