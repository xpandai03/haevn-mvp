'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { runDeleteMyAccount, supabaseDeletionStore, type DeleteMyAccountResult } from '@/lib/account/deleteAccount'

/**
 * Delete the SIGNED-IN member's account. Takes no arguments on purpose: the
 * id comes only from the verified session (getUser, which asks the auth
 * server), so a member can never target anyone else. The RPC it ends in is
 * service_role-only at the database level too (migration 059).
 */
export async function deleteMyAccount(): Promise<DeleteMyAccountResult> {
  const supabase = await createClient()
  return runDeleteMyAccount({
    sessionUserId: async () => {
      const { data } = await supabase.auth.getUser()
      return data.user?.id ?? null
    },
    store: supabaseDeletionStore(createAdminClient()),
    signOut: async () => {
      await supabase.auth.signOut({ scope: 'local' })
    },
  })
}
