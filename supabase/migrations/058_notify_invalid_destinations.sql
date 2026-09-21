-- 058_notify_invalid_destinations.sql
-- Permanently-invalid notification destinations, marked per CHANNEL.
--
-- WHY. The 2026-09-21 Monday run logged 28 Twilio "Invalid 'To' Phone Number"
-- failures and 1 Resend "Invalid `to` field" failure. Those destinations cannot
-- succeed on any future attempt, but nothing recorded that, so every Monday
-- re-attempts them, re-burns a send slot, and re-reports them as failures —
-- making a clean run look dirty forever.
--
-- PER CHANNEL, NOT PER MEMBER. A member with a mistyped phone but a working
-- email must keep receiving email, and vice versa. Two independent columns, so
-- marking one channel never silences the other.
--
-- MARK, NEVER DELETE. The bad value stays in `phone` / the profile so support
-- can see what the member actually typed and ask them to fix it. This only
-- records that WE stopped trying. Clearing the timestamp re-enables the channel
-- the moment a member updates their details.
--
-- Additive, nullable, idempotent. No backfill: the columns start NULL and fill
-- from the next run's provider responses, so nothing is assumed about history.

alter table public.partnerships
  add column if not exists notify_phone_invalid_at timestamptz,
  add column if not exists notify_email_invalid_at timestamptz;

comment on column public.partnerships.notify_phone_invalid_at is
  'Set when the SMS provider rejected this number as permanently invalid. Non-null = skip SMS. Clear to retry after the member updates their phone.';
comment on column public.partnerships.notify_email_invalid_at is
  'Set when the email provider rejected the address as permanently invalid. Non-null = skip email. Clear to retry after the member updates their address.';

-- Partial indexes: the send path asks "is this one marked?" for a small
-- minority of rows, so only the marked rows need to be indexed.
create index if not exists idx_partnerships_notify_phone_invalid
  on public.partnerships (id) where notify_phone_invalid_at is not null;
create index if not exists idx_partnerships_notify_email_invalid
  on public.partnerships (id) where notify_email_invalid_at is not null;
