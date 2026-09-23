-- 059_account_deletion.sql
-- Member-initiated account deletion with anonymize-on-delete.
--
-- WHY. Members could not delete their accounts: the profile page's "Cancel
-- Account" button had no handler and no delete path existed anywhere. Client
-- semantics (2026-09-22): the account and all PII go, with no way back in;
-- survey answers are kept anonymized with city and nothing else personal.
--
-- ONE TRANSACTION. delete_member_account() writes the anonymized copy FIRST and
-- deletes SECOND, inside a single function call, so a failure anywhere rolls
-- the whole thing back and the answers can never be lost mid-way. No staged
-- deleted_at / sweeper is needed: every member-facing read of the deleted
-- partnership goes through rows that disappear in this same commit.
--
-- The non-cascading foreign keys that made a naive auth delete fail are handled
-- explicitly, children first:
--   partnerships.owner_id -> auth.users           (NO ACTION)
--   user_survey_responses.partnership_id -> partnerships (NO ACTION)
--   messages.sender_partnership -> partnerships    (NO ACTION)
--   purchases.partnership_id -> partnerships       (NO ACTION)
--   message_reads.user_id -> auth.users            (NO ACTION)
--
-- NOT IN HERE: storage objects. Supabase blocks direct SQL deletes on
-- storage.objects (protect_objects_delete), so the app removes the member's
-- photo / chat files through the Storage API immediately BEFORE calling this.
--
-- Additive: two new tables and one function. Nothing existing is altered.

-- ── Anonymized survey answers ───────────────────────────────────────────────
-- Deliberately carries NO user id, partnership id, hash, name, contact field or
-- timestamp finer than a month. Nothing here can be joined back to a person,
-- including by us. Answers arrive already scrubbed by lib/account/anonymizeSurvey.ts
-- (allowlist: structured answers only, birthdate -> 5-year age band).
create table if not exists public.anonymized_survey_responses (
  id uuid primary key default gen_random_uuid(),
  city text,
  answers jsonb not null,
  completion_pct integer,
  schema_version integer not null,
  retained_month date not null
);

comment on table public.anonymized_survey_responses is
  'Survey answers of deleted members, anonymized (city only, no identifiers). Service-role only; never member-readable.';

-- ── Departure audit ─────────────────────────────────────────────────────────
-- One row per deleted account so the admin dashboard can count departures.
-- partnership_hash is sha256 of the partnership id: stable (makes a retry
-- idempotent) and not a pointer to anything that still exists.
create table if not exists public.account_deletions (
  id uuid primary key default gen_random_uuid(),
  deleted_at timestamptz not null default now(),
  city text,
  partnership_hash text not null unique
);

comment on table public.account_deletions is
  'One row per member-initiated account deletion: timestamp, city, hashed partnership id. Nothing personal.';

create index if not exists idx_account_deletions_deleted_at on public.account_deletions (deleted_at);

-- Neither table is reachable by members: RLS on with no policies, and the
-- API roles lose every privilege. Only service_role (which bypasses RLS) and
-- direct SQL can read them.
alter table public.anonymized_survey_responses enable row level security;
alter table public.account_deletions enable row level security;
revoke all on public.anonymized_survey_responses from anon, authenticated;
revoke all on public.account_deletions from anon, authenticated;

-- ── The deletion itself ─────────────────────────────────────────────────────
-- p_user_id            the member being deleted (the app passes ONLY the id of
--                      the signed-in session; members cannot call this)
-- p_anonymized         {answers, completion_pct, schema_version} built from the
--                      survey row, or null when the member has no survey
-- p_survey_updated_at  updated_at of the survey row the copy was built from;
--                      if the row changed since, abort ('survey_changed') and
--                      let the app rebuild the copy rather than keep a stale one
--
-- Returns {status: 'deleted' | 'already_deleted', ...}. A second call for the
-- same user is a no-op that returns 'already_deleted'.
create or replace function public.delete_member_account(
  p_user_id uuid,
  p_anonymized jsonb,
  p_survey_updated_at timestamptz
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text;
  v_pids uuid[];
  v_city text;
  v_survey_updated timestamptz;
  v_has_survey boolean := false;
begin
  select lower(email) into v_email from auth.users where id = p_user_id for update;
  if not found then
    return jsonb_build_object('status', 'already_deleted');
  end if;

  -- Every partnership the member belongs to or owns.
  select coalesce(array_agg(distinct pid), '{}') into v_pids from (
    select partnership_id as pid from public.partnership_members where user_id = p_user_id
    union
    select id from public.partnerships where owner_id = p_user_id
  ) s;

  -- A partnership shared with another member is not this member's to delete.
  -- None exist today; refuse loudly rather than take someone else's profile.
  if exists (
    select 1 from public.partnership_members
     where partnership_id = any(v_pids) and user_id <> p_user_id
  ) then
    raise exception 'shared_partnership' using errcode = 'P0001';
  end if;

  perform 1 from public.partnerships where id = any(v_pids) for update;
  select city into v_city from public.partnerships
   where id = any(v_pids) order by (city is null), created_at limit 1;

  -- a. ANONYMIZE FIRST.
  select updated_at into v_survey_updated
    from public.user_survey_responses where user_id = p_user_id for update;
  v_has_survey := found;
  if v_has_survey then
    if p_anonymized is null or p_survey_updated_at is distinct from v_survey_updated then
      raise exception 'survey_changed' using errcode = 'P0001';
    end if;
    insert into public.anonymized_survey_responses (city, answers, completion_pct, schema_version, retained_month)
    values (
      v_city,
      coalesce(p_anonymized->'answers', '{}'::jsonb),
      nullif(p_anonymized->>'completion_pct', '')::integer,
      coalesce(nullif(p_anonymized->>'schema_version', '')::integer, 0),
      date_trunc('month', now())::date
    );
  end if;

  -- b. Audit row.
  insert into public.account_deletions (city, partnership_hash)
  values (
    v_city,
    encode(sha256(convert_to(coalesce(v_pids[1]::text, p_user_id::text), 'UTF8')), 'hex')
  )
  on conflict (partnership_hash) do nothing;

  -- c. PII outside the foreign-key graph.
  update public.system_events
     set metadata = metadata - 'email' - 'phone'
   where jsonb_typeof(metadata) = 'object'
     and (metadata ? 'email' or metadata ? 'phone')
     and (metadata->>'partnership_id' = any(v_pids::text[])
          or (v_email is not null and lower(metadata->>'email') = v_email));
  delete from public.survey_ingest_log
   where user_id = p_user_id
      or partnership_id = any(v_pids)
      or (v_email is not null and lower(email) = v_email);
  if v_email is not null then
    delete from public.email_suppressions where lower(email) = v_email;
  end if;
  delete from auth.audit_log_entries
   where payload->>'actor_id' = p_user_id::text
      or payload->'traits'->>'user_id' = p_user_id::text;

  -- d. Non-cascading children, before their parents.
  delete from public.message_reads where user_id = p_user_id;
  delete from public.messages
   where sender_partnership = any(v_pids)
      or handshake_id in (
        select id from public.handshakes
         where a_partnership = any(v_pids) or b_partnership = any(v_pids)
      );
  delete from public.purchases where partnership_id = any(v_pids) or user_id = p_user_id;
  delete from public.user_survey_responses where user_id = p_user_id or partnership_id = any(v_pids);

  -- e. Partnership: cascades computed_matches, match_history, handshakes (and
  --    their photo_grants), ready_to_meet_signals, hidden_matches,
  --    match_checkins, match_interpretations, partnership_photos rows,
  --    partnership_members, renotify_log, onboarding_state, survey_responses.
  --    Membership tier / founding status live on this row and end with it.
  delete from public.partnerships where id = any(v_pids);

  -- f. Auth user: cascades identities, sessions (-> refresh tokens),
  --    one_time_tokens (pending magic links), mfa, profiles, login_links
  --    (handoff tokens), nudges, conversations, profile_views,
  --    user_onboarding_state, impersonation_log. Every sign-in path dies here.
  delete from auth.users where id = p_user_id;

  return jsonb_build_object(
    'status', 'deleted',
    'partnerships', coalesce(array_length(v_pids, 1), 0),
    'survey_retained', v_has_survey
  );
end;
$$;

comment on function public.delete_member_account(uuid, jsonb, timestamptz) is
  'Member-initiated account deletion: anonymize survey, then remove all PII and the auth user, in one transaction. service_role only.';

revoke all on function public.delete_member_account(uuid, jsonb, timestamptz) from public, anon, authenticated;
grant execute on function public.delete_member_account(uuid, jsonb, timestamptz) to service_role;

-- ── One-time repair: PII left behind by past deletions ──────────────────────
-- Before this migration there was no member deletion path; partnerships removed
-- by operator cleanups left `notification_sent` events still carrying the
-- departed account's email/phone (35 rows at authoring, 2026-09-22). Strip those
-- keys — the same scrub step c applies going forward. Only rows whose
-- partnership no longer exists are touched; live members' events are untouched.
update public.system_events e
   set metadata = e.metadata - 'email' - 'phone'
 where jsonb_typeof(e.metadata) = 'object'
   and (e.metadata ? 'email' or e.metadata ? 'phone')
   and e.metadata->>'partnership_id' is not null
   and not exists (
     select 1 from public.partnerships p where p.id::text = e.metadata->>'partnership_id'
   );
