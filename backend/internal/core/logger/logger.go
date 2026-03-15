package logger

import (
	"enjoysa-backend/internal/core/config"

	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

var log *zap.SugaredLogger

func Init(cfg config.LogConfig) error {
	var zapCfg zap.Config
	if cfg.Format == "json" {
		zapCfg = zap.NewProductionConfig()
	} else {
		zapCfg = zap.NewDevelopmentConfig()
		zapCfg.EncoderConfig.EncodeLevel = zapcore.CapitalColorLevelEncoder
	}

	switch cfg.Level {
	case "debug":
		zapCfg.Level = zap.NewAtomicLevelAt(zap.DebugLevel)
	case "info":
		zapCfg.Level = zap.NewAtomicLevelAt(zap.InfoLevel)
	case "warn":
		zapCfg.Level = zap.NewAtomicLevelAt(zap.WarnLevel)
	case "error":
		zapCfg.Level = zap.NewAtomicLevelAt(zap.ErrorLevel)
	}

	l, err := zapCfg.Build(zap.AddCallerSkip(1))
	if err != nil {
		return err
	}
	log = l.Sugar()
	return nil
}

func Sync() {
	if log != nil {
		_ = log.Sync()
	}
}

func Debug(args ...interface{}) { log.Debug(args...) }
func Info(args ...interface{})  { log.Info(args...) }
func Warn(args ...interface{})  { log.Warn(args...) }
func Error(args ...interface{}) { log.Error(args...) }
func Fatal(args ...interface{}) { log.Fatal(args...) }

func Debugf(template string, args ...interface{}) { log.Debugf(template, args...) }
func Infof(template string, args ...interface{})  { log.Infof(template, args...) }
func Warnf(template string, args ...interface{})  { log.Warnf(template, args...) }
func Errorf(template string, args ...interface{}) { log.Errorf(template, args...) }
func Fatalf(template string, args ...interface{}) { log.Fatalf(template, args...) }
