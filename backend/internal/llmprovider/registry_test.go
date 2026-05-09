package llmprovider

import (
	"context"
	"reflect"
	"testing"
)

type stubProvider struct{ code string }

func (s *stubProvider) Code() string         { return s.code }
func (s *stubProvider) DefaultModel() string { return "stub" }
func (s *stubProvider) ChatStream(context.Context, Request, func(StreamEvent) bool) error {
	return nil
}
func (s *stubProvider) ChatJSON(context.Context, Request) (string, []ToolCall, error) {
	return "", nil, nil
}

func TestRegistry_GetUnknown(t *testing.T) {
	r := NewRegistry("x")
	if _, err := r.Get("nope"); err == nil {
		t.Fatal("want error for unknown code")
	}
}

func TestRegistry_RegisterGetDefault(t *testing.T) {
	r := NewRegistry("a")
	r.Register(&stubProvider{code: "a"})
	r.Register(&stubProvider{code: "b"})

	got, err := r.Get("a")
	if err != nil {
		t.Fatal(err)
	}
	if got.Code() != "a" {
		t.Fatalf("Code = %q", got.Code())
	}

	if r.Default().Code() != "a" {
		t.Fatalf("Default = %q, want a", r.Default().Code())
	}

	got, err = r.Get("b")
	if err != nil {
		t.Fatal(err)
	}
	if got.Code() != "b" {
		t.Fatalf("Code = %q", got.Code())
	}
}

func TestRegistry_DefaultMissing(t *testing.T) {
	r := NewRegistry("ghost")
	r.Register(&stubProvider{code: "real"})
	if r.Default() != nil {
		t.Fatal("Default should be nil when default code unregistered")
	}
	if r.DefaultCode() != "ghost" {
		t.Fatalf("DefaultCode = %q", r.DefaultCode())
	}
}

func TestRegistry_CodesSorted(t *testing.T) {
	r := NewRegistry("")
	r.Register(&stubProvider{code: "zeta"})
	r.Register(&stubProvider{code: "alpha"})
	r.Register(&stubProvider{code: "mu"})
	if got, want := r.Codes(), []string{"alpha", "mu", "zeta"}; !reflect.DeepEqual(got, want) {
		t.Fatalf("Codes = %v, want %v", got, want)
	}
}
