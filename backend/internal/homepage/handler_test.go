package homepage

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

func setupTestHandler(t *testing.T) (*Handler, *gorm.DB) {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(&HomepageModule{}); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	return NewHandler(db), db
}

func doJSON(h *Handler, method, path string, body interface{}, params gin.Params) *httptest.ResponseRecorder {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(w)
	ctx.Params = params

	var bodyReader *bytes.Buffer
	if body != nil {
		b, _ := json.Marshal(body)
		bodyReader = bytes.NewBuffer(b)
	} else {
		bodyReader = bytes.NewBuffer(nil)
	}
	req := httptest.NewRequest(method, path, bodyReader)
	req.Header.Set("Content-Type", "application/json")
	ctx.Request = req

	switch method {
	case http.MethodPost:
		h.CreateModule(ctx)
	case http.MethodDelete:
		h.DeleteModule(ctx)
	}
	return w
}

// isSafeURL unit tests — defense against XSS via cta_link
func TestIsSafeURL(t *testing.T) {
	cases := []struct {
		in   string
		want bool
	}{
		{"https://example.com/path", true},
		{"http://example.com", true},
		{"/products/123", true},
		{"", true},
		{"javascript:alert(1)", false},
		{"data:text/html,<script>", false},
		{"file:///etc/passwd", false},
		{"ftp://example.com", false},
		// crafted: starts with http:// but contains javascript: in middle
		// url.Parse extracts scheme correctly; not a string prefix match
		{"http://example.com/?next=javascript:alert(1)", true}, // scheme is http, query value is irrelevant for our scheme check
	}
	for _, c := range cases {
		if got := isSafeURL(c.in); got != c.want {
			t.Errorf("isSafeURL(%q) = %v, want %v", c.in, got, c.want)
		}
	}
}

func TestCreateModule_BlankKey_GeneratesCustomBlockPrefix(t *testing.T) {
	h, db := setupTestHandler(t)
	body := ModuleCreateRequest{TitleZh: "测试", TitleEn: "Test", Config: `{}`}
	w := doJSON(h, http.MethodPost, "/admin/homepage/modules", body, nil)
	if w.Code != http.StatusCreated {
		t.Fatalf("status = %d body=%s", w.Code, w.Body.String())
	}

	var saved HomepageModule
	if err := db.First(&saved).Error; err != nil {
		t.Fatalf("module not saved: %v", err)
	}
	if !strings.HasPrefix(saved.ModuleKey, CustomBlockKeyPrefix) {
		t.Errorf("key=%q, want prefix %q", saved.ModuleKey, CustomBlockKeyPrefix)
	}
	suffix := strings.TrimPrefix(saved.ModuleKey, CustomBlockKeyPrefix)
	if len(suffix) != 8 {
		t.Errorf("suffix len = %d, want 8 hex chars", len(suffix))
	}
}

func TestCreateModule_FixedKey_Rejected(t *testing.T) {
	h, _ := setupTestHandler(t)
	for _, k := range []string{"banner", "featured", "partners"} {
		body := ModuleCreateRequest{ModuleKey: k, TitleZh: "x", TitleEn: "x"}
		w := doJSON(h, http.MethodPost, "/admin/homepage/modules", body, nil)
		if w.Code != http.StatusBadRequest {
			t.Errorf("key=%s status=%d body=%s, want 400", k, w.Code, w.Body.String())
		}
	}
}

func TestCreateModule_NonPrefixKey_Rejected(t *testing.T) {
	h, _ := setupTestHandler(t)
	body := ModuleCreateRequest{ModuleKey: "random_key", TitleZh: "x", TitleEn: "x"}
	w := doJSON(h, http.MethodPost, "/admin/homepage/modules", body, nil)
	if w.Code != http.StatusBadRequest {
		t.Errorf("status=%d body=%s, want 400", w.Code, w.Body.String())
	}
}

func TestCreateModule_PrefixKey_Accepted(t *testing.T) {
	h, _ := setupTestHandler(t)
	body := ModuleCreateRequest{ModuleKey: "custom_block_abc12345", TitleZh: "x", TitleEn: "x"}
	w := doJSON(h, http.MethodPost, "/admin/homepage/modules", body, nil)
	if w.Code != http.StatusCreated {
		t.Errorf("status=%d body=%s, want 201", w.Code, w.Body.String())
	}
}

func TestCreateModule_BadCtaLink_Rejected(t *testing.T) {
	h, _ := setupTestHandler(t)
	for _, scheme := range []string{"javascript:alert(1)", "data:text/html,<script>", "file:///etc/passwd"} {
		cfg, _ := json.Marshal(map[string]string{"cta_link": scheme})
		body := ModuleCreateRequest{TitleZh: "x", TitleEn: "x", Config: string(cfg)}
		w := doJSON(h, http.MethodPost, "/admin/homepage/modules", body, nil)
		if w.Code != http.StatusBadRequest {
			t.Errorf("cta=%s status=%d, want 400", scheme, w.Code)
		}
	}
}

func TestCreateModule_BadImageUrl_Rejected(t *testing.T) {
	h, _ := setupTestHandler(t)
	for _, scheme := range []string{"javascript:void(0)", "data:image/svg+xml;base64,PHN2Zz4=", "file:///etc/passwd"} {
		cfg, _ := json.Marshal(map[string]string{"image_url": scheme})
		body := ModuleCreateRequest{TitleZh: "x", TitleEn: "x", Config: string(cfg)}
		w := doJSON(h, http.MethodPost, "/admin/homepage/modules", body, nil)
		if w.Code != http.StatusBadRequest {
			t.Errorf("image=%s status=%d, want 400", scheme, w.Code)
		}
	}
}

func TestCreateModule_GoodCtaLink_Accepted(t *testing.T) {
	h, _ := setupTestHandler(t)
	for _, link := range []string{"https://example.com/x", "http://a.test/y", "/products/123"} {
		cfg, _ := json.Marshal(map[string]string{"cta_link": link})
		body := ModuleCreateRequest{TitleZh: "x", TitleEn: "x", Config: string(cfg)}
		w := doJSON(h, http.MethodPost, "/admin/homepage/modules", body, nil)
		if w.Code != http.StatusCreated {
			t.Errorf("link=%s status=%d body=%s, want 201", link, w.Code, w.Body.String())
		}
	}
}

func TestCreateModule_MissingTitle_Rejected(t *testing.T) {
	h, _ := setupTestHandler(t)
	body := ModuleCreateRequest{TitleZh: "only zh"}
	w := doJSON(h, http.MethodPost, "/admin/homepage/modules", body, nil)
	if w.Code != http.StatusBadRequest {
		t.Errorf("status=%d, want 400 (title_en required)", w.Code)
	}
}

func TestDeleteModule_NonCustomBlock_Rejected(t *testing.T) {
	h, _ := setupTestHandler(t)
	w := doJSON(h, http.MethodDelete, "/admin/homepage/modules/banner", nil,
		gin.Params{{Key: "key", Value: "banner"}})
	if w.Code != http.StatusBadRequest {
		t.Errorf("status=%d, want 400 (fixed module not deletable)", w.Code)
	}
}

func TestDeleteModule_CustomBlock_Success(t *testing.T) {
	h, db := setupTestHandler(t)
	key := "custom_block_deadbeef"
	db.Create(&HomepageModule{ModuleKey: key, TitleZh: "x", TitleEn: "x", Config: datatypes.JSON([]byte("{}"))})

	w := doJSON(h, http.MethodDelete, "/admin/homepage/modules/"+key, nil,
		gin.Params{{Key: "key", Value: key}})
	if w.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s, want 200", w.Code, w.Body.String())
	}
	var count int64
	db.Model(&HomepageModule{}).Where("module_key = ?", key).Count(&count)
	if count != 0 {
		t.Errorf("row still exists after delete")
	}
}

func TestDeleteModule_NotFound(t *testing.T) {
	h, _ := setupTestHandler(t)
	w := doJSON(h, http.MethodDelete, "/admin/homepage/modules/custom_block_00000000", nil,
		gin.Params{{Key: "key", Value: "custom_block_00000000"}})
	if w.Code != http.StatusNotFound {
		t.Errorf("status=%d, want 404", w.Code)
	}
}
