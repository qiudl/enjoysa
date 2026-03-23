package seed

import (
	"time"

	"enjoysa-backend/internal/models"
)

func (s *Seeder) seedSuppliers() error {
	approvedAt := time.Date(2025, 6, 15, 10, 0, 0, 0, time.UTC)
	approvedBy := uint(1)

	type supplierSeed struct {
		supplier models.Supplier
		userSlug string // used to generate admin@{slug}.com.au
	}

	seeds := []supplierSeed{
		{
			supplier: models.Supplier{
				Name:            "Kangaroo Island Odysseys",
				Type:            "travel_agency",
				Status:          "approved",
				Description:     "Kangaroo Island 顶级旅游运营商，提供小团精品游览服务，涵盖海豹湾、弗林德斯·蔡斯国家公园及岛上美食体验。| Premier Kangaroo Island tour operator offering small-group luxury experiences including Seal Bay, Flinders Chase National Park, and gourmet island cuisine.",
				Logo:            supplierLogo(0),
				Email:           "info@kiodysseys.com.au",
				Phone:           "+61 8 8553 0386",
				Website:         "https://www.kiodysseys.com.au",
				Address:         "43 Dauncey Street",
				City:            "Kingscote",
				State:           "SA",
				PostalCode:      "5223",
				Country:         "Australia",
				BusinessLicense: "BN98765432",
				TaxNumber:       "12345678901",
				BankName:        "NAB",
				BankAccount:     "0812345678",
				BankBSB:         "085-005",
				AccountHolder:   "Kangaroo Island Odysseys Pty Ltd",
				ApprovedAt:      &approvedAt,
				ApprovedBy:      &approvedBy,
				Rating:          4.8,
				ReviewCount:     186,
				AutoAccept:      true,
				NotifyEmail:     true,
			},
			userSlug: "kiodysseys",
		},
		{
			supplier: models.Supplier{
				Name:            "Barossa Wine Collective",
				Type:            "travel_agency",
				Status:          "approved",
				Description:     "芭罗莎谷精品酒庄联盟，提供定制葡萄酒之旅、品鉴课程和酒庄午餐体验。| Barossa Valley boutique wine alliance offering customised wine tours, tasting masterclasses, and winery lunch experiences.",
				Logo:            supplierLogo(1),
				Email:           "info@barossawine.com.au",
				Phone:           "+61 8 8563 0500",
				Website:         "https://www.barossawine.com.au",
				Address:         "66 Murray Street",
				City:            "Tanunda",
				State:           "SA",
				PostalCode:      "5352",
				Country:         "Australia",
				BusinessLicense: "BN98765433",
				TaxNumber:       "12345678902",
				BankName:        "CBA",
				BankAccount:     "0623456789",
				BankBSB:         "065-500",
				AccountHolder:   "Barossa Wine Collective Pty Ltd",
				ApprovedAt:      &approvedAt,
				ApprovedBy:      &approvedBy,
				Rating:          4.9,
				ReviewCount:     201,
				AutoAccept:      true,
				NotifyEmail:     true,
			},
			userSlug: "barossawine",
		},
		{
			supplier: models.Supplier{
				Name:            "Adelaide Hills Adventures",
				Type:            "travel_agency",
				Status:          "approved",
				Description:     "阿德莱德山户外探险专家，提供丛林徒步、山地自行车和自然摄影之旅。| Adelaide Hills outdoor adventure specialists, offering bush hiking, mountain biking, and nature photography tours.",
				Logo:            supplierLogo(2),
				Email:           "info@adhillsadv.com.au",
				Phone:           "+61 8 8388 1185",
				Website:         "https://www.adhillsadv.com.au",
				Address:         "35 Mount Barker Road",
				City:            "Stirling",
				State:           "SA",
				PostalCode:      "5152",
				Country:         "Australia",
				BusinessLicense: "BN98765434",
				TaxNumber:       "12345678903",
				BankName:        "ANZ",
				BankAccount:     "0134567890",
				BankBSB:         "015-010",
				AccountHolder:   "Adelaide Hills Adventures Pty Ltd",
				ApprovedAt:      &approvedAt,
				ApprovedBy:      &approvedBy,
				Rating:          4.6,
				ReviewCount:     95,
				AutoAccept:      false,
				NotifyEmail:     true,
			},
			userSlug: "adhillsadv",
		},
		{
			supplier: models.Supplier{
				Name:            "Flinders Outback Trails",
				Type:            "travel_agency",
				Status:          "approved",
				Description:     "弗林德斯山脉内陆探险运营商，提供四驱越野游、露营探险和原住民文化体验。| Flinders Ranges outback adventure operator offering 4WD tours, camping expeditions, and Aboriginal cultural experiences.",
				Logo:            supplierLogo(3),
				Email:           "info@flindersoutback.com.au",
				Phone:           "+61 8 8648 0048",
				Website:         "https://www.flindersoutback.com.au",
				Address:         "12 Elder Terrace",
				City:            "Hawker",
				State:           "SA",
				PostalCode:      "5434",
				Country:         "Australia",
				BusinessLicense: "BN98765435",
				TaxNumber:       "12345678904",
				BankName:        "NAB",
				BankAccount:     "0845678901",
				BankBSB:         "085-200",
				AccountHolder:   "Flinders Outback Trails Pty Ltd",
				ApprovedAt:      &approvedAt,
				ApprovedBy:      &approvedBy,
				Rating:          4.7,
				ReviewCount:     78,
				AutoAccept:      false,
				NotifyEmail:     true,
			},
			userSlug: "flindersoutback",
		},
		{
			supplier: models.Supplier{
				Name:            "Murray River Cruises",
				Type:            "travel_agency",
				Status:          "approved",
				Description:     "墨累河游船运营商，提供蒸汽船巡游、日落晚餐游船和多日河上之旅。| Murray River cruise operator offering paddle steamer cruises, sunset dinner cruises, and multi-day river voyages.",
				Logo:            supplierLogo(4),
				Email:           "info@murraycruises.com.au",
				Phone:           "+61 8 8541 2666",
				Website:         "https://www.murraycruises.com.au",
				Address:         "5 Randell Street",
				City:            "Mannum",
				State:           "SA",
				PostalCode:      "5238",
				Country:         "Australia",
				BusinessLicense: "BN98765436",
				TaxNumber:       "12345678905",
				BankName:        "CBA",
				BankAccount:     "0656789012",
				BankBSB:         "065-510",
				AccountHolder:   "Murray River Cruises Pty Ltd",
				ApprovedAt:      &approvedAt,
				ApprovedBy:      &approvedBy,
				Rating:          4.5,
				ReviewCount:     132,
				AutoAccept:      true,
				NotifyEmail:     true,
			},
			userSlug: "murraycruises",
		},
		{
			supplier: models.Supplier{
				Name:            "Majestic Adelaide Hotel",
				Type:            "hotel",
				Status:          "approved",
				Description:     "阿德莱德市中心五星级精品酒店，坐落于北台地文化区旁，提供豪华住宿、屋顶酒吧和会议设施。| Five-star boutique hotel in the Adelaide CBD, adjacent to the North Terrace cultural precinct, offering luxury accommodation, a rooftop bar, and conference facilities.",
				Logo:            supplierLogo(5),
				Email:           "info@majesticadelaide.com.au",
				Phone:           "+61 8 8100 4444",
				Website:         "https://www.majesticadelaide.com.au",
				Address:         "141 King William Street",
				City:            "Adelaide",
				State:           "SA",
				PostalCode:      "5000",
				Country:         "Australia",
				BusinessLicense: "BN98765437",
				TaxNumber:       "12345678906",
				BankName:        "ANZ",
				BankAccount:     "0167890123",
				BankBSB:         "015-210",
				AccountHolder:   "Majestic Adelaide Hotel Pty Ltd",
				ApprovedAt:      &approvedAt,
				ApprovedBy:      &approvedBy,
				Rating:          4.4,
				ReviewCount:     167,
				AutoAccept:      true,
				NotifyEmail:     true,
			},
			userSlug: "majesticadelaide",
		},
		{
			supplier: models.Supplier{
				Name:            "Limestone Coast Lodge",
				Type:            "hotel",
				Status:          "approved",
				Description:     "石灰岩海岸精品乡村度假屋，毗邻库纳瓦拉酒区和蓝湖，提供舒适住宿和地道农场早餐。| Boutique country lodge on the Limestone Coast, near Coonawarra wine region and Blue Lake, offering comfortable stays and authentic farm breakfasts.",
				Logo:            supplierLogo(6),
				Email:           "info@limestonecoast.com.au",
				Phone:           "+61 8 8725 5000",
				Website:         "https://www.limestonecoast.com.au",
				Address:         "28 Bay Road",
				City:            "Mount Gambier",
				State:           "SA",
				PostalCode:      "5290",
				Country:         "Australia",
				BusinessLicense: "BN98765438",
				TaxNumber:       "12345678907",
				BankName:        "NAB",
				BankAccount:     "0878901234",
				BankBSB:         "085-300",
				AccountHolder:   "Limestone Coast Lodge Pty Ltd",
				ApprovedAt:      &approvedAt,
				ApprovedBy:      &approvedBy,
				Rating:          4.3,
				ReviewCount:     89,
				AutoAccept:      false,
				NotifyEmail:     true,
			},
			userSlug: "limestonecoast",
		},
		{
			supplier: models.Supplier{
				Name:            "Cleland Wildlife Park",
				Type:            "attraction",
				Status:          "approved",
				Description:     "阿德莱德山著名野生动物园，游客可以与考拉、袋鼠和袋熊亲密互动，体验澳洲独特的野生动物世界。| Famous wildlife park in the Adelaide Hills where visitors can interact with koalas, kangaroos, and wombats—an authentic Australian wildlife experience.",
				Logo:            supplierLogo(7),
				Email:           "info@clelandwildlife.com.au",
				Phone:           "+61 8 8339 2444",
				Website:         "https://www.clelandwildlife.com.au",
				Address:         "365 Mount Lofty Summit Road",
				City:            "Crafers",
				State:           "SA",
				PostalCode:      "5152",
				Country:         "Australia",
				BusinessLicense: "BN98765439",
				TaxNumber:       "12345678908",
				BankName:        "CBA",
				BankAccount:     "0689012345",
				BankBSB:         "065-520",
				AccountHolder:   "Cleland Wildlife Park Pty Ltd",
				ApprovedAt:      &approvedAt,
				ApprovedBy:      &approvedBy,
				Rating:          4.7,
				ReviewCount:     198,
				AutoAccept:      true,
				NotifyEmail:     true,
			},
			userSlug: "clelandwildlife",
		},
		{
			supplier: models.Supplier{
				Name:            "Monarto Safari Park",
				Type:            "attraction",
				Status:          "pending",
				Description:     "南半球最大的开放式动物园，拥有非洲狮、长颈鹿和犀牛等异域动物，提供沉浸式野生动物体验。| The largest open-range zoo in the Southern Hemisphere, home to African lions, giraffes, and rhinos, offering immersive wildlife encounters.",
				Logo:            supplierLogo(8),
				Email:           "info@monartosafari.com.au",
				Phone:           "+61 8 8534 4100",
				Website:         "https://www.monartosafari.com.au",
				Address:         "Old Princes Highway",
				City:            "Monarto South",
				State:           "SA",
				PostalCode:      "5254",
				Country:         "Australia",
				BusinessLicense: "BN98765440",
				TaxNumber:       "12345678909",
				BankName:        "ANZ",
				BankAccount:     "0190123456",
				BankBSB:         "015-310",
				AccountHolder:   "Monarto Safari Park Pty Ltd",
				Rating:          3.8,
				ReviewCount:     45,
				AutoAccept:      false,
				NotifyEmail:     true,
			},
			userSlug: "monartosafari",
		},
		{
			supplier: models.Supplier{
				Name:            "SA Premium Rentals",
				Type:            "car_rental",
				Status:          "suspended",
				Description:     "南澳高端汽车租赁服务，提供SUV、房车和豪华轿车，适合自驾环游南澳。| South Australia premium car rental service offering SUVs, campervans, and luxury sedans for self-drive tours around SA.",
				Logo:            supplierLogo(9),
				Email:           "info@sapremium.com.au",
				Phone:           "+61 8 8234 5678",
				Website:         "https://www.sapremium.com.au",
				Address:         "198 Sir Donald Bradman Drive",
				City:            "Adelaide",
				State:           "SA",
				PostalCode:      "5000",
				Country:         "Australia",
				BusinessLicense: "BN98765441",
				TaxNumber:       "12345678910",
				BankName:        "NAB",
				BankAccount:     "0801234567",
				BankBSB:         "085-400",
				AccountHolder:   "SA Premium Rentals Pty Ltd",
				Rating:          3.5,
				ReviewCount:     12,
				AutoAccept:      false,
				NotifyEmail:     true,
			},
			userSlug: "sapremium",
		},
	}

	supplierCount := 0
	userCount := 0

	for i, ss := range seeds {
		sup := ss.supplier

		// Upsert supplier
		var existing models.Supplier
		result := s.db.Where("email = ?", sup.Email).First(&existing)
		if result.Error != nil {
			// Not found — create
			if err := s.db.Create(&sup).Error; err != nil {
				return err
			}
		} else {
			// Exists — update
			sup.ID = existing.ID
			if err := s.db.Model(&existing).Updates(map[string]interface{}{
				"name":             sup.Name,
				"type":             sup.Type,
				"status":           sup.Status,
				"description":      sup.Description,
				"logo":             sup.Logo,
				"phone":            sup.Phone,
				"website":          sup.Website,
				"address":          sup.Address,
				"city":             sup.City,
				"state":            sup.State,
				"postal_code":      sup.PostalCode,
				"country":          sup.Country,
				"business_license": sup.BusinessLicense,
				"tax_number":       sup.TaxNumber,
				"bank_name":        sup.BankName,
				"bank_account":     sup.BankAccount,
				"bank_bsb":         sup.BankBSB,
				"account_holder":   sup.AccountHolder,
				"approved_at":      sup.ApprovedAt,
				"approved_by":      sup.ApprovedBy,
				"rating":           sup.Rating,
				"review_count":     sup.ReviewCount,
				"auto_accept":      sup.AutoAccept,
				"notify_email":     sup.NotifyEmail,
			}).Error; err != nil {
				return err
			}
			sup.ID = existing.ID
		}
		supplierCount++

		// Determine supplier user status
		userStatus := "active"
		if sup.Status == "suspended" {
			userStatus = "suspended"
		}

		// Supplier admin user
		supplierUser := models.SupplierUser{
			SupplierID: sup.ID,
			Email:      "admin@" + ss.userSlug + ".com.au",
			Password:   SupplierPasswordHash,
			Name:       sup.Name + " Admin",
			Phone:      sup.Phone,
			Role:       "admin",
			Status:     userStatus,
		}

		var existingUser models.SupplierUser
		userResult := s.db.Where("email = ?", supplierUser.Email).First(&existingUser)
		if userResult.Error != nil {
			if err := s.db.Create(&supplierUser).Error; err != nil {
				return err
			}
		} else {
			if err := s.db.Model(&existingUser).Updates(map[string]interface{}{
				"supplier_id": supplierUser.SupplierID,
				"password":    supplierUser.Password,
				"name":        supplierUser.Name,
				"phone":       supplierUser.Phone,
				"role":        supplierUser.Role,
				"status":      supplierUser.Status,
			}).Error; err != nil {
				return err
			}
		}
		userCount++

		_ = i // index used by supplierLogo via seeds definition
	}

	s.record("suppliers", supplierCount)
	s.record("supplier_users", userCount)
	return nil
}
