import { redirect } from 'next/navigation'

/**
 * Retired. Every market is released, so there is no waitlist. The route stays
 * so stale links (old emails, bookmarks) land somewhere real instead of on a
 * 404. /dashboard sends a signed-out visitor to sign in and a mid-onboarding
 * member back to their next step, via middleware.
 */
export default function WaitlistPage() {
  redirect('/dashboard')
}
