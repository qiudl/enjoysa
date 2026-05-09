package llmprovider

import (
	"fmt"
	"sort"
	"sync"
)

// Registry maps provider codes to instances. Safe for concurrent reads
// after Register-time setup.
type Registry struct {
	mu          sync.RWMutex
	providers   map[string]Provider
	defaultCode string
}

func NewRegistry(defaultCode string) *Registry {
	return &Registry{
		providers:   make(map[string]Provider),
		defaultCode: defaultCode,
	}
}

func (r *Registry) Register(p Provider) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.providers[p.Code()] = p
}

// Get returns the provider for code, or an error if unknown.
func (r *Registry) Get(code string) (Provider, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	p, ok := r.providers[code]
	if !ok {
		return nil, fmt.Errorf("llmprovider: unknown code %q (registered: %v)", code, r.codesLocked())
	}
	return p, nil
}

// Default returns the provider configured as default at construction time.
// Returns nil if the default code is not registered.
func (r *Registry) Default() Provider {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.providers[r.defaultCode]
}

// DefaultCode is the configured default identifier (may not be registered yet).
func (r *Registry) DefaultCode() string {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.defaultCode
}

// Codes lists registered provider codes in stable sorted order.
func (r *Registry) Codes() []string {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.codesLocked()
}

func (r *Registry) codesLocked() []string {
	out := make([]string, 0, len(r.providers))
	for k := range r.providers {
		out = append(out, k)
	}
	sort.Strings(out)
	return out
}
