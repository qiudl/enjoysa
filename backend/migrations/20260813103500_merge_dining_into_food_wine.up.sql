BEGIN;

-- Preserve the exact pre-migration assignments so the down migration can
-- restore them without guessing. This table is intentionally retained.
CREATE TABLE IF NOT EXISTS category_merge_product_backup (
    migration_key VARCHAR(100) NOT NULL,
    product_id BIGINT NOT NULL,
    category_id BIGINT NOT NULL,
    tags JSONB,
    PRIMARY KEY (migration_key, product_id)
);

ALTER TABLE category_merge_product_backup ADD COLUMN IF NOT EXISTS tags JSONB;

INSERT INTO category_merge_product_backup (migration_key, product_id, category_id, tags)
SELECT '20260813103500_dining_to_food_wine', p.id, p.category_id, p.tags
FROM products p
JOIN categories source ON source.id = p.category_id
WHERE source.slug = 'dining'
ON CONFLICT (migration_key, product_id) DO NOTHING;

UPDATE products
SET category_id = (SELECT id FROM categories WHERE slug = 'food-wine' AND deleted_at IS NULL LIMIT 1),
    updated_at = NOW()
WHERE category_id = (SELECT id FROM categories WHERE slug = 'dining' AND deleted_at IS NULL LIMIT 1)
  AND EXISTS (SELECT 1 FROM categories WHERE slug = 'food-wine' AND deleted_at IS NULL);

UPDATE products
SET tags = REPLACE(tags::text, '餐饮美食', '美食美酒')::jsonb,
    updated_at = NOW()
WHERE tags::text LIKE '%餐饮美食%';

UPDATE categories
SET deleted_at = NOW(), updated_at = NOW()
WHERE slug = 'dining' AND deleted_at IS NULL;

UPDATE categories
SET name_zh = '美食美酒', name_en = 'Food & Wine', icon = 'wine', sort_order = 2, updated_at = NOW()
WHERE slug = 'food-wine' AND deleted_at IS NULL;

COMMIT;
