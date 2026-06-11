package handler

// Tests for the refund money-safety fix (task #7 / G4 refund):
//   - a duplicate / concurrent refund must never reach Stripe twice;
//   - the atomic ClaimRefundIntent guard lets only one caller win.
//
// NOTE on the DB: these run on glebarez sqlite with MaxOpenConns(1), which
// serializes the transactions so the guard's logic (second caller observes
// RefundStatus=processing) is exercised deterministically. The real
// SELECT ... FOR UPDATE row lock that makes this safe under genuine parallel
// load is a Postgres feature and is validated dynamically by QA in staging
// (T4). The assertion that matters here — "Stripe is charged at most once" —
// holds under both.

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"sync"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"

	"enjoysa-backend/internal/models"
	ordermodel "enjoysa-backend/internal/order/model"
	"enjoysa-backend/internal/order/store"
	"enjoysa-backend/internal/payment/gateway"
)

// mockGateway implements gateway.PaymentGateway and records how many times
// Refund was invoked and with what idempotency key.
type mockGateway struct {
	mu          sync.Mutex
	refundCalls int
	lastKey     string
}

func (m *mockGateway) CreateCheckoutSession(p gateway.CheckoutParams) (*gateway.CheckoutSession, error) {
	return &gateway.CheckoutSession{}, nil
}

func (m *mockGateway) VerifyWebhookSignature(payload []byte, signature string) (*gateway.WebhookEvent, error) {
	return &gateway.WebhookEvent{}, nil
}

func (m *mockGateway) Refund(paymentIntentID string, amount int64, idempotencyKey string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.refundCalls++
	m.lastKey = idempotencyKey
	return nil
}

func setupRefundTest(t *testing.T) (*SupplierOrderHandler, *store.OrderStore, *mockGateway) {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatalf("db handle: %v", err)
	}
	sqlDB.SetMaxOpenConns(1) // serialize so the guard logic is deterministic on sqlite
	if err := db.AutoMigrate(&models.User{}, &models.Supplier{}, &ordermodel.Order{}, &ordermodel.OrderStatusHistory{}); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	os := store.NewOrderStore(db)
	mg := &mockGateway{}
	// productStore is unused by the refund path; feishu client is nil (its
	// methods are nil-safe, so the orphan-alert call is a no-op in tests).
	h := NewSupplierOrderHandler(os, nil, mg, nil)
	return h, os, mg
}

func seedPaidOrder(t *testing.T, os *store.OrderStore, supplierID, userID uint) *ordermodel.Order {
	t.Helper()
	o := &ordermodel.Order{
		OrderNo:               "EN-TEST-0001",
		Status:                ordermodel.OrderStatusPaid,
		UserID:                userID,
		SupplierID:            supplierID,
		ProductID:             1,
		Quantity:              1,
		UnitPrice:             100,
		TotalPrice:            100,
		Currency:              "AUD",
		StripePaymentIntentID: "pi_test_123",
	}
	if err := os.Create(o); err != nil {
		t.Fatalf("seed order: %v", err)
	}
	return o
}

func doRefund(h *SupplierOrderHandler, orderID, supplierID, supplierUserID uint) *httptest.ResponseRecorder {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(w)
	ctx.Set("supplier_id", supplierID)
	ctx.Set("supplier_user_id", supplierUserID)
	ctx.Params = gin.Params{{Key: "id", Value: strconv.FormatUint(uint64(orderID), 10)}}

	body, _ := json.Marshal(map[string]interface{}{"type": "full", "reason": "test"})
	req := httptest.NewRequest(http.MethodPost, "/refund", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	ctx.Request = req

	h.RefundOrder(ctx)
	return w
}

func TestRefundOrder_DuplicateRejected_StripeCalledOnce(t *testing.T) {
	h, os, mg := setupRefundTest(t)
	const supplierID, supplierUserID = uint(7), uint(70)
	o := seedPaidOrder(t, os, supplierID, supplierUserID)

	// First refund succeeds.
	w1 := doRefund(h, o.ID, supplierID, supplierUserID)
	if w1.Code != http.StatusOK {
		t.Fatalf("first refund: want 200, got %d (%s)", w1.Code, w1.Body.String())
	}

	// Second (duplicate) refund must be rejected with 409 and must NOT reach Stripe.
	w2 := doRefund(h, o.ID, supplierID, supplierUserID)
	if w2.Code != http.StatusConflict {
		t.Fatalf("duplicate refund: want 409, got %d (%s)", w2.Code, w2.Body.String())
	}

	mg.mu.Lock()
	defer mg.mu.Unlock()
	if mg.refundCalls != 1 {
		t.Fatalf("Stripe Refund called %d times, want exactly 1", mg.refundCalls)
	}
	if want := "refund-" + o.OrderNo; mg.lastKey != want {
		t.Fatalf("idempotency key = %q, want %q", mg.lastKey, want)
	}

	got, err := os.GetByID(o.ID)
	if err != nil {
		t.Fatalf("reload order: %v", err)
	}
	if got.RefundStatus != "completed" || got.Status != ordermodel.OrderStatusRefunded {
		t.Fatalf("order after refund: status=%s refund=%s, want refunded/completed", got.Status, got.RefundStatus)
	}
}

func TestRefundOrder_ConcurrentRefunds_SingleStripeRefund(t *testing.T) {
	h, os, mg := setupRefundTest(t)
	const supplierID, supplierUserID = uint(7), uint(70)
	o := seedPaidOrder(t, os, supplierID, supplierUserID)

	const racers = 8
	var wg sync.WaitGroup
	codes := make([]int, racers)
	for i := 0; i < racers; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			codes[idx] = doRefund(h, o.ID, supplierID, supplierUserID).Code
		}(i)
	}
	wg.Wait()

	okCount := 0
	for _, c := range codes {
		if c == http.StatusOK {
			okCount++
		}
	}
	if okCount != 1 {
		t.Fatalf("concurrent refunds: %d succeeded, want exactly 1 (codes=%v)", okCount, codes)
	}

	mg.mu.Lock()
	defer mg.mu.Unlock()
	if mg.refundCalls != 1 {
		t.Fatalf("Stripe Refund called %d times under concurrency, want exactly 1", mg.refundCalls)
	}
}

func TestClaimRefundIntent_SecondClaimRejected(t *testing.T) {
	_, os, _ := setupRefundTest(t)
	o := seedPaidOrder(t, os, 7, 70)

	if _, err := os.ClaimRefundIntent(o.ID, "full", 100); err != nil {
		t.Fatalf("first claim: unexpected error %v", err)
	}
	if _, err := os.ClaimRefundIntent(o.ID, "full", 100); err != store.ErrRefundInProgress {
		t.Fatalf("second claim: want ErrRefundInProgress, got %v", err)
	}
}
