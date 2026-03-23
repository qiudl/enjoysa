package homepage

import (
	"time"

	"gorm.io/datatypes"
	"gorm.io/gorm"
)

// HomepageFeature — "为什么选择我们" 卡片
type HomepageFeature struct {
	ID        uint           `gorm:"primaryKey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	Icon      string `gorm:"size:50" json:"icon"`
	TitleZh   string `gorm:"size:200" json:"title_zh"`
	TitleEn   string `gorm:"size:200" json:"title_en"`
	DescZh    string `gorm:"size:500" json:"desc_zh"`
	DescEn    string `gorm:"size:500" json:"desc_en"`
	SortOrder int    `gorm:"default:0" json:"sort_order"`
	Status    string `gorm:"size:20;default:active" json:"status"` // active/inactive
}

func (HomepageFeature) TableName() string { return "homepage_features" }

// HomepageTestimonial — 用户评价
type HomepageTestimonial struct {
	ID        uint           `gorm:"primaryKey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	Source        string `gorm:"size:20;default:manual" json:"source"` // manual / review
	ReviewID      *uint  `json:"review_id"`
	AuthorName    string `gorm:"size:100" json:"author_name"`
	AuthorAvatar  string `gorm:"size:500" json:"author_avatar"`
	ContentZh     string `gorm:"type:text" json:"content_zh"`
	ContentEn     string `gorm:"type:text" json:"content_en"`
	Rating        int    `gorm:"default:5" json:"rating"`
	ProductNameZh string `gorm:"size:200" json:"product_name_zh"`
	ProductNameEn string `gorm:"size:200" json:"product_name_en"`
	SortOrder     int    `gorm:"default:0" json:"sort_order"`
	Status        string `gorm:"size:20;default:active" json:"status"`
}

func (HomepageTestimonial) TableName() string { return "homepage_testimonials" }

// HomepagePartner — 合作伙伴 Logo
type HomepagePartner struct {
	ID        uint           `gorm:"primaryKey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	Name      string `gorm:"size:200" json:"name"`
	Logo      string `gorm:"size:500" json:"logo"`
	Website   string `gorm:"size:500" json:"website"`
	SortOrder int    `gorm:"default:0" json:"sort_order"`
	Status    string `gorm:"size:20;default:active" json:"status"`
}

func (HomepagePartner) TableName() string { return "homepage_partners" }

// HomepageModule — 首页模块配置
type HomepageModule struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`

	ModuleKey string         `gorm:"size:50;uniqueIndex" json:"module_key"`
	TitleZh   string         `gorm:"size:200" json:"title_zh"`
	TitleEn   string         `gorm:"size:200" json:"title_en"`
	SortOrder int            `gorm:"default:0" json:"sort_order"`
	IsVisible bool           `gorm:"default:true" json:"is_visible"`
	Config    datatypes.JSON `gorm:"type:jsonb;default:'{}'" json:"config"`
}

func (HomepageModule) TableName() string { return "homepage_modules" }
