'use client'

import { useState, useTransition } from 'react'
import { AlertTriangle } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { deleteMyAccount } from '@/lib/actions/account'

export const DELETE_CONFIRM_COPY =
  'This permanently deletes your account and personal information. Your anonymous survey responses are retained. This cannot be undone.'

const ERROR_COPY = {
  shared_partnership:
    'This profile is shared with a partner, so it can’t be deleted from here. Email support@haevn.app and we’ll take care of it.',
  failed: 'Something went wrong and nothing was deleted. Please try again, or email support@haevn.app.',
} as const

/**
 * The bottom-of-settings danger section: one red button, one confirmation,
 * then signed out onto /goodbye.
 */
export function DeleteAccountSection() {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const confirm = () => {
    setError(null)
    startTransition(async () => {
      try {
        const res = await deleteMyAccount()
        if (res.ok) {
          // Hard navigation so the cleared auth cookies and a fresh middleware
          // pass apply; nothing of the old session survives in memory.
          window.location.replace('/goodbye')
          return
        }
        setError(ERROR_COPY[res.error])
      } catch {
        setError(ERROR_COPY.failed)
      }
    })
  }

  return (
    <section
      id="delete-account"
      aria-labelledby="delete-account-heading"
      className="bg-white border border-red-200 overflow-hidden"
    >
      <div className="px-6 py-4 border-b border-red-100">
        <h3
          id="delete-account-heading"
          className="text-sm font-medium text-red-600 tracking-[0.14em] uppercase"
        >
          Danger Zone
        </h3>
      </div>
      <div className="px-6 py-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-[color:var(--haevn-navy)]">Delete my account</p>
          <p className="text-[13px] text-[color:var(--haevn-muted-fg)] mt-0.5">
            Permanently remove your account and personal information.
          </p>
        </div>
        <AlertDialog open={open} onOpenChange={(v) => !pending && setOpen(v)}>
          <AlertDialogTrigger asChild>
            <button
              type="button"
              data-testid="delete-account-button"
              className="w-full sm:w-auto shrink-0 inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors"
            >
              <AlertTriangle className="w-4 h-4" strokeWidth={1.75} />
              Delete my account
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent className="w-[calc(100vw-32px)] max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle>Delete your account?</AlertDialogTitle>
              <AlertDialogDescription>{DELETE_CONFIRM_COPY}</AlertDialogDescription>
            </AlertDialogHeader>
            {error && (
              <p role="alert" className="text-sm text-red-600">
                {error}
              </p>
            )}
            <AlertDialogFooter className="gap-2">
              <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
              <button
                type="button"
                data-testid="delete-account-confirm"
                onClick={confirm}
                disabled={pending}
                className="inline-flex items-center justify-center px-4 py-2 rounded-md bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-60"
              >
                {pending ? 'Deleting…' : 'Delete my account'}
              </button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </section>
  )
}
