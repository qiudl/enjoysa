package store

import (
	"enjoysa-backend/internal/settings/model"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type SettingsStore struct {
	db *gorm.DB
}

func NewSettingsStore(db *gorm.DB) *SettingsStore {
	return &SettingsStore{db: db}
}

func (s *SettingsStore) GetAll() ([]model.Setting, error) {
	var settings []model.Setting
	err := s.db.Order("\"group\", key").Find(&settings).Error
	return settings, err
}

func (s *SettingsStore) GetByGroup(group string) ([]model.Setting, error) {
	var settings []model.Setting
	err := s.db.Where("\"group\" = ?", group).Order("key").Find(&settings).Error
	return settings, err
}

func (s *SettingsStore) Get(key string) (*model.Setting, error) {
	var setting model.Setting
	err := s.db.Where("key = ?", key).First(&setting).Error
	return &setting, err
}

func (s *SettingsStore) Set(key, value, group string) error {
	setting := model.Setting{
		Key:   key,
		Value: value,
		Group: group,
	}
	return s.db.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "key"}},
		DoUpdates: clause.AssignmentColumns([]string{"value", "group", "updated_at"}),
	}).Create(&setting).Error
}

func (s *SettingsStore) BatchSet(settings map[string]string, group string) error {
	return s.db.Transaction(func(tx *gorm.DB) error {
		store := &SettingsStore{db: tx}
		for k, v := range settings {
			if err := store.Set(k, v, group); err != nil {
				return err
			}
		}
		return nil
	})
}
