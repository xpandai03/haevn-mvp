/**
 * Tiny standalone assert harness for the metrics tests. No test-framework
 * dependency (matches the repo convention of `npx tsx`-runnable *.test.ts).
 * Each test file calls report() at the end; a non-zero exit fails CI.
 */
let passed = 0
let failed = 0
const failures: string[] = []

export function eq(actual: unknown, expected: unknown, msg: string): void {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  if (a === e) {
    passed++
  } else {
    failed++
    failures.push(`✗ ${msg}\n    expected ${e}\n    got      ${a}`)
  }
}

export function ok(cond: boolean, msg: string): void {
  if (cond) passed++
  else {
    failed++
    failures.push(`✗ ${msg}`)
  }
}

export function report(suite: string): void {
  if (failed === 0) {
    console.log(`✓ ${suite}: ${passed} passed`)
  } else {
    console.error(`✗ ${suite}: ${failed} failed, ${passed} passed`)
    for (const f of failures) console.error('  ' + f)
    process.exit(1)
  }
}
