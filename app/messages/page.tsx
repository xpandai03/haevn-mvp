'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2, MessageCircle, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/auth/context'
import {
  getMyConversations,
  type ConversationItem,
} from '@/lib/actions/connections'
import { getUserMembershipTier } from '@/lib/actions/dashboard'
import { firstNameFromDisplayName } from '@/lib/utils/matchCardDisplay'
import {
  formatConversationListTime,
  formatConversationPreviewText,
} from '@/lib/utils/conversationPreview'
import FullPageLoader from '@/components/ui/full-page-loader'

function MessagesPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const partner = searchParams.get('partner')
  const { user, loading: authLoading } = useAuth()

  const [conversations, setConversations] = useState<ConversationItem[]>([])
  const [tier, setTier] = useState<'free' | 'plus'>('free')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      if (authLoading) return
      if (!user) {
        router.replace('/auth/login')
        return
      }
      try {
        setLoading(true)
        const [list, membership] = await Promise.all([
          getMyConversations(),
          getUserMembershipTier(),
        ])
        setConversations(list)
        setTier(membership)
      } catch (e: unknown) {
        console.error('[Messages]', e)
        setError(e instanceof Error ? e.message : 'Failed to load messages')
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [user, authLoading, router])

  if (authLoading || loading) {
    return <FullPageLoader />
  }

  if (error) {
    return (
      <div className="w-full px-6 py-16 sm:px-10">
        <div className="dash-card mx-auto max-w-md p-8">
          <h2 className="font-heading text-xl text-[color:var(--haevn-navy)]">
            Couldn&apos;t load conversations
          </h2>
          <p className="mt-2 text-sm text-[color:var(--haevn-muted-fg)]">{error}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="haevn-btn-primary mt-6"
          >
            Try again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full">
      <header className="border-b border-[color:var(--haevn-border)] px-6 pb-6 pt-10 sm:px-10">
        <div className="mx-auto max-w-5xl">
          <p className="text-[11px] uppercase tracking-[0.22em] text-[color:var(--haevn-teal)]">
            Inbox
          </p>
          <h1 className="font-heading mt-2 text-3xl leading-tight text-[color:var(--haevn-navy)] sm:text-4xl">
            Messages
          </h1>
          <p className="mt-2 text-sm text-[color:var(--haevn-muted-fg)]">
            Your active conversations
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8 sm:px-10 sm:py-12">
        {partner && (
          <p className="mb-4 text-xs text-[color:var(--haevn-muted-fg)]">
            Context: partnership {partner}
          </p>
        )}

        {tier === 'free' && (
          <div className="dash-card mb-6 border border-[color:var(--haevn-border)] bg-[color:var(--haevn-dash-surface-alt)] px-4 py-3 text-sm text-[color:var(--haevn-charcoal)]">
            You&apos;re viewing as a Member.{' '}
            <Link
              href="/onboarding/membership"
              className="font-medium text-[color:var(--haevn-teal)] underline underline-offset-2"
            >
              Upgrade to HAEVN+
            </Link>{' '}
            to open chats and send messages.
          </div>
        )}

        {conversations.length === 0 ? (
          <div className="dash-card p-10 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center border border-[color:var(--haevn-border)] bg-[color:var(--haevn-dash-surface-alt)]">
              <MessageCircle
                className="h-7 w-7 text-[color:var(--haevn-muted-fg)]"
                strokeWidth={1.25}
              />
            </div>
            <h2 className="font-heading text-xl text-[color:var(--haevn-navy)]">
              No conversations yet
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-[color:var(--haevn-muted-fg)]">
              When you connect with a match, your thread will show here. Start
              from Matches to send a connection request.
            </p>
            <Link href="/dashboard/matches" className="haevn-btn-teal mt-6 inline-block">
              View matches
            </Link>
          </div>
        ) : (
          <div className="dash-card divide-y divide-[color:var(--haevn-border)] overflow-hidden">
            {conversations.map((convo) => {
              const isFree = tier === 'free'
              const first = firstNameFromDisplayName(convo.displayName)
              const displayName = isFree
                ? `${first.charAt(0).toUpperCase()}***`
                : first
              const preview = convo.lastMessage
                ? formatConversationPreviewText(
                    convo.lastMessage.body,
                    convo.lastMessage.imageUrl
                  )
                : 'Tap to start chatting'
              const timeLabel = convo.lastMessage
                ? formatConversationListTime(convo.lastMessage.createdAt)
                : convo.matchedAt
                  ? formatConversationListTime(convo.matchedAt)
                  : ''

              const rowClass = cn(
                'flex items-center gap-4 p-4 transition-colors',
                isFree
                  ? 'cursor-default opacity-60'
                  : 'hover:bg-[color:var(--haevn-dash-surface-alt)]'
              )

              const inner = (
                <>
                  <div className="relative h-12 w-12 shrink-0 overflow-hidden border border-[color:var(--haevn-border)] bg-[color:var(--haevn-warm-gray)] keep-rounded">
                    {!isFree && convo.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={convo.photoUrl}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : isFree ? (
                      <div className="flex h-full w-full items-center justify-center text-[color:var(--haevn-charcoal)]/30">
                        <User className="h-6 w-6" />
                      </div>
                    ) : (
                      <div className="flex h-full w-full items-center justify-center font-heading text-lg text-[color:var(--haevn-charcoal)]/50">
                        {first.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <h3 className="font-heading truncate text-sm font-semibold text-[color:var(--haevn-navy)]">
                        {displayName}
                      </h3>
                      {!isFree && timeLabel && (
                        <span className="shrink-0 text-xs text-[color:var(--haevn-charcoal)]/45">
                          {timeLabel}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-sm text-[color:var(--haevn-charcoal)]/65">
                      {isFree ? (
                        'Upgrade to HAEVN+ to message'
                      ) : (
                        <>
                          {convo.lastMessage?.isOwn ? 'You: ' : ''}
                          {preview}
                        </>
                      )}
                    </p>
                  </div>
                  {!isFree && convo.unreadCount > 0 && (
                    <div className="flex h-6 min-w-[1.5rem] shrink-0 items-center justify-center bg-haevn-orange px-1.5 keep-rounded">
                      <span className="text-[10px] font-bold text-white">
                        {convo.unreadCount > 9 ? '9+' : convo.unreadCount}
                      </span>
                    </div>
                  )}
                </>
              )

              return isFree ? (
                <div key={convo.handshakeId} className={rowClass} aria-disabled>
                  {inner}
                </div>
              ) : (
                <Link
                  key={convo.handshakeId}
                  href={`/chat/${convo.handshakeId}`}
                  className={rowClass}
                >
                  {inner}
                </Link>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}

export default function MessagesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-[color:var(--haevn-teal)]" />
        </div>
      }
    >
      <MessagesPageInner />
    </Suspense>
  )
}
