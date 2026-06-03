/**
 * AI conversation starters ("icebreakers") for a matched pair.
 *
 * Mirrors the OpenAI usage in generateSummaries.ts (gpt-4o-mini, raw fetch).
 * Always resolves — falls back to generic starters when the API key is
 * missing or the call fails, so the chat empty state never blocks.
 */

const OPENAI_MODEL = 'gpt-4o-mini'
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'

export const FALLBACK_ICEBREAKERS: string[] = [
  "What's something you're looking forward to this week?",
  'I noticed we align on a few things — what matters most to you in a connection?',
  'If we were grabbing coffee right now, what would you order?',
]

export interface IcebreakerContext {
  /** The match's first name, if known. */
  matchName?: string
  /** Free-text context (e.g. the match's connection summary). */
  about?: string
  /** Top shared strengths/factors. */
  topFactors?: string[]
}

function clampThree(lines: string[]): string[] {
  const cleaned = lines
    .map((l) => l.replace(/^\s*[-*\d.)]+\s*/, '').replace(/^["']|["']$/g, '').trim())
    .filter(Boolean)
  return (cleaned.length >= 3 ? cleaned : [...cleaned, ...FALLBACK_ICEBREAKERS]).slice(0, 3)
}

export async function generateIcebreakers(
  ctx: IcebreakerContext = {}
): Promise<string[]> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return FALLBACK_ICEBREAKERS

  const name = ctx.matchName?.trim() || 'your match'
  const factors = ctx.topFactors?.filter(Boolean).join(', ')
  const about = ctx.about?.trim()

  const system =
    'You write warm, specific conversation starters for two people who just ' +
    'matched on a relationship compatibility platform. Each starter is one ' +
    'sentence, easy to respond to, and never generic or cheesy. Return ONLY a ' +
    'JSON array of exactly 3 strings — no numbering, no extra keys, no prose.'

  const user =
    `Write 3 opening lines to send to ${name}.` +
    (factors ? ` Shared strengths: ${factors}.` : '') +
    (about ? ` About them: ${about}` : '')

  try {
    const res = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        max_tokens: 300,
        temperature: 0.6,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    })
    if (!res.ok) return FALLBACK_ICEBREAKERS
    const data = await res.json()
    const content: string = data?.choices?.[0]?.message?.content ?? ''
    if (!content) return FALLBACK_ICEBREAKERS

    // Try strict JSON first, then a loose line-split.
    try {
      const parsed = JSON.parse(content)
      if (Array.isArray(parsed)) return clampThree(parsed.map(String))
    } catch {
      /* fall through to line parsing */
    }
    const match = content.match(/\[[\s\S]*\]/)
    if (match) {
      try {
        const parsed = JSON.parse(match[0])
        if (Array.isArray(parsed)) return clampThree(parsed.map(String))
      } catch {
        /* ignore */
      }
    }
    return clampThree(content.split('\n'))
  } catch {
    return FALLBACK_ICEBREAKERS
  }
}
