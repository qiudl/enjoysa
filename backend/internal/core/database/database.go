package database

import (
	"fmt"
	"time"

	"enjoysa-backend/internal/core/config"
	"enjoysa-backend/internal/core/logger"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	gormlogger "gorm.io/gorm/logger"
)

func Init(cfg config.DatabaseConfig) (*gorm.DB, error) {
	db, err := gorm.Open(postgres.Open(cfg.DSN()), &gorm.Config{
		Logger: gormlogger.Default.LogMode(gormlogger.Info),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}

	sqlDB, err := db.DB()
	if err != nil {
		return nil, fmt.Errorf("failed to get sql.DB: %w", err)
	}

	maxIdle := cfg.MaxIdleConns
	if maxIdle == 0 {
		maxIdle = 10
	}
	maxOpen := cfg.MaxOpenConns
	if maxOpen == 0 {
		maxOpen = 100
	}

	sqlDB.SetMaxIdleConns(maxIdle)
	sqlDB.SetMaxOpenConns(maxOpen)
	sqlDB.SetConnMaxLifetime(time.Hour)

	logger.Info("Database connected successfully")
	return db, nil
}
