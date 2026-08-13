BEGIN;

UPDATE categories
SET deleted_at = NULL, updated_at = NOW()
WHERE slug = 'dining';

UPDATE products p
SET category_id = backup.category_id, updated_at = NOW()
FROM category_merge_product_backup backup
WHERE backup.migration_key = '20260813103500_dining_to_food_wine'
  AND backup.product_id = p.id;

DELETE FROM category_merge_product_backup
WHERE migration_key = '20260813103500_dining_to_food_wine';

COMMIT;
