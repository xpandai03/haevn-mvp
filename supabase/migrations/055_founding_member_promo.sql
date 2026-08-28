-- 055_founding_member_promo.sql
-- =============================================================================
-- FOUNDING MEMBER PROMOTION — tier canonicalization + market slugs
-- =============================================================================
-- Paid checkout cannot complete, so eligible free members in enabled markets are
-- granted a complimentary HAEVN+ term. See docs/plans/founding-member-promo.md.
--
-- FULLY IDEMPOTENT. The four attribution columns and their index are ALREADY
-- APPLIED in prod (verified 2026-08-28); they are repeated here so the file is
-- the complete record of the change and can be re-run safely anywhere.
--
-- Rollback: the promo is disabled by flags, not by reverting this file. The only
-- irreversible-by-default step is the 'pro' -> 'plus' canonicalization, which is
-- a rename of the same paid state — no member gains or loses access, and no
-- membership_expires_at is touched.
-- =============================================================================

-- ─── 1. Attribution columns (ALREADY APPLIED — no-ops in prod) ───────────────
ALTER TABLE partnerships
  -- 'founding_member_promo' | 'paid'. NULL = predates this migration.
  ADD COLUMN IF NOT EXISTS plus_source       TEXT,
  -- When HAEVN+ began. membership_expires_at (migration 040) already holds the
  -- end date and is enforced in canAccessConnection + the downgrade cron; this
  -- migration deliberately does NOT add a second expiry column.
  ADD COLUMN IF NOT EXISTS plus_activated_at TIMESTAMPTZ,
  -- markets.slug resolved at activation time. Never a hardcoded city literal.
  ADD COLUMN IF NOT EXISTS promo_market      TEXT,
  -- Which CTA sent them ('unknown' when a CTA passes no source).
  ADD COLUMN IF NOT EXISTS promo_cta_source  TEXT;

CREATE INDEX IF NOT EXISTS idx_partnerships_plus_source
  ON partnerships (plus_source) WHERE plus_source IS NOT NULL;

-- ─── 2-4. Constraint guard + canonicalization, as ONE statement ──────────────
-- Deliberately a single DO block. The first version used a TEMP TABLE to carry
-- "did we drop a constraint?" between statements; that does not survive the
-- Supabase SQL editor's POOLED connection, where consecutive statements can land
-- on different backends. Everything that must share state now lives in one
-- block, which is also what makes this re-runnable from the editor.
--
-- Ordering matters and is deliberate: DROP -> UPDATE -> RECREATE.
--   - The live column is TEXT, not the enum declared in 001 (001 was never fully
--     applied; see the note in 043). If a CHECK allowed only ('free','pro'),
--     writing 'plus' fails — which is exactly how paid upgrades break today.
--   - Recreating BEFORE the update would fail against the old constraint;
--     recreating AFTER means the new constraint is validated against clean data.
--   - If NO check existed, none is added: this restores what it found, it does
--     not invent new enforcement.
--
-- Re-running is a no-op: there is no 'pro' left to update, and the constraint it
-- drops is the one it previously added, recreated identically.
DO $$
DECLARE
  c       RECORD;
  dropped INT := 0;
  moved   INT := 0;
BEGIN
  -- (a) remove whatever CHECK governs membership_tier
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.partnerships'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%membership_tier%'
  LOOP
    EXECUTE format('ALTER TABLE public.partnerships DROP CONSTRAINT %I', c.conname);
    dropped := dropped + 1;
    RAISE NOTICE '055: dropped CHECK % on membership_tier', c.conname;
  END LOOP;
  IF dropped = 0 THEN
    RAISE NOTICE '055: no CHECK on membership_tier — nothing to drop, none will be added';
  END IF;

  -- (b) canonicalize 'pro' -> 'plus'. Same paid state under the canonical name;
  --     access is unchanged (every predicate treats any non-'free' as paid).
  --     membership_expires_at is NOT in the SET list — existing paid expiries
  --     are deliberately untouched.
  UPDATE partnerships SET membership_tier = 'plus' WHERE membership_tier = 'pro';
  GET DIAGNOSTICS moved = ROW_COUNT;
  RAISE NOTICE '055: canonicalized % row(s) from pro to plus', moved;

  -- (c) put a known-good CHECK back, only if we removed one
  IF dropped > 0 THEN
    ALTER TABLE public.partnerships
      ADD CONSTRAINT partnerships_membership_tier_check
      CHECK (membership_tier IN ('free', 'plus', 'pro'));
    RAISE NOTICE '055: recreated CHECK allowing free/plus/pro';
  END IF;
END $$;

-- ─── 5. Market slugs ─────────────────────────────────────────────────────────
-- markets has only (market_name, is_live, notes, ...) — no slug, no display
-- name. FOUNDING_PROMO_MARKETS is a comma list, and market_name is
-- 'Austin–Round Rock MSA' with an EN-DASH (U+2013): unusable in an env var
-- without invisible-character bugs. display_name is what member-facing copy
-- interpolates ("founding members in Austin"), which is not the MSA name either.
--
-- Matched by PATTERN, never by the literal, for the same en-dash reason 043
-- gives. Portland gets NO row here: it becomes a market when the client approves
-- a city list (see the PR description breakdown).
ALTER TABLE markets
  ADD COLUMN IF NOT EXISTS slug         TEXT,
  ADD COLUMN IF NOT EXISTS display_name TEXT;

UPDATE markets
SET slug         = COALESCE(slug, 'austin'),
    display_name = COALESCE(display_name, 'Austin'),
    updated_at   = NOW()
WHERE market_name ILIKE 'Austin%Round Rock%';

CREATE UNIQUE INDEX IF NOT EXISTS idx_markets_slug
  ON markets (slug) WHERE slug IS NOT NULL;

COMMENT ON COLUMN markets.slug IS
  'Stable, URL/env-safe identifier. FOUNDING_PROMO_MARKETS is a comma list of these.';
COMMENT ON COLUMN markets.display_name IS
  'Short city name for member-facing copy. NOT the MSA name.';
