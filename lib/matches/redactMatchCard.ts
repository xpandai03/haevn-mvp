/**
 * Server-side identity redaction for match / recommendation cards.
 *
 * The reveal gate is a SERVER concern: a free viewer's payload must never carry
 * the matched member's identity, because "don't render it" in the browser still
 * ships it over the wire. Masking used to be client-only (ProfileCard `isLocked`),
 * so the real name + photo URL sat in the free viewer's response and could be
 * read straight off the network tab. This module is the single transform that
 * closes that leak; `getComputedMatchCards` (which also backs recommendations)
 * runs every card through it.
 *
 * Contract:
 *  - FREE viewer  -> strip every identity/contact vector (full name, photo URL,
 *    free-text bio + connection summary), keeping only the first-initial token
 *    ("D***") and the non-identifying demographics the card is designed to show
 *    (gender · orientation · structure · banded distance · age · city).
 *  - PAID viewer  -> returned UNCHANGED (referentially identical object), so an
 *    entitled viewer's payload is byte-identical to before this fix.
 *
 * Pure + framework-free so it is unit-testable at the payload level.
 */

/** Reduce a display name to its public first-initial token ("David" -> "D***"). */
export function redactInitial(name: string | null | undefined): string {
  const first = (name ?? '').trim().charAt(0)
  return first ? `${first.toUpperCase()}***` : '—'
}

/** The identity/contact fields a free viewer must never receive. */
export interface RedactableMatchPartnership {
  display_name: string | null
  first_name: string
  photo_url?: string
  short_bio: string | null
  connection_summary?: string | null
  // …plus any non-identifying fields (id, city, age, gender, …) carried through.
  [key: string]: unknown
}

/**
 * Redact one card's partnership block for the given viewer. Paid viewers get the
 * exact same object back; free viewers get the identity vectors removed.
 */
export function redactMatchPartnership<T extends RedactableMatchPartnership>(
  partnership: T,
  viewerIsFree: boolean
): T {
  if (!viewerIsFree) return partnership
  return {
    ...partnership,
    display_name: null,
    first_name: redactInitial(partnership.first_name),
    photo_url: undefined,
    short_bio: null,
    connection_summary: null,
  }
}

/**
 * Assertion helper for tests / defensive checks: true when an object carries no
 * residual identity for a free viewer. Used by the API-level redaction tests.
 */
export function hasNoIdentityLeak(partnership: RedactableMatchPartnership): boolean {
  const initialOk =
    partnership.display_name === null &&
    // first_name may only be the public token ("D***"), never a real name.
    /^[A-Z]\*\*\*$|^—$/.test(partnership.first_name)
  const photoOk =
    partnership.photo_url === undefined || partnership.photo_url === null
  const freeTextOk =
    (partnership.short_bio === null || partnership.short_bio === undefined) &&
    (partnership.connection_summary === null ||
      partnership.connection_summary === undefined)
  return initialOk && photoOk && freeTextOk
}
