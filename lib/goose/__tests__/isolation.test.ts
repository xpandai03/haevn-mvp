/**
 * Structural isolation: the Goose pipeline cannot reach Match Monday tables,
 * notifications, or AI, and stamps the same engine version as the weekly path.
 * (The live before/after computed_matches row count is in the QA harness.)
 * Run: npx tsx lib/goose/__tests__/isolation.test.ts
 */
import { readdirSync, readFileSync } from 'fs'
import { join } from 'path'
import { eq, ok, report } from '@/lib/metrics/__tests__/_assert'
import { GOOSE_ENGINE_VERSION } from '../score'

const ROOT = join(__dirname, '..', '..', '..')
const GOOSE = join(ROOT, 'lib', 'goose')
const sources = ['', 'http']
  .flatMap((dir) => readdirSync(join(GOOSE, dir)).filter((f) => f.endsWith('.ts')).map((f) => join(dir, f)))
  .map((f) => [f, readFileSync(join(GOOSE, f), 'utf8')] as const)
ok(sources.length >= 8, `found ${sources.length} goose source files`)

const FORBIDDEN = [
  /from\(\s*['"]computed_matches['"]/,
  /from\(\s*['"]match_history['"]/,
  /from\(\s*['"]match_compute_runs['"]/,
  /from\(\s*['"]match_interpretations['"]/,
  /from\(\s*['"]renotify_log['"]/,
  /from\(\s*['"]handshakes['"]/,
  /computeMatchesForPartnership|recomputeAllMatches/,
  /lib\/services\/computeMatches/,
  /lib\/notify|lib\/renotify|sendNotification|twilio/i,
  /lib\/ai\/|openai|anthropic/i,
  /constraints\.reason/,
]
for (const [file, src] of sources) {
  const code = src.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '') // comments may name what we avoid
  for (const re of FORBIDDEN) ok(!re.test(code), `${file}: no ${re}`)
}
ok(!sources.some(([, s]) => /^\s*['"]use server['"]/m.test(s)), "no 'use server' module (non-async exports would break the build)")

const weekly = readFileSync(join(ROOT, 'lib', 'services', 'computeMatches.ts'), 'utf8')
const m = weekly.match(/const ENGINE_VERSION = '([^']+)'/)
eq(GOOSE_ENGINE_VERSION, m?.[1], 'cohort rows stamp the same engine version as the weekly recompute')

report('goose isolation')
