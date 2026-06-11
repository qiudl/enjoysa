#!/usr/bin/env bash
# T4 cleanup — removes EN-T4-* test orders from demo DB after T4 sign-off.
# Run via demo-admin.yml once @qa-engineer has confirmed T4 PASS.
set -euo pipefail

PSQL() { docker compose exec -T postgres psql -U postgres -d enjoysa -tAc "$1"; }

echo "Cleaning up T4 test orders from demo DB..."

DELETED_HIST=$(PSQL "DELETE FROM order_status_histories WHERE order_id IN (SELECT id FROM orders WHERE order_no LIKE 'EN-T4-%') RETURNING id;" | wc -l | tr -d '[:space:]')
DELETED_ORDERS=$(PSQL "DELETE FROM orders WHERE order_no LIKE 'EN-T4-%' RETURNING id;" | wc -l | tr -d '[:space:]')

echo "Deleted ${DELETED_HIST} order_status_histories rows"
echo "Deleted ${DELETED_ORDERS} orders rows"
echo "Demo DB clean — no EN-T4-* test orders remaining."
