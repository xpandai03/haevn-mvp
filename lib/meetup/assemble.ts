/**
 * Pure assembly of one meetup feed record from already-normalized member data.
 *
 * Kept separate from the DB layer so the privacy contract is unit-testable: the
 * output of assembleMeetupRecord is exactly what serializes to the client, so
 * the acceptance test builds records from fixtures (that deliberately carry real
 * names / ids / raw answers as INPUTS) and asserts none of that leaks OUT.
 */

import { qualifyCategories, type MemberRubricSignals } from './rubric'
import type { MeetupMember, MeetupRecord } from './types'

/** Everything the assembler needs for one member (already normalized). */
export interface AssembledMemberInput {
  role: 'a' | 'b'
  city_id: string | null
  city_label: string | null
  centroid: [number, number] | null
  max_distance_miles: number | null
  mobility: string
  geo_unresolved: boolean
  // rubric inputs (consumed, NOT emitted):
  rubric: MemberRubricSignals
}

export interface AssembleInput {
  pair_id: string
  type: 'match' | 'recommendation'
  memberA: AssembledMemberInput
  memberB: AssembledMemberInput
}

function toMember(m: AssembledMemberInput): MeetupMember {
  // Explicit field-by-field projection — never spread the input, so rubric
  // inputs (and anything else) can't accidentally ride along into the payload.
  return {
    role: m.role,
    city_id: m.city_id,
    city_label: m.city_label,
    centroid: m.centroid,
    max_distance_miles: m.max_distance_miles,
    mobility: m.mobility,
    geo_unresolved: m.geo_unresolved,
  }
}

export function assembleMeetupRecord(input: AssembleInput): MeetupRecord {
  return {
    pair_id: input.pair_id,
    type: input.type,
    active: true,
    members: [toMember(input.memberA), toMember(input.memberB)],
    qualified_meetup_categories: qualifyCategories(input.memberA.rubric, input.memberB.rubric),
  }
}
