/**
 * Honest metric definitions surfaced in the info tooltips. Every card reads a
 * real, populated source — nothing on the dashboard can say "Unavailable".
 */
export const TOOLTIPS: Record<string, string> = {
  // Snapshot
  totalMembers: 'Members are counted as partnerships (a couple counts once), not individual people.',
  incompleteSurveys: 'People who have started but not yet completed the onboarding survey.',
  completedSurveys: 'People who have completed the onboarding survey.',
  membersFree: 'Partnerships currently on the free tier.',
  activeFoundingMembers:
    'Founding Member promo activations whose membership has not expired. Comped accounts are excluded, as on the Founding Members page.',
  foundingExpiringSoon: 'Active founding memberships that expire within the next 30 days.',
  departures: 'Members who deleted their account, all time. Only the city and date are kept.',
  noCurrentMatch:
    'Currently means "no current match" — a partnership with no match right now. True lifetime "never matched" needs match-history retention, which is pending.',

  // Weekly
  matchesGenerated:
    'Compatibility matches (score ≥ 80) generated during this reporting week. Each pair counts once for each side, so 30 means 15 pairs. Click for the list.',
  recommendationsGenerated:
    'Near-miss recommendations (score 77–79) generated during this reporting week. Each pair counts once for each side. Click for the list.',
  nudgesSent: 'Nudges sent during this reporting week.',
  readyToMeetSignals: '"Ready to meet" signals recorded during this reporting week.',
  newConnections: 'Mutual connections (handshakes) formed during this reporting week.',
  conversationsStarted: 'Conversations started during this reporting week.',
}
