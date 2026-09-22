'use client'

import { useEffect } from 'react'

/** Browser-side leftovers from the deleted account: signup name/email/phone,
 *  cached profile/photos, Supabase's own session keys. Cleared on arrival so
 *  a shared device keeps nothing. */
export function ClearLocalData() {
  useEffect(() => {
    try {
      for (const store of [window.localStorage, window.sessionStorage]) {
        const keys: string[] = []
        for (let i = 0; i < store.length; i++) {
          const k = store.key(i)
          if (k && (k.startsWith('haevn_') || k.startsWith('sb-') || k === 'veriff_session_id')) keys.push(k)
        }
        keys.forEach((k) => store.removeItem(k))
      }
    } catch {
      // Storage can be blocked (private mode); nothing to clear then.
    }
  }, [])
  return null
}
