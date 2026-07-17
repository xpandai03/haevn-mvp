/**
 * Honest metric definitions surfaced in the info tooltips. Blocked metrics say
 * exactly what unblocks them — never a vague "coming soon."
 */
export const TOOLTIPS: Record<string, string> = {
  // Snapshot
  totalMembers: 'Members are counted as partnerships (a couple counts once), not individual people.',
  incompleteSurveys: 'People who have started but not yet completed the onboarding survey.',
  completedSurveys: 'People who have completed the onboarding survey.',
  membersFree: 'Partnerships currently on the free tier.',
  plusMembers: 'Available after the payment-tier (Lemonsqueezy) fix — the deployed webhook writes an invalid tier, so upgrades do not persist yet.',
  plusConversion: 'Available after the payment-tier fix — it depends on Plus Members, which is currently unavailable.',
  noCurrentMatch:
    'Currently means "no current match" — a partnership with no match right now. True lifetime "never matched" needs match-history retention, which is pending.',
  meetupShares: 'Available after meetup-share instrumentation is added — no meetup-share event is captured today.',

  // Weekly
  matchesGenerated: 'Compatibility matches (score ≥ 80) generated during this reporting week.',
  recommendationsGenerated: 'Near-miss recommendations (score 77–79) generated during this reporting week.',
  nudgesSent: 'Nudges sent during this reporting week.',
  readyToMeetSignals: '"Ready to meet" signals recorded during this reporting week.',
  newConnections: 'Mutual connections (handshakes) formed during this reporting week.',
  conversationsStarted: 'Conversations started during this reporting week.',
}
