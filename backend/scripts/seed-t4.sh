#!/usr/bin/env bash
# T4 test order seeder — run via demo-admin.yml after demo backend deploy.
# Creates 3 test PaymentIntents (pm_card_visa, AUD 100, succeeded) and seeds
# 3 paid orders. Requires STRIPE_SECRET_KEY_TEST in env.
set -euo pipefail

SK="${STRIPE_SECRET_KEY_TEST:?STRIPE_SECRET_KEY_TEST not set}"

PSQL() { docker compose exec -T postgres psql -U postgres -d enjoysa -tAc "$1"; }

UID_=$(PSQL "SELECT id FROM users ORDER BY id LIMIT 1;" | tr -d '[:space:]')
SID_=$(PSQL "SELECT id FROM suppliers ORDER BY id LIMIT 1;" | tr -d '[:space:]')
PID_=$(PSQL "SELECT id FROM products ORDER BY id LIMIT 1;" | tr -d '[:space:]')

if [ -z "$UID_" ] || [ -z "$SID_" ] || [ -z "$PID_" ]; then
  echo "ERROR: demo DB missing users/suppliers/products — run with reset_db=true first" >&2
  exit 1
fi

echo "Seeding T4 orders (user=$UID_, supplier=$SID_, product=$PID_)"

for i in 1 2 3; do
  PI=$(curl -s https://api.stripe.com/v1/payment_intents \
    -u "$SK:" \
    -d amount=10000 \
    -d currency=aud \
    -d payment_method=pm_card_visa \
    -d confirm=true \
    -d "automatic_payment_methods[enabled]=true" \
    -d "automatic_payment_methods[allow_redirects]=never" \
    | grep -oE '"id": ?"pi_[^"]+"' | head -1 | grep -oE 'pi_[^"]+')

  if [ -z "$PI" ]; then
    echo "ERROR: Stripe PI creation failed for order $i" >&2
    exit 1
  fi

  ONO="EN-T4-$(date +%s)-$i"
  OID=$(PSQL "INSERT INTO orders (order_no,status,user_id,supplier_id,product_id,quantity,unit_price,total_price,currency,stripe_payment_intent_id,created_at,updated_at) VALUES ('$ONO','paid',$UID_,$SID_,$PID_,1,100.00,100.00,'AUD','$PI',NOW(),NOW()) RETURNING id;" | tr -d '[:space:]')

  echo "ORDER id=$OID order_no=$ONO amount=AUD100.00 PI=$PI status=paid"
done

echo ""
echo "Done. Use order ids above for T4:"
echo "  - Scenario 1: 8-concurrent double-refund on order #1"
echo "  - Scenario 2: normal full refund on order #2"
echo "  - Order #3: spare"
