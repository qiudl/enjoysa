package main

import (
	"flag"
	"fmt"
	"log"
	"strings"

	"enjoysa-backend/internal/core/config"
	"enjoysa-backend/internal/core/database"
	"enjoysa-backend/internal/product/model"

	"gorm.io/gorm"
)

type notice struct {
	Zh string
	En string
}

var exact = map[uint]notice{
	3:   {Zh: "请于开航前至少 30 分钟抵达 Glenelg 的 Holdfast Shores 码头；游泳者须年满 9 岁，2 岁及以下观光乘客免费。\n请携带毛巾、防晒霜、帽子和相机；潜水装备及防寒衣由船方提供。\n行程须至少 6 位客人成团，船上最多 50 人、游泳者最多 25 人；船型可能调整，野生海豚活动受自然条件影响。\n5 人及以下的预订须在出发 24 小时前取消；6 人及以上团体在出发前 7 天至 24 小时内取消，每人收取 AUD 50。", En: "Arrive at Holdfast Shores Marina in Glenelg at least 30 minutes before departure. Swimmers must be 9 or older; sightseeing infants aged 2 or under travel free.\nBring a towel, sunscreen, hat and camera. Snorkelling equipment and wetsuits are supplied.\nA minimum of 6 guests is required. Capacity is 50 passengers, with up to 25 swimmers. The vessel may change and wild-dolphin activity depends on natural conditions.\nBookings for up to 5 guests must be cancelled at least 24 hours before departure. For groups of 6 or more, cancellation 7 days to 24 hours before departure attracts a AUD 50 per-person fee."},
	10:  {Zh: "请于出发前 30 分钟抵达 Penneshaw, 43 Howard Drive 的 Kangaroo Island Information Stop。\n下水参加者须年满 9 岁并具备合理的开放水域游泳能力；孕妇及佩戴心脏起搏器者不适合参加。船只不支持轮椅登船。\n防寒衣、面镜、呼吸管与脚蹼由供应商提供；请携带饮用水、帽子及保暖外套。水温通常约 14–15°C。\n海豚与海豹均为野生动物，互动与数量无法保证；一旦参加下水或沿岸浮潜，不因未见到指定动物而退款。", En: "Arrive 30 minutes before departure at the Kangaroo Island Information Stop, 43 Howard Drive, Penneshaw.\nSwimmers must be at least 9 years old and confident in open water. The activity is unsuitable during pregnancy or for guests with a pacemaker, and the vessel is not wheelchair accessible.\nWetsuits, mask, snorkel and fins are provided. Bring water, a hat and a warm jacket; water is commonly around 14–15°C.\nDolphins and seals are wild, so sightings and interactions cannot be guaranteed. Once a guest enters the water for swimming or coastal snorkelling, no refund applies solely because the target wildlife was not encountered."},
	119: {Zh: "请按订单确认的时间抵达 Port Adelaide 的 1 McLaren Wharf，并出示电子或打印凭证。\n请穿着适合当天海上天气的衣物；船上设洗手间并可购买零食与饮品，禁止自带外食。\n海豚是野生动物，不能保证每次航程均可见；轮椅通道须预先向船方申请，优惠票乘客登船前须出示有效证件。\n如需更改，请至少在体验开始前 48 小时办理；48 小时内不可更改，迟到或未到可能视为自动放弃。", En: "Arrive at 1 McLaren Wharf, Port Adelaide at the time shown on your confirmation and present a mobile or printed voucher.\nWear clothing suitable for the day’s marine weather. Restrooms, snacks and drinks are available on board; outside food is not permitted.\nDolphins are wild and sightings cannot be guaranteed. Wheelchair access must be requested in advance, and concession guests need valid identification before boarding.\nChanges must be made at least 48 hours before the experience. Changes inside 48 hours are not permitted, and late arrival or no-show may forfeit the booking."},
	110: {Zh: "本行程时间较长，请严格按确认单上的接送或渡轮报到时间到达；旺季渡轮与巴士座位有限，建议尽早预订。\n请穿适合步行的鞋并携带防晒、防风衣物、饮用水及个人药物；部分国家公园路段地面不平。\n行程顺序、渡轮班次和停靠点可能因天气、道路、国家公园管理或运营安排调整。\n最终集合点、包含餐食、儿童政策和取消条款以付款前的订单确认页及 SeaLink 通知为准。", En: "This is a long touring day. Arrive strictly at the pickup or ferry check-in time on the confirmation; ferry and coach seats can be limited in peak periods, so early booking is recommended.\nWear walking shoes and carry sun protection, a windproof layer, water and personal medication. Some national-park surfaces are uneven.\nThe sequence, ferry service and stops may change with weather, roads, park management or operating requirements.\nThe final meeting point, included meals, child policy and cancellation terms are those shown before payment and in SeaLink’s confirmation."},
	120: {Zh: "请按确认时间抵达 Garden Island，并预留时间完成装备穿戴与安全说明。\n穿着可弄湿的衣物，携带饮用水、防晒用品、帽子和替换衣物；皮划艇及安全装备由向导安排。\n活动受潮汐、风力与海况影响，出发时间或路线可能调整；海豚为野生动物，无法保证出现。\n请在预订时说明儿童年龄、游泳能力、行动需求及健康状况，并以运营方确认的参加条件与取消规则为准。", En: "Arrive at Garden Island at the confirmed time and allow time for equipment fitting and the safety briefing.\nWear clothes that can get wet and bring water, sun protection, a hat and a change of clothes. Kayaks and safety equipment are arranged by the guide.\nThe route and departure can change with tides, wind and sea conditions. Dolphins are wild and cannot be guaranteed.\nDeclare children’s ages, swimming confidence, mobility needs and relevant medical conditions when booking, and follow the operator’s confirmed participation and cancellation terms."},
}

func categoryNotice(category string, product model.Product) notice {
	var n notice
	switch category {
	case "accommodation":
		n = notice{
			Zh: "入住日期、宾客人数和房型须经供应商最终确认；价格可能随日期、最少入住晚数及套餐变化。\n请在预订时如实填写所有入住者信息，并提前说明儿童、无障碍、饮食或特殊床型需求。\n入住时间、押金/预授权、额外宾客费用及退房安排以住宿方确认单为准。\n改期、取消及未入住条款因日期与房价类型而异，请在付款前查看并保留最终确认条款。",
			En: "Dates, guest numbers and room type remain subject to the property’s final confirmation; rates can vary by date, minimum stay and package.\nEnter every guest accurately and disclose child, accessibility, dietary or bedding requirements when booking.\nCheck-in time, deposit or pre-authorisation, extra-guest charges and checkout arrangements are governed by the property confirmation.\nChange, cancellation and no-show terms vary by date and rate type. Review and retain the final terms shown before payment.",
		}
	case "food-wine":
		n = notice{
			Zh: "座位、菜单与价格须以餐厅或酒庄的最终确认及当日供应为准，周末和节假日建议提前预订。\n请在预订时告知过敏、饮食限制、儿童人数及无障碍需求；场地方会确认能否安排，但无法保证完全无交叉接触。\n品酒体验仅向达到澳大利亚法定饮酒年龄的客人提供，场地方可要求出示带照片的身份证件；饮酒后请勿驾车。\n迟到可能缩短体验时间；订金、改期、取消、团体菜单及附加费以付款前显示的场地方条款为准。",
			En: "Seating, menu and price remain subject to the venue’s confirmation and daily availability. Advance reservations are recommended for weekends and public holidays.\nDisclose allergies, dietary restrictions, children and accessibility needs when booking. The venue will confirm what can be accommodated, but an allergen-free environment cannot be guaranteed.\nAlcohol tastings are for guests of legal drinking age in Australia and photo identification may be requested. Do not drive after drinking.\nLate arrival can shorten the experience. Deposits, changes, cancellations, group menus and surcharges follow the venue terms shown before payment.",
		}
	default:
		n = notice{
			Zh: fmt.Sprintf("请按订单确认的集合时间和地点提前到达，并出示电子或打印凭证；当前公布体验时长为 %s。\n请穿着适合天气及活动强度的衣物与鞋履，携带饮用水、防晒用品和个人所需药物。\n请在预订时如实填写参加者年龄，并提前说明行动辅助、饮食、健康或无障碍需求；供应商将确认是否适合参加。\n活动可能受天气、野生动物、道路或运营条件影响而调整；最终成团人数、迟到、改期和取消规则以付款前及运营方确认单为准。", display(product.Duration, "以订单确认为准")),
			En: fmt.Sprintf("Arrive early at the meeting time and place on the confirmation and present a mobile or printed voucher. The currently published duration is %s.\nWear clothing and footwear suitable for the weather and activity, and bring water, sun protection and personal medication.\nEnter participant ages accurately and disclose mobility, dietary, medical or accessibility requirements when booking so the operator can confirm suitability.\nWeather, wildlife, roads or operating conditions can change the activity. Final minimum numbers, late-arrival, change and cancellation rules are those shown before payment and in the operator confirmation.", display(product.Duration, "as confirmed on the booking")),
		}
	}

	for _, faq := range product.FAQs {
		if strings.TrimSpace(faq.QuestionZh) != "" && strings.TrimSpace(faq.AnswerZh) != "" {
			n.Zh += fmt.Sprintf("\n%s：%s", strings.TrimSuffix(strings.TrimSpace(faq.QuestionZh), "？"), strings.TrimSpace(faq.AnswerZh))
		}
		if strings.TrimSpace(faq.QuestionEn) != "" && strings.TrimSpace(faq.AnswerEn) != "" {
			n.En += fmt.Sprintf("\n%s: %s", strings.TrimSuffix(strings.TrimSpace(faq.QuestionEn), "?"), strings.TrimSpace(faq.AnswerEn))
		}
	}
	return n
}

func display(value, fallback string) string {
	if strings.TrimSpace(value) == "" {
		return fallback
	}
	return value
}

func main() {
	configPath := flag.String("config", "configs/config.yaml", "path to config file")
	dryRun := flag.Bool("dry-run", false, "show changes without updating")
	flag.Parse()

	cfg, err := config.Load(*configPath)
	if err != nil {
		log.Fatal(err)
	}
	db, err := database.Init(cfg.Database)
	if err != nil {
		log.Fatal(err)
	}
	if err := db.AutoMigrate(&model.Product{}); err != nil {
		log.Fatal(err)
	}

	var products []model.Product
	if err := db.Preload("Category").Preload("FAQs", func(tx *gorm.DB) *gorm.DB {
		return tx.Order("sort_order ASC").Limit(2)
	}).Order("id").Find(&products).Error; err != nil {
		log.Fatal(err)
	}
	updated := 0
	for _, product := range products {
		n, ok := exact[product.ID]
		if !ok {
			category := ""
			if product.Category != nil {
				category = product.Category.Slug
			}
			n = categoryNotice(category, product)
		}
		if strings.TrimSpace(product.BookingNoticeZh) != "" && strings.TrimSpace(product.BookingNoticeEn) != "" {
			continue
		}
		fmt.Printf("%d\t%s\n", product.ID, product.NameEn)
		if !*dryRun {
			if err := db.Model(&model.Product{}).Where("id = ?", product.ID).Updates(map[string]interface{}{
				"booking_notice_zh": n.Zh,
				"booking_notice_en": n.En,
			}).Error; err != nil && err != gorm.ErrRecordNotFound {
				log.Fatal(err)
			}
		}
		updated++
	}
	fmt.Printf("updated=%d total=%d dry_run=%v\n", updated, len(products), *dryRun)
}
