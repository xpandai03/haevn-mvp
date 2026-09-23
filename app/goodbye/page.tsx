import type { Metadata } from 'next'
import Link from 'next/link'
import { ClearLocalData } from './ClearLocalData'

export const metadata: Metadata = {
  title: 'Your account has been deleted · HAEVN',
  robots: { index: false, follow: false },
}

export default function GoodbyePage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-16 bg-[color:var(--haevn-dash-surface-alt,#f7f7f5)]">
      <ClearLocalData />
      <div className="w-full max-w-md bg-white border border-[color:var(--haevn-border,#e5e7eb)] px-6 py-10 text-center">
        <h1 className="font-heading text-2xl text-[color:var(--haevn-navy,#0F2A4A)]">
          Your account has been deleted
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-[color:var(--haevn-muted-fg,#64748b)]">
          Your account and personal information have been removed, and you’ve been signed out.
          Thank you for being part of HAEVN.
        </p>
        <Link
          href="/"
          className="mt-8 inline-block text-sm text-[color:var(--haevn-teal,#008080)] hover:underline"
        >
          Back to haevn.app
        </Link>
      </div>
    </main>
  )
}
