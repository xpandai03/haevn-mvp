/**
 * Admin ZIP single-add helpers. Run: npx tsx lib/admin/__tests__/zips.test.ts
 */
import { isValidZip, buildZipRow, classifyZipInsert } from '../zips'
import { eq, ok, report } from '../../metrics/__tests__/_assert'

// ── isValidZip ──
ok(isValidZip('78701'), '5 digits → valid')
ok(!isValidZip('7870'), '4 digits → invalid')
ok(!isValidZip('abcde'), 'letters → invalid')
ok(!isValidZip('787011'), '6 digits → invalid')

// ── buildZipRow: MSA/city/county default + trim ──
eq(buildZipRow({ zip_code: ' 78701 ', msa_name: ' Tampa ', city: ' Tampa ' }),
  { zip_code: '78701', msa_name: 'Tampa', city: 'Tampa', county: '' }, 'trims + keeps MSA/city')
eq(buildZipRow({ zip_code: '78701' }),
  { zip_code: '78701', msa_name: 'Manual', city: '', county: '' }, 'no MSA → defaults to Manual')
eq(buildZipRow({ zip_code: '78701', msa_name: '   ' }).msa_name, 'Manual', 'blank MSA → Manual')

// ── classifyZipInsert: duplicate is a CLEAR 409, not a 500; not silent ──
eq(classifyZipInsert(null, '78701'), { ok: true }, 'no error → ok')
{
  const r = classifyZipInsert({ code: '23505', message: 'duplicate key value violates unique constraint' }, '78701')
  eq(r, { ok: false, status: 409, message: 'ZIP 78701 is already in the allowed list.' }, 'unique violation → 409 with clear message (not 500, not silent)')
}
{
  const r = classifyZipInsert({ code: '23502', message: 'null value in column' }, '78701') as any
  eq(r.status, 500, 'other DB error → 500')
  ok(!r.ok, 'other error → not ok')
}

report('zips')
