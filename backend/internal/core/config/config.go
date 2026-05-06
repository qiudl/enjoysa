package config

import (
	"fmt"
	"strings"

	"github.com/spf13/viper"
)

type Config struct {
	Server   ServerConfig   `mapstructure:"server"`
	Database DatabaseConfig `mapstructure:"database"`
	Redis    RedisConfig    `mapstructure:"redis"`
	Log      LogConfig      `mapstructure:"log"`
	JWT      JWTConfig      `mapstructure:"jwt"`
	Google   GoogleConfig   `mapstructure:"google"`
	Stripe   StripeConfig   `mapstructure:"stripe"`
	Upload   UploadConfig   `mapstructure:"upload"`
	Resend   ResendConfig   `mapstructure:"resend"`
	AI         AIConfig         `mapstructure:"ai"`
	AfterSales AfterSalesConfig `mapstructure:"aftersales"`
	Feishu     FeishuConfig     `mapstructure:"feishu"`
}

// FeishuConfig holds the platform-wide Feishu group bot webhook used by
// `chat/share`. When WebhookURL is empty the share endpoint returns 503.
type FeishuConfig struct {
	WebhookURL string `mapstructure:"webhook_url"`
}

type AfterSalesConfig struct {
	ServiceKey string `mapstructure:"service_key"`
}

type AIConfig struct {
	BaseURL      string            `mapstructure:"base_url"`
	APIKey       string            `mapstructure:"api_key"`
	Model        string            `mapstructure:"model"`
	GLMBaseURL   string            `mapstructure:"glm_base_url"` // https://open.bigmodel.cn/api/paas/v4
	GLMAPIKey    string            `mapstructure:"glm_api_key"`
	AIProjBase   string            `mapstructure:"aiproj_base"`
	AIProjToken  string            `mapstructure:"aiproj_token"`
	AIProjProjID int               `mapstructure:"aiproj_proj_id"`
	Dedup        AIChatDedupConfig `mapstructure:"dedup"`
}

// AIChatDedupConfig holds REQ-20260507-0002 cross-turn duplicate detection
// knobs for create_requirement. Defaults are applied in Load() so a missing
// `ai.dedup` yaml block is safe.
type AIChatDedupConfig struct {
	Enabled        bool    `mapstructure:"enabled"`
	TimeoutMs      int     `mapstructure:"timeout_ms"`
	WindowHours    int     `mapstructure:"window_hours"`
	MaxCandidates  int     `mapstructure:"max_candidates"`
	HitThreshold   float64 `mapstructure:"hit_threshold"`
	GrayThreshold  float64 `mapstructure:"gray_threshold"`
	CacheTTLSec    int     `mapstructure:"cache_ttl_sec"`
}

type ResendConfig struct {
	APIKey      string `mapstructure:"api_key"`
	FromAddress string `mapstructure:"from_address"`
}

type RedisConfig struct {
	Addr     string `mapstructure:"addr"`
	Password string `mapstructure:"password"`
	DB       int    `mapstructure:"db"`
}

type ServerConfig struct {
	Port        int    `mapstructure:"port"`
	Mode        string `mapstructure:"mode"`
	FrontendURL string `mapstructure:"frontend_url"`
}

type DatabaseConfig struct {
	Host         string `mapstructure:"host"`
	Port         int    `mapstructure:"port"`
	User         string `mapstructure:"user"`
	Password     string `mapstructure:"password"`
	DBName       string `mapstructure:"dbname"`
	SSLMode      string `mapstructure:"sslmode"`
	MaxIdleConns int    `mapstructure:"max_idle_conns"`
	MaxOpenConns int    `mapstructure:"max_open_conns"`
}

type LogConfig struct {
	Level  string `mapstructure:"level"`
	Format string `mapstructure:"format"`
}

type JWTConfig struct {
	Secret        string `mapstructure:"secret"`
	AccessExpire  int    `mapstructure:"access_expire"`
	RefreshExpire int    `mapstructure:"refresh_expire"`
}

type GoogleConfig struct {
	ClientID string `mapstructure:"client_id"`
}

type StripeConfig struct {
	SecretKey     string `mapstructure:"secret_key"`
	WebhookSecret string `mapstructure:"webhook_secret"`
}

type UploadConfig struct {
	Dir          string   `mapstructure:"dir"`
	MaxSize      int      `mapstructure:"max_size"`
	AllowedTypes []string `mapstructure:"allowed_types"`
}

func (d *DatabaseConfig) DSN() string {
	dsn := fmt.Sprintf("host=%s port=%d user=%s dbname=%s sslmode=%s",
		d.Host, d.Port, d.User, d.DBName, d.SSLMode)
	if d.Password != "" {
		dsn += fmt.Sprintf(" password=%s", d.Password)
	}
	return dsn
}

func Load(configPath string) (*Config, error) {
	v := viper.New()
	v.SetConfigFile(configPath)
	v.AutomaticEnv()
	v.SetEnvPrefix("ENJOYSA")
	v.SetEnvKeyReplacer(strings.NewReplacer(".", "_"))

	// REQ-20260507-0002 cross-turn dedup defaults. Tuned against the real
	// 0059/0060/0061 case (Jaccard ≈ 0.27 between R59↔R60, ≈ 0.08 between
	// R59↔R61): hit_threshold=0.25 catches the highest-similarity pair as a
	// hard match; gray_threshold=0.05 surfaces the looser pairs to the LLM
	// for a confirmation prompt. Unrelated titles score 0 and miss cleanly.
	v.SetDefault("ai.dedup.enabled", true)
	v.SetDefault("ai.dedup.timeout_ms", 1500)
	v.SetDefault("ai.dedup.window_hours", 24)
	v.SetDefault("ai.dedup.max_candidates", 10)
	v.SetDefault("ai.dedup.hit_threshold", 0.25)
	v.SetDefault("ai.dedup.gray_threshold", 0.05)
	v.SetDefault("ai.dedup.cache_ttl_sec", 60)

	// Bind environment variables to nested config keys
	_ = v.BindEnv("database.host", "ENJOYSA_DB_HOST")
	_ = v.BindEnv("database.password", "ENJOYSA_DB_PASSWORD")
	_ = v.BindEnv("jwt.secret", "ENJOYSA_JWT_SECRET")
	_ = v.BindEnv("stripe.secret_key", "ENJOYSA_STRIPE_SECRET")
	_ = v.BindEnv("stripe.webhook_secret", "ENJOYSA_STRIPE_WEBHOOK")
	_ = v.BindEnv("server.frontend_url", "ENJOYSA_FRONTEND_URL")
	_ = v.BindEnv("resend.api_key", "ENJOYSA_RESEND_API_KEY")
	_ = v.BindEnv("ai.base_url", "ENJOYSA_AI_BASE_URL")
	_ = v.BindEnv("ai.api_key", "ENJOYSA_AI_API_KEY")
	_ = v.BindEnv("ai.model", "ENJOYSA_AI_MODEL")
	_ = v.BindEnv("ai.glm_base_url", "ENJOYSA_AI_GLM_BASE_URL")
	_ = v.BindEnv("ai.glm_api_key", "ENJOYSA_AI_GLM_API_KEY")
	_ = v.BindEnv("ai.aiproj_base", "ENJOYSA_AI_AIPROJ_BASE")
	_ = v.BindEnv("ai.aiproj_token", "ENJOYSA_AI_AIPROJ_TOKEN")
	_ = v.BindEnv("ai.aiproj_proj_id", "ENJOYSA_AI_AIPROJ_PROJ_ID")
	_ = v.BindEnv("ai.dedup.enabled", "AICHAT_DEDUP_ENABLED")
	_ = v.BindEnv("ai.dedup.timeout_ms", "AICHAT_DEDUP_TIMEOUT_MS")
	_ = v.BindEnv("ai.dedup.window_hours", "AICHAT_DEDUP_WINDOW_HOURS")
	_ = v.BindEnv("ai.dedup.max_candidates", "AICHAT_DEDUP_MAX_CANDIDATES")
	_ = v.BindEnv("ai.dedup.hit_threshold", "AICHAT_DEDUP_HIT_THRESHOLD")
	_ = v.BindEnv("ai.dedup.gray_threshold", "AICHAT_DEDUP_GRAY_THRESHOLD")
	_ = v.BindEnv("ai.dedup.cache_ttl_sec", "AICHAT_DEDUP_CACHE_TTL_SEC")
	_ = v.BindEnv("aftersales.service_key", "ENJOYSA_AFTERSALES_KEY")
	_ = v.BindEnv("feishu.webhook_url", "ENJOYSA_FEISHU_WEBHOOK_URL")

	if err := v.ReadInConfig(); err != nil {
		return nil, fmt.Errorf("failed to read config: %w", err)
	}

	var cfg Config
	if err := v.Unmarshal(&cfg); err != nil {
		return nil, fmt.Errorf("failed to unmarshal config: %w", err)
	}

	return &cfg, nil
}
