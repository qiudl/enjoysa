package geo

import (
	"net"
	"testing"
)

// REQ-20260506-0006: GeoIP-based region detection. The xdb data is embedded
// at build time so these tests exercise the real lookup logic against real
// IP ranges rather than mocking.

func TestServiceLookup_NoOpWhenSearcherMissing(t *testing.T) {
	// Zero-value Service has a nil searcher; Lookup must not panic and
	// must return a "treat as unknown / not blocked" zero Result.
	svc := &Service{}
	got := svc.Lookup("8.8.8.8")
	if got.Country != "" || got.GoogleDisabled {
		t.Errorf("expected zero Result for nil searcher, got %+v", got)
	}
}

func TestServiceLookup_PrivateAndLoopbackIgnored(t *testing.T) {
	svc, err := NewService()
	if err != nil {
		t.Fatalf("NewService: %v", err)
	}
	cases := []string{"127.0.0.1", "10.0.0.5", "192.168.1.1", "172.16.0.1", "169.254.1.1"}
	for _, ip := range cases {
		got := svc.Lookup(ip)
		if got.GoogleDisabled || got.Country != "" {
			t.Errorf("private IP %s should be treated as unknown, got %+v", ip, got)
		}
	}
}

func TestServiceLookup_InvalidInput(t *testing.T) {
	svc, err := NewService()
	if err != nil {
		t.Fatalf("NewService: %v", err)
	}
	for _, ip := range []string{"", "not-an-ip", "999.999.999.999", "::1"} {
		got := svc.Lookup(ip)
		if got.GoogleDisabled || got.Country != "" {
			t.Errorf("invalid input %q should be unknown, got %+v", ip, got)
		}
	}
}

func TestServiceLookup_ChinaMainlandBlocked(t *testing.T) {
	svc, err := NewService()
	if err != nil {
		t.Fatalf("NewService: %v", err)
	}
	// China Telecom backbone — stable mainland CN block.
	for _, ip := range []string{"114.114.114.114", "223.5.5.5", "1.2.4.8"} {
		got := svc.Lookup(ip)
		if got.Country != "CN" {
			t.Errorf("expected country=CN for %s, got %q (full=%+v)", ip, got.Country, got)
		}
		if !got.GoogleDisabled {
			t.Errorf("expected google_disabled=true for mainland CN IP %s, got false", ip)
		}
	}
}

func TestServiceLookup_HongKongNotBlocked(t *testing.T) {
	svc, err := NewService()
	if err != nil {
		t.Fatalf("NewService: %v", err)
	}
	// Hong Kong block (Asia Netcom / HKT) — Google services available there.
	got := svc.Lookup("203.198.0.1")
	if got.GoogleDisabled {
		t.Errorf("Hong Kong IP should NOT have google_disabled=true, got %+v", got)
	}
}

func TestServiceLookup_OverseasNotBlocked(t *testing.T) {
	svc, err := NewService()
	if err != nil {
		t.Fatalf("NewService: %v", err)
	}
	cases := map[string]string{
		"8.8.8.8":   "US", // Google DNS, US
		"1.1.1.1":   "AU", // Cloudflare DNS, anycast — usually resolves to AU/US
		"203.0.0.1": "AU", // APNIC AU range
	}
	for ip, expectedCode := range cases {
		got := svc.Lookup(ip)
		if got.GoogleDisabled {
			t.Errorf("overseas IP %s (%s expected) should not be blocked, got %+v", ip, expectedCode, got)
		}
	}
}

func TestIsPrivateOrLoopback(t *testing.T) {
	cases := []struct {
		ip   string
		want bool
	}{
		{"10.0.0.1", true},
		{"172.16.0.1", true},
		{"172.31.255.254", true},
		{"172.32.0.0", false}, // out of 172.16-31 range
		{"192.168.1.1", true},
		{"127.0.0.1", true},
		{"169.254.1.1", true},
		{"8.8.8.8", false},
		{"114.114.114.114", false},
	}
	for _, c := range cases {
		got := isPrivateOrLoopback(net.ParseIP(c.ip))
		if got != c.want {
			t.Errorf("isPrivateOrLoopback(%s) = %v, want %v", c.ip, got, c.want)
		}
	}
}

func TestMapCountryCode(t *testing.T) {
	cases := []struct {
		country, sub, want string
	}{
		{"中国", "0", "CN"},
		{"中国", "江苏省", "CN"},
		{"中国", "香港", "HK"},
		{"中国", "香港特别行政区", "HK"},
		{"中国", "澳门", "MO"},
		{"中国", "澳门特别行政区", "MO"},
		{"中国", "台湾", "TW"},
		{"中国", "台湾省", "TW"},
		{"美国", "0", "US"},
		{"日本", "0", "JP"},
		{"澳大利亚", "0", "AU"},
		{"未知国家", "0", "未知国家"}, // pass-through
	}
	for _, c := range cases {
		got := mapCountryCode(c.country, c.sub)
		if got != c.want {
			t.Errorf("mapCountryCode(%q, %q) = %q, want %q", c.country, c.sub, got, c.want)
		}
	}
}
