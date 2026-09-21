/**
 * Server-side phone normalization.
 * Run: npx tsx lib/utils/__tests__/phone.test.ts
 */
import { normalizePhone, phoneForStorage, isE164 } from '../phone'
import { ok, eq, report } from '../../metrics/__tests__/_assert'

// ── the shapes members actually type ──
eq(normalizePhone('5125550123').value, '+15125550123', 'bare 10-digit US -> +1')
eq(normalizePhone('(512) 555-0123').value, '+15125550123', 'formatted US')
eq(normalizePhone('512.555.0123').value, '+15125550123', 'dot-separated')
eq(normalizePhone('15125550123').value, '+15125550123', '11 digits starting 1')
eq(normalizePhone('+1 512 555 0123').value, '+15125550123', 'already +1 with spaces')
eq(normalizePhone('+442071838750').value, '+442071838750', 'international E.164 preserved')
eq(normalizePhone('00442071838750').value, '+442071838750', '00 international prefix -> +')
eq(normalizePhone('  +15125550123  ').value, '+15125550123', 'whitespace trimmed')

// ── rejected, with a reason ──
eq(normalizePhone('').reason, 'empty', 'empty -> empty')
eq(normalizePhone(null).reason, 'empty', 'null -> empty')
eq(normalizePhone('not a phone').reason, 'no_digits', 'pure text -> no_digits')
eq(normalizePhone('12345').reason, 'too_short', 'too short')
eq(normalizePhone('+1234567890123456789').reason, 'too_long', 'beyond E.164 max')
eq(normalizePhone('+0123456789').reason, 'invalid_country', 'country code cannot start with 0')
for (const junk of ['abc', '---', 'call me', 'N/A'])
  eq(phoneForStorage(junk), null, `junk "${junk}" stores as null`)

// ── THE CORRECTION THIS MODULE EXISTS TO PREVENT ──
// The 2026-09-20 snapshot reported two phones as "pure-alphabetic junk with no
// digits". They were plain 10- and 11-digit numbers missing their country code:
// the shape function that produced that finding replaced digits with 'D', then
// replaced [A-Za-z] with 'A' — so 'D' became 'A' and digits read as letters.
// Acting on that report would have NULLED two working phone numbers.
eq(normalizePhone('5125550123').value, '+15125550123', 'the "junk" was recoverable, not junk')
eq(normalizePhone('15125550123').value, '+15125550123', '...and so was the 11-digit one')
ok(normalizePhone('5125550123').value !== null, 'a recoverable number is NEVER nulled')

// ── never blocks a submission ──
ok(phoneForStorage('garbage') === null, 'an unusable phone returns null, not a throw')
for (const v of [undefined, null, '', ' ', 'x'])
  ok(phoneForStorage(v as any) === null || isE164(phoneForStorage(v as any)!),
    'every input yields null or valid E.164 — never a partial string, never a throw')

// ── isE164 ──
ok(isE164('+15125550123'), 'valid E.164')
ok(!isE164('5125550123'), 'missing + is not E.164')
ok(!isE164('+0125550123'), 'leading 0 country code is not E.164')
ok(!isE164(null), 'null is not E.164')

for (const input of ['5125550123', '+442071838750', 'junk', '', '00442071838750']) {
  const v = phoneForStorage(input)
  ok(v === null || isE164(v), `"${input}" -> null or valid E.164 (got ${v})`)
}

report('utils/phone')
