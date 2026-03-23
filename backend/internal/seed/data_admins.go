package seed

import (
	authmodel "enjoysa-backend/internal/auth/model"
)

func (s *Seeder) seedAdmins() error {
	admins := []authmodel.Admin{
		{
			Email:    "admin@enjoysa.com.au",
			Password: AdminPasswordHash,
			Name:     "Super Admin",
			Role:     "super_admin",
			Status:   "active",
		},
		{
			Email:    "manager@enjoysa.com.au",
			Password: AdminPasswordHash,
			Name:     "Platform Manager",
			Role:     "admin",
			Status:   "active",
		},
	}

	count := 0
	for _, a := range admins {
		result := s.db.Where("email = ?", a.Email).FirstOrCreate(&a)
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected > 0 {
			count++
		} else {
			// Record exists — update fields
			if err := s.db.Model(&authmodel.Admin{}).Where("email = ?", a.Email).Updates(map[string]interface{}{
				"password": a.Password,
				"name":     a.Name,
				"role":     a.Role,
				"status":   a.Status,
			}).Error; err != nil {
				return err
			}
			count++
		}
	}

	s.record("admins", count)
	return nil
}
