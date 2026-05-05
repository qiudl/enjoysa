// Package geo resolves a request IP to a country / region for client-side
// region-aware behavior (e.g. hiding Google login in mainland China where
// Google services are unreachable).
package geo

import (
	_ "embed"
	"net"
	"strings"
	"sync"

	"github.com/lionsoul2014/ip2region/binding/golang/xdb"
)

//go:embed data/ip2region_v4.xdb
var xdbBytes []byte

// Service wraps an ip2region searcher. It is safe for concurrent use.
type Service struct {
	searcher *xdb.Searcher
	mu       sync.RWMutex
}

// NewService builds a Service from the embedded ip2region xdb. If the embed
// is empty (e.g. missing during a partial build) the service is still usable
// — Lookup returns a zero Result so callers fall through gracefully.
func NewService() (*Service, error) {
	if len(xdbBytes) == 0 {
		return &Service{}, nil
	}
	s, err := xdb.NewWithBuffer(xdb.IPv4, xdbBytes)
	if err != nil {
		return nil, err
	}
	return &Service{searcher: s}, nil
}

// Result is the JSON payload returned by /api/v1/geo. country uses ISO 3166-1
// alpha-2 codes ("CN", "HK", "AU"). google_disabled is the only field the
// frontend strictly relies on; the rest are informational.
type Result struct {
	Country         string `json:"country"`
	Region          string `json:"region"`
	IsBlockedRegion bool   `json:"is_blocked_region"`
	GoogleDisabled  bool   `json:"google_disabled"`
}

// Lookup returns region info for a given IP. Private/loopback IPs and
// invalid input return a zero Result (treated as "unknown / not blocked").
func (s *Service) Lookup(ipStr string) Result {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if s.searcher == nil {
		return Result{}
	}

	parsed := net.ParseIP(ipStr)
	if parsed == nil {
		return Result{}
	}
	// xdb v4 only knows about IPv4 — IPv6 falls through to "unknown".
	if parsed.To4() == nil {
		return Result{}
	}
	if isPrivateOrLoopback(parsed) {
		return Result{}
	}

	region, err := s.searcher.Search(ipStr)
	if err != nil || region == "" {
		return Result{}
	}

	parts := strings.Split(region, "|")
	country := ""
	sub := ""
	if len(parts) > 0 {
		country = parts[0]
	}
	if len(parts) > 1 {
		sub = parts[1]
	}

	code := mapCountryCode(country, sub)
	// Only mainland CN gets google_disabled; HK/MO/TW have unrestricted
	// access to Google services so they keep the normal flow.
	disabled := code == "CN"

	return Result{
		Country:         code,
		Region:          sub,
		IsBlockedRegion: disabled,
		GoogleDisabled:  disabled,
	}
}

// isPrivateOrLoopback covers RFC1918 + loopback + link-local. Used to skip
// dev / internal-network requests so they don't get classified as a region.
func isPrivateOrLoopback(ip net.IP) bool {
	if ip4 := ip.To4(); ip4 != nil {
		switch {
		case ip4[0] == 10:
			return true
		case ip4[0] == 172 && ip4[1] >= 16 && ip4[1] <= 31:
			return true
		case ip4[0] == 192 && ip4[1] == 168:
			return true
		case ip4[0] == 127:
			return true
		case ip4[0] == 169 && ip4[1] == 254:
			return true
		}
	}
	return false
}

// mapCountryCode maps the Chinese country/region name returned by ip2region
// to an ISO 3166-1 alpha-2 code. Only the codes the frontend needs to act
// on (CN vs anything-not-CN) matter, so we keep the table short and pass
// through unknown countries verbatim — clients that care can read .Country
// directly.
func mapCountryCode(country, sub string) string {
	if country == "中国" {
		// Sub-region strings vary across xdb versions: "香港",
		// "香港特别行政区", "澳门", "澳门特别行政区", "台湾", "台湾省" — match
		// by prefix to be tolerant.
		switch {
		case strings.HasPrefix(sub, "香港"):
			return "HK"
		case strings.HasPrefix(sub, "澳门"):
			return "MO"
		case strings.HasPrefix(sub, "台湾"):
			return "TW"
		default:
			return "CN"
		}
	}
	switch country {
	case "美国":
		return "US"
	case "日本":
		return "JP"
	case "韩国":
		return "KR"
	case "新加坡":
		return "SG"
	case "马来西亚":
		return "MY"
	case "澳大利亚":
		return "AU"
	case "新西兰":
		return "NZ"
	case "英国":
		return "GB"
	case "加拿大":
		return "CA"
	}
	// Pass through the raw string (typically Chinese name) for anything we
	// don't recognize — the frontend only needs CN-vs-other to decide.
	return country
}
