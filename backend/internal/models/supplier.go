package models

import (
	"time"

	"gorm.io/gorm"
)

// Supplier B端供应商模型
type Supplier struct {
	ID        uint           `gorm:"primaryKey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	// 基本信息
	Name        string `gorm:"size:200;not null" json:"name"`
	Type        string `gorm:"size:20;not null" json:"type"`              // travel_agency/hotel/attraction/restaurant/car_rental
	Status      string `gorm:"size:20;default:pending" json:"status"`     // pending/approved/suspended/rejected
	Description string `gorm:"size:2000" json:"description"`
	Logo        string `gorm:"size:500" json:"logo"`

	// 联系信息
	Email   string `gorm:"uniqueIndex;size:100;not null" json:"email"`
	Phone   string `gorm:"size:20" json:"phone"`
	Website string `gorm:"size:200" json:"website"`

	// 地址信息
	Address    string `gorm:"size:500" json:"address"`
	City       string `gorm:"size:100" json:"city"`
	State      string `gorm:"size:100" json:"state"`
	PostalCode string `gorm:"size:20" json:"postal_code"`
	Country    string `gorm:"size:100;default:Australia" json:"country"`

	// 营业执照/资质
	BusinessLicense string `gorm:"size:100" json:"business_license"`
	LicenseImage    string `gorm:"size:500" json:"license_image"`
	TaxNumber       string `gorm:"size:50" json:"tax_number"`

	// 银行信息
	BankName      string `gorm:"size:100" json:"bank_name"`
	BankAccount   string `gorm:"size:50" json:"bank_account"`
	BankBSB       string `gorm:"size:20" json:"bank_bsb"`
	AccountHolder string `gorm:"size:100" json:"account_holder"`

	// 审核信息
	ApprovedAt   *time.Time `json:"approved_at,omitempty"`
	ApprovedBy   *uint      `json:"approved_by,omitempty"`
	RejectedAt   *time.Time `json:"rejected_at,omitempty"`
	RejectReason string     `gorm:"size:500" json:"reject_reason,omitempty"`

	// 评分
	Rating      float64 `gorm:"type:decimal(3,2);default:0" json:"rating"`
	ReviewCount int     `gorm:"default:0" json:"review_count"`

	// 等级
	Tier string `gorm:"size:20;default:silver" json:"tier"`

	// 设置
	AutoAccept  bool `gorm:"default:false" json:"auto_accept"`
	NotifyEmail bool `gorm:"default:true" json:"notify_email"`
	NotifySMS   bool `gorm:"default:false" json:"notify_sms"`
}

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
	Role       string `gorm:"size:20;default:staff" json:"role"`   // admin/staff
	Status     string `gorm:"size:20;default:active" json:"status"` // active/suspended

	LastLoginAt *time.Time `json:"last_login_at,omitempty"`

	Supplier *Supplier `gorm:"foreignKey:SupplierID" json:"supplier,omitempty"`
}

func (SupplierUser) TableName() string {
	return "supplier_users"
}
