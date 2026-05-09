-- REQ-20260509-0004: Admin ZH→EN AI translation + historical EN backfill.
--
-- Track which products have AI-generated English copy so admin reviewers can
-- prioritise them, and let admins lock the EN side so ZH edits stop triggering
-- automatic re-translation that would clobber human polish.
--
-- ADD COLUMN with a literal default is metadata-only on PostgreSQL 11+, so
-- this is a fast-locking change even on a large products table.

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS auto_generated_en  BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS manual_override_en BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_products_auto_generated_en
  ON products (auto_generated_en)
  WHERE auto_generated_en = TRUE;
