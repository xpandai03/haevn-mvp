-- 061_matching_excluded.sql
-- Operator accounts that use the app but are never matched or messaged.
--
-- WHY. Payment-processor underwriting (CCBill, the acquiring bank, Visa and
-- Mastercard) needs a real member login on the live system. That account must
-- work like any member's, but it must never enter match computation and never
-- receive a Match Monday, no-match ping, or re-notify message. Reusing
-- profile_state does not work: survey saves, ingest, and the first photo upload
-- all rewrite it to 'live', and middleware keys partnership selection on it.
--
-- WHERE IT IS ENFORCED (app code, see lib/matching/exclusion.ts): the compute
-- candidate pool and loop, release eligibility (cron release, admin
-- trigger-release, notify-matches), the no-match ping audience, the re-notify
-- audience, the match read paths, and a sendNotification backstop.
--
-- DURABLE. NOT NULL DEFAULT false, so existing rows are untouched and nothing
-- is excluded until an operator says so. Members cannot change it: partnerships
-- RLS lets an owner update their own row, so a trigger rejects any change to
-- this column from the authenticated / anon roles. Only the service role and
-- the SQL editor can set or clear it.
--
-- Additive and idempotent.

alter table public.partnerships
  add column if not exists matching_excluded boolean not null default false;

comment on column public.partnerships.matching_excluded is
  'Operator account (e.g. payment underwriting login). true = never matched, never released, never notified; the account still uses the app normally. Set only by service role / SQL.';

-- Partial index: audiences ask "which few rows are excluded?"
create index if not exists idx_partnerships_matching_excluded
  on public.partnerships (id) where matching_excluded;

create or replace function public.guard_matching_excluded()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' and new.matching_excluded then
      raise exception 'matching_excluded can only be set by an operator' using errcode = '42501';
    elsif tg_op = 'UPDATE' and new.matching_excluded is distinct from old.matching_excluded then
      raise exception 'matching_excluded can only be changed by an operator' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_matching_excluded on public.partnerships;
create trigger trg_guard_matching_excluded
  before insert or update of matching_excluded on public.partnerships
  for each row execute function public.guard_matching_excluded();
