package handler

import "testing"

// REQ-20260506-0003: only persistence/write tools should be subject to the
// single-turn dedupe guard. Read tools must remain freely callable.
func TestIsAIChatWriteTool(t *testing.T) {
	cases := []struct {
		name string
		want bool
	}{
		{"create_requirement", true},
		{"upload_screenshot_requirement", true},
		{"list_requirements", false},
		{"search_knowledge", false},
		{"get_product_detail", false},
		{"recommend_products", false},
		{"", false},
	}
	for _, c := range cases {
		if got := isAIChatWriteTool(c.name); got != c.want {
			t.Errorf("isAIChatWriteTool(%q) = %v, want %v", c.name, got, c.want)
		}
	}
}
