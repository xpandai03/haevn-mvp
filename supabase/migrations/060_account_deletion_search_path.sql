-- 060_account_deletion_search_path.sql
-- Fix: delete_member_account() failed for every member with a photo.
--
-- WHY. 059 declared the function with `set search_path = ''`. Postgres
-- triggers run with the CALLER's search_path unless their own function sets
-- one, and the two DELETE triggers on partnership_photos
-- (reassign_primary_on_delete -> reassign_primary_photo,
--  reassign_banner_on_delete  -> reassign_banner_photo)
-- reference `partnership_photos` unqualified. When deleting the partnership
-- cascaded into its photos, those triggers ran under search_path '' and failed:
--   ERROR 42P01: relation "partnership_photos" does not exist
-- The transaction rolled back (nothing in the DB was deleted), so the member
-- saw "Something went wrong".
--
-- FIX. Pin the function to `public, pg_temp`. The function body already
-- schema-qualifies everything, so this changes nothing about what it touches;
-- it only lets the pre-existing unqualified trigger functions resolve. pg_temp
-- is explicitly LAST so a temp object can never shadow a public one inside
-- this SECURITY DEFINER function. Grants are unchanged (service_role only).
--
-- Verified 2026-09-22 against production inside a transaction that was always
-- rolled back: with this setting the full deletion of the QA account completed
-- (status 'deleted', anonymized copy + audit row written, all rows gone, second
-- call 'already_deleted'); without it, 42P01.

alter function public.delete_member_account(uuid, jsonb, timestamptz)
  set search_path = public, pg_temp;
