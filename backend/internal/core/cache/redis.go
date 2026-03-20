package cache

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"enjoysa-backend/internal/core/config"
	"enjoysa-backend/internal/core/logger"

	"github.com/redis/go-redis/v9"
)

var rdb *redis.Client

// Init initializes the Redis client. If addr is empty, caching is disabled (noop).
func Init(cfg config.RedisConfig) {
	if cfg.Addr == "" {
		logger.Info("Redis not configured, permission caching disabled")
		return
	}

	rdb = redis.NewClient(&redis.Options{
		Addr:     cfg.Addr,
		Password: cfg.Password,
		DB:       cfg.DB,
	})

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	if err := rdb.Ping(ctx).Err(); err != nil {
		logger.Errorf("Redis connection failed: %v (caching disabled)", err)
		rdb = nil
		return
	}

	logger.Infof("Redis connected: %s", cfg.Addr)
}

// Close closes the Redis client.
func Close() {
	if rdb != nil {
		rdb.Close()
	}
}

const permissionTTL = 5 * time.Minute

func permKey(adminID uint) string {
	return fmt.Sprintf("rbac:admin:%d:permissions", adminID)
}

// GetPermissions returns cached permissions for an admin, or nil if not cached.
func GetPermissions(adminID uint) []string {
	if rdb == nil {
		return nil
	}

	ctx := context.Background()
	data, err := rdb.Get(ctx, permKey(adminID)).Bytes()
	if err != nil {
		return nil
	}

	var perms []string
	if err := json.Unmarshal(data, &perms); err != nil {
		return nil
	}
	return perms
}

// SetPermissions caches permissions for an admin.
func SetPermissions(adminID uint, perms []string) {
	if rdb == nil {
		return
	}

	data, err := json.Marshal(perms)
	if err != nil {
		return
	}

	ctx := context.Background()
	rdb.Set(ctx, permKey(adminID), data, permissionTTL)
}

// InvalidatePermissions removes cached permissions for an admin.
func InvalidatePermissions(adminID uint) {
	if rdb == nil {
		return
	}

	ctx := context.Background()
	rdb.Del(ctx, permKey(adminID))
}

// InvalidateAllPermissions removes all cached admin permissions (e.g., after role change).
func InvalidateAllPermissions() {
	if rdb == nil {
		return
	}

	ctx := context.Background()
	iter := rdb.Scan(ctx, 0, "rbac:admin:*:permissions", 100).Iterator()
	for iter.Next(ctx) {
		rdb.Del(ctx, iter.Val())
	}
}
