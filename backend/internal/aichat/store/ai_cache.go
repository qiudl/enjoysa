package store

import (
	"encoding/json"
	"time"

	"enjoysa-backend/internal/aichat/model"
	"gorm.io/gorm"
)

// AICacheStore manages AI result caching.
type AICacheStore struct {
	db *gorm.DB
}

func NewAICacheStore(db *gorm.DB) *AICacheStore {
	return &AICacheStore{db: db}
}

// Get retrieves a cached result. Returns nil if not found or expired.
func (s *AICacheStore) Get(key string, dest interface{}) error {
	var cache model.AICache
	err := s.db.Where("cache_key = ? AND expires_at > ?", key, time.Now()).First(&cache).Error
	if err != nil {
		return err
	}
	return json.Unmarshal([]byte(cache.Result), dest)
}

// Set stores a result in cache.
func (s *AICacheStore) Set(key, cacheType string, data interface{}, ttl time.Duration) error {
	jsonBytes, err := json.Marshal(data)
	if err != nil {
		return err
	}

	cache := model.AICache{
		CacheKey:  key,
		CacheType: cacheType,
		Result:    string(jsonBytes),
		ExpiresAt: time.Now().Add(ttl),
	}

	return s.db.Where("cache_key = ?", key).
		Assign(cache).
		FirstOrCreate(&cache).Error
}

// Invalidate removes a cached entry.
func (s *AICacheStore) Invalidate(key string) error {
	return s.db.Where("cache_key = ?", key).Delete(&model.AICache{}).Error
}

// CleanExpired removes all expired cache entries.
func (s *AICacheStore) CleanExpired() error {
	return s.db.Where("expires_at < ?", time.Now()).Delete(&model.AICache{}).Error
}

// SaveFaqFeedback records user feedback on AI FAQ answers.
func (s *AICacheStore) SaveFaqFeedback(productID uint, question, answer string, helpful bool) error {
	return s.db.Create(&model.AIFaqFeedback{
		ProductID: productID,
		Question:  question,
		Answer:    answer,
		Helpful:   &helpful,
	}).Error
}

// SaveMetric records an AI call metric.
func (s *AICacheStore) SaveMetric(scene string, latencyMs, tokensUsed int, success bool, errMsg string) error {
	return s.db.Create(&model.AIMetric{
		Scene:        scene,
		LatencyMs:    latencyMs,
		TokensUsed:   tokensUsed,
		Success:      success,
		ErrorMessage: errMsg,
	}).Error
}
