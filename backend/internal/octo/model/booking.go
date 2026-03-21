package model

import (
	"time"

	"gorm.io/gorm"
)

// OctoBookingStatus OCTO 预订状态
type OctoBookingStatus string

const (
	OctoBookingOnHold    OctoBookingStatus = "ON_HOLD"
	OctoBookingConfirmed OctoBookingStatus = "CONFIRMED"
	OctoBookingCancelled OctoBookingStatus = "CANCELLED"
	OctoBookingRedeemed  OctoBookingStatus = "REDEEMED"
	OctoBookingExpired   OctoBookingStatus = "EXPIRED"
)

// OctoBooking OCTO 标准预订记录
type OctoBooking struct {
	ID        uint           `gorm:"primaryKey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	UUID       string            `gorm:"type:uuid;uniqueIndex;not null" json:"uuid"`
	OrderID    *uint             `gorm:"index" json:"order_id"`                              // 关联 EnjoySA 订单（确认后创建）
	ResellerID uint              `gorm:"index;not null" json:"reseller_id"`                  // 分销商 ID
	ProductID  uint              `gorm:"not null" json:"product_id"`                         // EnjoySA product ID
	OptionID   uint              `gorm:"not null" json:"option_id"`                          // EnjoySA package ID
	ScheduleID *uint             `json:"schedule_id"`                                        // 关联 product_schedule
	Status     OctoBookingStatus `gorm:"size:20;not null;default:ON_HOLD" json:"status"`     // ON_HOLD/CONFIRMED/CANCELLED/REDEEMED/EXPIRED
	UnitItems  string            `gorm:"type:jsonb;not null" json:"unit_items"`               // 预订单元明细
	Contact    string            `gorm:"type:jsonb" json:"contact"`                          // 联系人信息
	Notes      string            `gorm:"type:text" json:"notes"`                             // 备注
	Voucher    string            `gorm:"type:jsonb" json:"voucher"`                          // 出票凭证信息
	Currency   string            `gorm:"size:10;default:AUD" json:"currency"`                // 货币
	Quantity   int               `gorm:"not null;default:1" json:"quantity"`                 // 总数量

	// 价格（OCTO 价格用最小单位整数表示，precision=2 即分）
	RetailPrice int `gorm:"default:0" json:"retail_price"` // 零售价（分）
	NetPrice    int `gorm:"default:0" json:"net_price"`    // 批发价（分）

	// 时间
	ExpiresAt   *time.Time `json:"expires_at,omitempty"`
	ConfirmedAt *time.Time `json:"confirmed_at,omitempty"`
	CancelledAt *time.Time `json:"cancelled_at,omitempty"`
	RedeemedAt  *time.Time `json:"redeemed_at,omitempty"`
}

func (OctoBooking) TableName() string {
	return "octo_bookings"
}
