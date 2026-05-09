-- REQ-20260509-0015: Admin EN→ZH AI translation (双向对偶 0004).
--
-- 0004 加了 *_en 两个 flag (auto_generated_en, manual_override_en) 让 admin
-- ZH→EN 翻译可追溯且可锁定。本期对偶补全 *_zh 两个 flag，让 admin/supplier
-- 任意一边都能从对面语言自动翻译，并独立标记/锁定。
--
-- 与 006 对偶：ADD COLUMN with literal default 在 PostgreSQL 11+ 是 metadata-only，
-- 在大 products 表上也是快速锁定的变更。

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS auto_generated_zh  BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS manual_override_zh BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_products_auto_generated_zh
  ON products (auto_generated_zh)
  WHERE auto_generated_zh = TRUE;
