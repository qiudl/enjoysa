package seed

import (
	"fmt"
	"math/rand"
	"time"

	"enjoysa-backend/internal/models"
)

func (s *Seeder) seedUsers() error {
	rng := rand.New(rand.NewSource(20260323))

	names := []string{
		"Alice Chen", "Bob Wang", "Charlie Li", "Diana Zhang", "Edward Liu",
		"Fiona Wu", "George Zhao", "Hannah Xu", "Ivan Sun", "Julia Huang",
		"Kevin Yang", "Laura Zhou", "Michael Lin", "Nancy He", "Oscar Zhu",
		"Penny Ma", "Quincy Guo", "Rachel Hu", "Sam Luo", "Tina Jiang",
		"张三", "李四", "王五", "赵六", "孙七",
		"周芳", "吴晓明", "陈丽华", "林建国", "黄小红",
		"Emily White", "Frank Brown", "Grace Kim", "Henry Park", "Iris Lee",
		"Jack Taylor", "Katie Moore", "Leo Martin", "Mia Thompson", "Noah Davis",
		"刘洋", "杨帆", "郑思远", "何婷婷", "曹宇轩",
		"许文博", "谢佳琪", "唐晓峰", "韩雨萱", "冯子轩",
	}

	phones := make([]string, 50)
	for i := 0; i < 50; i++ {
		phones[i] = fmt.Sprintf("+61 4%02d %03d %03d",
			rng.Intn(100), rng.Intn(1000), rng.Intn(1000))
	}

	now := time.Now()
	users := make([]models.User, 50)

	for i := 0; i < 50; i++ {
		var status string
		var emailVerified bool
		var lastLoginAt *time.Time

		switch {
		case i < 40:
			status = "active"
			emailVerified = true
			t := now.Add(-time.Duration(rng.Intn(30*24)) * time.Hour)
			lastLoginAt = &t
		case i < 45:
			status = "suspended"
			emailVerified = false
		default:
			status = "banned"
			emailVerified = false
		}

		var language string
		if i < 30 {
			language = "en"
		} else {
			language = "zh"
		}

		users[i] = models.User{
			Email:         fmt.Sprintf("user%d@test.com", i+1),
			Password:      UserPasswordHash,
			Name:          names[i],
			Phone:         phones[i],
			Status:        status,
			EmailVerified: emailVerified,
			Language:      language,
			Currency:      "AUD",
			LastLoginAt:   lastLoginAt,
		}
	}

	if err := s.db.CreateInBatches(users, 50).Error; err != nil {
		return fmt.Errorf("batch insert users: %w", err)
	}

	s.record("users", len(users))
	return nil
}
