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

	// Bind environment variables to nested config keys
	_ = v.BindEnv("database.host", "ENJOYSA_DB_HOST")
	_ = v.BindEnv("database.password", "ENJOYSA_DB_PASSWORD")
	_ = v.BindEnv("jwt.secret", "ENJOYSA_JWT_SECRET")
	_ = v.BindEnv("stripe.secret_key", "ENJOYSA_STRIPE_SECRET")
	_ = v.BindEnv("stripe.webhook_secret", "ENJOYSA_STRIPE_WEBHOOK")
	_ = v.BindEnv("server.frontend_url", "ENJOYSA_FRONTEND_URL")

	if err := v.ReadInConfig(); err != nil {
		return nil, fmt.Errorf("failed to read config: %w", err)
	}

	var cfg Config
	if err := v.Unmarshal(&cfg); err != nil {
		return nil, fmt.Errorf("failed to unmarshal config: %w", err)
	}

	return &cfg, nil
}
