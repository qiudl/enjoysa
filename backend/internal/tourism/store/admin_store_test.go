package store

import (
	"errors"
	"testing"
)

// REQ-20260510-0002 · 1C · admin_store_test.go
//
// Coverage focuses on the bits that don't need a real DB:
//   - pageOffset clamps page/pageSize within [1, maxPageSize] so a 1B
//     pageSize=10000 doesn't blow up the query
//   - isUniqueViolation matches the three error-string shapes we'll see
//     across pq, pgx, and sqlite (sqlite is for tests only but worth
//     covering so the matcher stays driver-agnostic)

func TestPageOffset_ClampsToDefaults(t *testing.T) {
	cases := []struct {
		name              string
		page, pageSize    int
		wantOffset        int
		wantSize          int
	}{
		{"defaults from zero", 0, 0, 0, defaultPageSize},
		{"defaults from negative", -1, -10, 0, defaultPageSize},
		{"caps oversized pageSize", 1, 9999, 0, maxPageSize},
		{"normal", 3, 25, 50, 25},
		{"page=1 first row", 1, 10, 0, 10},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			off, size := pageOffset(tc.page, tc.pageSize)
			if off != tc.wantOffset || size != tc.wantSize {
				t.Errorf("pageOffset(%d,%d) = (%d,%d), want (%d,%d)",
					tc.page, tc.pageSize, off, size, tc.wantOffset, tc.wantSize)
			}
		})
	}
}

func TestIsUniqueViolation(t *testing.T) {
	cases := []struct {
		name string
		err  error
		want bool
	}{
		{"pq verbatim", errors.New(`pq: duplicate key value violates unique constraint "uq_pricing_benchmarks_dim"`), true},
		{"pgx with sqlstate", errors.New("ERROR (23505): duplicate key value"), true},
		{"sqlite phrasing", errors.New("UNIQUE constraint failed: tourism_pricing_benchmarks.category"), true},
		{"case-insensitive", errors.New("DUPLICATE KEY VALUE"), true},
		{"unrelated", errors.New("connection refused"), false},
		{"nil", nil, false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := isUniqueViolation(tc.err); got != tc.want {
				t.Errorf("got %v want %v", got, tc.want)
			}
		})
	}
}

func TestContainsFold(t *testing.T) {
	cases := []struct {
		s, sub string
		want   bool
	}{
		{"Hello World", "world", true},
		{"hello world", "WORLD", true},
		{"hello", "helloworld", false},
		{"abcdef", "cde", true},
		{"", "x", false},
		{"x", "", true},
	}
	for _, tc := range cases {
		if got := containsFold(tc.s, tc.sub); got != tc.want {
			t.Errorf("containsFold(%q,%q)=%v want %v", tc.s, tc.sub, got, tc.want)
		}
	}
}
