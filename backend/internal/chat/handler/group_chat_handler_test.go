package handler

import (
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestResolveOwner_PriorityOrder(t *testing.T) {
	gin.SetMode(gin.TestMode)

	t.Run("supplier wins over user when both set", func(t *testing.T) {
		c, _ := gin.CreateTestContext(httptest.NewRecorder())
		c.Set("supplier_user_id", uint(7))
		c.Set("user_id", uint(99))
		o, ok := resolveOwner(c)
		if !ok {
			t.Fatal("expected ok")
		}
		if o.Type != "supplier" || o.ID != 7 {
			t.Fatalf("got %+v, want supplier/7", o)
		}
	})

	t.Run("admin wins over user when no supplier", func(t *testing.T) {
		c, _ := gin.CreateTestContext(httptest.NewRecorder())
		c.Set("admin_id", uint(3))
		c.Set("user_id", uint(99))
		o, ok := resolveOwner(c)
		if !ok || o.Type != "admin" || o.ID != 3 {
			t.Fatalf("got %+v ok=%v", o, ok)
		}
	})

	t.Run("user when only user_id set", func(t *testing.T) {
		c, _ := gin.CreateTestContext(httptest.NewRecorder())
		c.Set("user_id", uint(42))
		o, ok := resolveOwner(c)
		if !ok || o.Type != "user" || o.ID != 42 {
			t.Fatalf("got %+v ok=%v", o, ok)
		}
	})

	t.Run("guest returns ok=false", func(t *testing.T) {
		c, _ := gin.CreateTestContext(httptest.NewRecorder())
		_, ok := resolveOwner(c)
		if ok {
			t.Fatal("expected !ok for guest")
		}
	})

	t.Run("zero IDs ignored", func(t *testing.T) {
		c, _ := gin.CreateTestContext(httptest.NewRecorder())
		c.Set("supplier_user_id", uint(0))
		c.Set("user_id", uint(0))
		_, ok := resolveOwner(c)
		if ok {
			t.Fatal("expected !ok when all IDs are 0")
		}
	})
}

func TestMustParseUint(t *testing.T) {
	gin.SetMode(gin.TestMode)

	t.Run("valid", func(t *testing.T) {
		c, _ := gin.CreateTestContext(httptest.NewRecorder())
		c.Params = gin.Params{{Key: "id", Value: "42"}}
		got := mustParseUint(c, "id")
		if got != 42 {
			t.Fatalf("got %d", got)
		}
	})

	t.Run("zero rejected", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Params = gin.Params{{Key: "id", Value: "0"}}
		got := mustParseUint(c, "id")
		if got != 0 {
			t.Fatalf("expected 0 sentinel, got %d", got)
		}
		if w.Code != 400 {
			t.Fatalf("expected 400 written, got %d", w.Code)
		}
	})

	t.Run("non-numeric rejected", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Params = gin.Params{{Key: "id", Value: "abc"}}
		got := mustParseUint(c, "id")
		if got != 0 || w.Code != 400 {
			t.Fatalf("got=%d code=%d, want 0/400", got, w.Code)
		}
	})
}
