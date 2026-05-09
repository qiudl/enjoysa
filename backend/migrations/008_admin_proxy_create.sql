-- REQ-20260509-0019: Admin 代供应商录商品 + 一站式审核 — 持久化代录身份。
--
-- 解决"admin 代 supplier 录的商品 supplier 看不出是谁帮我录的"。
-- created_via='admin_proxy' 让 admin/supplier 双方在列表与详情中都能识别代录商品；
-- created_by_admin_id 关联到 admin 主键，supplier 端仅展示 admin.name（不暴露 email）。
--
-- ON DELETE SET NULL：admin 离职后历史代录关系优雅降级（保留 created_via=admin_proxy
-- + name 显示空），不删商品也不阻止 admin 下线。
--
-- ADD COLUMN with literal default 在 PostgreSQL 11+ 是 metadata-only，不锁表。

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS created_by_admin_id BIGINT,
  ADD COLUMN IF NOT EXISTS created_via         VARCHAR(20) NOT NULL DEFAULT 'supplier_self';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_products_created_by_admin'
  ) THEN
    ALTER TABLE products
      ADD CONSTRAINT fk_products_created_by_admin
      FOREIGN KEY (created_by_admin_id) REFERENCES admins(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_products_created_via
  ON products (created_via)
  WHERE created_via = 'admin_proxy';
