package models

import (
	"time"

	"gorm.io/gorm"
)

// SupplierType 供应商类型
type SupplierType string

const (
	SupplierTypeTravelAgency SupplierType = "travel_agency" // 旅行社
	SupplierTypeHotel        SupplierType = "hotel"         // 酒店
	SupplierTypeAttraction   SupplierType = "attraction"    // 景点
	SupplierTypeRestaurant   SupplierType = "restaurant"    // 餐厅
	SupplierTypeCarRental    SupplierType = "car_rental"    // 租车
)

// SupplierStatus 供应商状态
type SupplierStatus string

const (
	SupplierStatusPending   SupplierStatus = "pending"   // 待审核
	SupplierStatusApproved  SupplierStatus = "approved"  // 已通过
	SupplierStatusSuspended SupplierStatus = "suspended" // 已暂停
	SupplierStatusRejected  SupplierStatus = "rejected"  // 已拒绝
)

// Supplier B端供应商模型
type Supplier struct {
	ID        uint           `gorm:"primaryKey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	// 基本信息
	Name        string         `gorm:"size:200;not null" json:"name"`                  // 供应商名称
	Type        SupplierType   `gorm:"size:20;not null" json:"type"`                   // 供应商类型
	Status      SupplierStatus `gorm:"size:20;default:pending" json:"status"`          // 状态
	Description string         `gorm:"size:2000" json:"description"`                   // 简介
	Logo        string         `gorm:"size:500" json:"logo"`                           // Logo

	// 联系信息
	Email       string `gorm:"uniqueIndex;size:100;not null" json:"email"`
	Phone       string `gorm:"size:20" json:"phone"`
	Website     string `gorm:"size:200" json:"website"`

	// 地址信息
	Address     string `gorm:"size:500" json:"address"`
	City        string `gorm:"size:100" json:"city"`
	Province    string `gorm:"size:100" json:"province"`
	PostalCode  string `gorm:"size:20" json:"postal_code"`
	Country     string `gorm:"size:100;default:South Africa" json:"country"`

	// 营业执照/资质
	BusinessLicense string `gorm:"size:100" json:"business_license"`                   // 营业执照号
	LicenseImage    string `gorm:"size:500" json:"license_image"`                      // 营业执照图片
	TaxNumber       string `gorm:"size:50" json:"tax_number"`                          // 税号

	// 银行信息（结算用）
	BankName      string `gorm:"size:100" json:"bank_name"`
	BankAccount   string `gorm:"size:50" json:"bank_account"`
	BankBranch    string `gorm:"size:100" json:"bank_branch"`
	AccountHolder string `gorm:"size:100" json:"account_holder"`

	// 审核信息
	ApprovedAt   *time.Time `json:"approved_at,omitempty"`
	ApprovedBy   *uint      `json:"approved_by,omitempty"`
	RejectedAt   *time.Time `json:"rejected_at,omitempty"`
	RejectReason string     `gorm:"size:500" json:"reject_reason,omitempty"`

	// 评分
	Rating      float64 `gorm:"type:decimal(3,2);default:0" json:"rating"`             // 平均评分
	ReviewCount int     `gorm:"default:0" json:"review_count"`                         // 评价数量

	// 设置
	AutoAccept     bool `gorm:"default:false" json:"auto_accept"`                      // 自动接单
	NotifyEmail    bool `gorm:"default:true" json:"notify_email"`                      // 邮件通知
	NotifySMS      bool `gorm:"default:false" json:"notify_sms"`                       // 短信通知
}

// TableName 指定表名
func (Supplier) TableName() string {
	return "suppliers"
}

// SupplierUser 供应商用户（登录账号）
type SupplierUser struct {
	ID        uint           `gorm:"primaryKey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	SupplierID uint   `gorm:"index;not null" json:"supplier_id"`
	Email      string `gorm:"uniqueIndex;size:100;not null" json:"email"`
	Password   string `gorm:"size:255" json:"-"`
	Name       string `gorm:"size:100" json:"name"`
	Phone      string `gorm:"size:20" json:"phone"`
	Role       string `gorm:"size:20;default:staff" json:"role"`                       // admin/staff
	Status     string `gorm:"size:20;default:active" json:"status"`                    // active/suspended

	LastLoginAt *time.Time `json:"last_login_at,omitempty"`

	Supplier *Supplier `gorm:"foreignKey:SupplierID" json:"supplier,omitempty"`
}

// TableName 指定表名
func (SupplierUser) TableName() string {
	return "supplier_users"
}
