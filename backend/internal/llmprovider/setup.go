package llmprovider

import (
	"enjoysa-backend/internal/core/config"
	"enjoysa-backend/internal/core/logger"
)

// SetupRegistry builds a Registry from AIConfig, registering whichever
// providers are usably configured. DeepSeek is the default provider.
//
// REQ-20260509-0037 dev-1: callers (chat handler, aichat setup) will
// gradually adopt this registry instead of newing up clients directly.
func SetupRegistry(cfg config.AIConfig) *Registry {
	r := NewRegistry(DeepSeekCode)

	if cfg.BaseURL != "" && cfg.APIKey != "" {
		r.Register(NewDeepSeekProvider(cfg.BaseURL, cfg.APIKey, cfg.Model))
		logger.Infof("[llmprovider] registered deepseek (model=%s)", cfg.Model)
	} else {
		logger.Warnf("[llmprovider] deepseek skipped: ai.base_url or ai.api_key empty")
	}

	if cfg.GLMBaseURL != "" && cfg.GLMAPIKey != "" {
		r.Register(NewGLMProvider(cfg.GLMBaseURL, cfg.GLMAPIKey, cfg.GLMModel))
		logger.Infof("[llmprovider] registered glm (model=%s)", firstNonEmpty(cfg.GLMModel, DefaultGLMModel))
	} else {
		logger.Warnf("[llmprovider] glm skipped: ai.glm_base_url or ai.glm_api_key empty")
	}

	return r
}

func firstNonEmpty(a, b string) string {
	if a != "" {
		return a
	}
	return b
}
