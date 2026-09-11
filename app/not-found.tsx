import Link from 'next/link'

/**
 * The 404 boundary.
 *
 * The app had no not-found route, so every unmatched URL fell through to
 * Next's built-in 404 — which renders outside the app's own tree. A real
 * boundary is correct regardless of the reload investigation: it gives the
 * router a route it can actually render for an unmatched URL, and gives
 * members a way back instead of a bare framework page.
 *
 * Deliberately a SERVER component with no hooks, no data fetching and no auth
 * calls. Whatever renders here runs on every unmatched URL, including those hit
 * by crawlers and scanners, so it must be inert.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[color:var(--haevn-muted-fg)]">
        404
      </p>
      <h1 className="mt-3 font-heading text-3xl leading-tight text-[color:var(--haevn-navy)]">
        We couldn&rsquo;t find that page
      </h1>
      <p className="mt-3 max-w-[400px] text-[15px] leading-relaxed text-[color:var(--haevn-muted-fg)]">
        The link may be out of date, or the page may have moved.
      </p>
      <Link
        href="/dashboard"
        className="mt-8 inline-flex items-center justify-center rounded-full bg-haevn-orange px-6 py-3 text-white hover:opacity-90"
        style={{ fontWeight: 500, fontSize: '17px' }}
      >
        Back to HAEVN
      </Link>
    </div>
  )
}
