package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"enjoysa-backend/internal/models"
	ordermodel "enjoysa-backend/internal/order/model"
	"enjoysa-backend/internal/order/store"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

// REQ-20260511-0011 · VerifyOrder handler tests.
// Covers the 5 documented branches plus the GetOrder verification_code omit
// behavior for unpaid orders.

func init() {
	gin.SetMode(gin.TestMode)
}

func newVerifyTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(
		&models.User{},
		&models.Supplier{},
		&ordermodel.Order{},
		&ordermodel.OrderStatusHistory{},
	); err != nil {
		t.Fatalf("automigrate: %v", err)
	}
	return db
}

func seedOrder(t *testing.T, db *gorm.DB, o *ordermodel.Order) *ordermodel.Order {
	t.Helper()
	if err := db.Create(o).Error; err != nil {
		t.Fatalf("seed order: %v", err)
	}
	return o
}

func newVerifyHandler(db *gorm.DB) *SupplierOrderHandler {
	return NewSupplierOrderHandler(store.NewOrderStore(db), nil, nil)
}

func callVerify(t *testing.T, h *SupplierOrderHandler, orderID uint, supplierID, supplierUserID uint, body any) *httptest.ResponseRecorder {
	t.Helper()
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	raw, err := json.Marshal(body)
	if err != nil {
		t.Fatalf("marshal body: %v", err)
	}
	req := httptest.NewRequest(http.MethodPost, "/api/v1/supplier/orders/1/verify", bytes.NewReader(raw))
	req.Header.Set("Content-Type", "application/json")
	c.Request = req
	c.Params = gin.Params{{Key: "id", Value: itoa(orderID)}}
	c.Set("supplier_id", supplierID)
	c.Set("supplier_user_id", supplierUserID)
	h.VerifyOrder(c)
	return w
}

func itoa(u uint) string {
	const digits = "0123456789"
	if u == 0 {
		return "0"
	}
	buf := make([]byte, 0, 10)
	for u > 0 {
		buf = append([]byte{digits[u%10]}, buf...)
		u /= 10
	}
	return string(buf)
}

func decodeBody(t *testing.T, w *httptest.ResponseRecorder) map[string]any {
	t.Helper()
	var body map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode body: %v (%s)", err, w.Body.String())
	}
	return body
}

func TestVerifyOrder_Success(t *testing.T) {
	db := newVerifyTestDB(t)
	h := newVerifyHandler(db)

	o := seedOrder(t, db, &ordermodel.Order{
		OrderNo:    "ES20260511000001",
		Status:     ordermodel.OrderStatusPaid,
		SupplierID: 10,
		UserID:     1,
		ProductID:  1,
		Quantity:   1,
		UnitPrice:  100,
		TotalPrice: 100,
	})

	w := callVerify(t, h, o.ID, 10, 42, map[string]string{"verification_code": o.VerificationCode})
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	// DB state: verified_at set
	var got ordermodel.Order
	if err := db.First(&got, o.ID).Error; err != nil {
		t.Fatal(err)
	}
	if got.VerifiedAt == nil {
		t.Fatal("verified_at should be set after success")
	}
	if got.VerifiedBy == nil || *got.VerifiedBy != 42 {
		t.Fatalf("verified_by mismatch: %v", got.VerifiedBy)
	}

	// History row was written
	var historyCount int64
	db.Model(&ordermodel.OrderStatusHistory{}).Where("order_id = ?", o.ID).Count(&historyCount)
	if historyCount != 1 {
		t.Fatalf("expected 1 history row, got %d", historyCount)
	}
}

func TestVerifyOrder_InvalidCode_400(t *testing.T) {
	db := newVerifyTestDB(t)
	h := newVerifyHandler(db)

	o := seedOrder(t, db, &ordermodel.Order{
		OrderNo:    "ES20260511000002",
		Status:     ordermodel.OrderStatusPaid,
		SupplierID: 10,
		UserID:     1,
		ProductID:  1,
		Quantity:   1,
		UnitPrice:  100,
		TotalPrice: 100,
	})

	w := callVerify(t, h, o.ID, 10, 42, map[string]string{"verification_code": "VRF-WRONG1"})
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
	if body := decodeBody(t, w); body["code"] != "invalid_code" {
		t.Fatalf("expected code=invalid_code, got %v", body["code"])
	}

	// verified_at must NOT be set
	var got ordermodel.Order
	if err := db.First(&got, o.ID).Error; err != nil {
		t.Fatal(err)
	}
	if got.VerifiedAt != nil {
		t.Fatal("verified_at must remain nil after invalid code")
	}
}

func TestVerifyOrder_AlreadyVerified_409(t *testing.T) {
	db := newVerifyTestDB(t)
	h := newVerifyHandler(db)

	now := time.Now()
	var by uint = 7
	o := seedOrder(t, db, &ordermodel.Order{
		OrderNo:    "ES20260511000003",
		Status:     ordermodel.OrderStatusPaid,
		SupplierID: 10,
		UserID:     1,
		ProductID:  1,
		Quantity:   1,
		UnitPrice:  100,
		TotalPrice: 100,
		VerifiedAt: &now,
		VerifiedBy: &by,
	})

	w := callVerify(t, h, o.ID, 10, 42, map[string]string{"verification_code": o.VerificationCode})
	if w.Code != http.StatusConflict {
		t.Fatalf("expected 409, got %d", w.Code)
	}
	if body := decodeBody(t, w); body["code"] != "already_verified" {
		t.Fatalf("expected code=already_verified, got %v", body["code"])
	}
}

func TestVerifyOrder_CrossSupplier_403(t *testing.T) {
	db := newVerifyTestDB(t)
	h := newVerifyHandler(db)

	o := seedOrder(t, db, &ordermodel.Order{
		OrderNo:    "ES20260511000004",
		Status:     ordermodel.OrderStatusPaid,
		SupplierID: 10, // owner
		UserID:     1,
		ProductID:  1,
		Quantity:   1,
		UnitPrice:  100,
		TotalPrice: 100,
	})

	// Caller is supplier 99, not 10
	w := callVerify(t, h, o.ID, 99, 50, map[string]string{"verification_code": o.VerificationCode})
	if w.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", w.Code)
	}
	if body := decodeBody(t, w); body["code"] != "forbidden" {
		t.Fatalf("expected code=forbidden, got %v", body["code"])
	}

	// Order must not be verified
	var got ordermodel.Order
	if err := db.First(&got, o.ID).Error; err != nil {
		t.Fatal(err)
	}
	if got.VerifiedAt != nil {
		t.Fatal("verified_at must remain nil after cross-supplier attempt")
	}
}

func TestVerifyOrder_InvalidStatus_422(t *testing.T) {
	cases := []struct {
		name   string
		status ordermodel.OrderStatus
	}{
		{"pending", ordermodel.OrderStatusPending},
		{"cancelled", ordermodel.OrderStatusCancelled},
		{"refunded", ordermodel.OrderStatusRefunded},
		{"completed", ordermodel.OrderStatusCompleted},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			db := newVerifyTestDB(t)
			h := newVerifyHandler(db)
			o := seedOrder(t, db, &ordermodel.Order{
				OrderNo:    "ES20260511X00" + tc.name,
				Status:     tc.status,
				SupplierID: 10,
				UserID:     1,
				ProductID:  1,
				Quantity:   1,
				UnitPrice:  100,
				TotalPrice: 100,
			})
			w := callVerify(t, h, o.ID, 10, 42, map[string]string{"verification_code": o.VerificationCode})
			if w.Code != http.StatusUnprocessableEntity {
				t.Fatalf("status=%s expected 422, got %d", tc.status, w.Code)
			}
			if body := decodeBody(t, w); body["code"] != "invalid_status" {
				t.Fatalf("expected code=invalid_status, got %v", body["code"])
			}
		})
	}
}

func TestGetOrder_PendingOmitsVerificationCode(t *testing.T) {
	db := newVerifyTestDB(t)
	h := newVerifyHandler(db)

	o := seedOrder(t, db, &ordermodel.Order{
		OrderNo:    "ES20260511PEND01",
		Status:     ordermodel.OrderStatusPending,
		SupplierID: 10,
		UserID:     1,
		ProductID:  1,
		Quantity:   1,
		UnitPrice:  100,
		TotalPrice: 100,
	})
	if o.VerificationCode == "" {
		t.Fatal("BeforeCreate must generate verification_code")
	}

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodGet, "/api/v1/supplier/orders/1", nil)
	c.Params = gin.Params{{Key: "id", Value: itoa(o.ID)}}
	c.Set("supplier_id", uint(10))
	h.GetOrder(c)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	body := decodeBody(t, w)
	data, ok := body["data"].(map[string]any)
	if !ok {
		t.Fatalf("data not object: %v", body)
	}
	if v, present := data["verification_code"]; present && v != "" {
		t.Fatalf("pending order must omit verification_code, got %v", v)
	}
}

func TestGetOrder_PaidReturnsVerificationCode(t *testing.T) {
	db := newVerifyTestDB(t)
	h := newVerifyHandler(db)

	o := seedOrder(t, db, &ordermodel.Order{
		OrderNo:    "ES20260511PAID01",
		Status:     ordermodel.OrderStatusPaid,
		SupplierID: 10,
		UserID:     1,
		ProductID:  1,
		Quantity:   1,
		UnitPrice:  100,
		TotalPrice: 100,
	})

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodGet, "/api/v1/supplier/orders/1", nil)
	c.Params = gin.Params{{Key: "id", Value: itoa(o.ID)}}
	c.Set("supplier_id", uint(10))
	h.GetOrder(c)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	body := decodeBody(t, w)
	data := body["data"].(map[string]any)
	if data["verification_code"] != o.VerificationCode {
		t.Fatalf("paid order must include verification_code, got %v", data["verification_code"])
	}
}
