package model

import (
	"math/rand"
	"time"

	"enjoysa-backend/internal/models"
	"gorm.io/gorm"
)

type OrderStatus string

const (
	OrderStatusPending    OrderStatus = "pending"
	OrderStatusPaid       OrderStatus = "paid"
	OrderStatusAccepted   OrderStatus = "accepted"
	OrderStatusProcessing OrderStatus = "processing"
	OrderStatusCompleted  OrderStatus = "completed"
	OrderStatusCancelled  OrderStatus = "cancelled"
	OrderStatusRefunded   OrderStatus = "refunded"
)

type Order struct {
	ID        uint           `gorm:"primaryKey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	// 订单基本信息
	OrderNo   string      `gorm:"uniqueIndex;size:32;not null" json:"order_no"`
	Status    OrderStatus `gorm:"size:20;not null;default:pending" json:"status"`

	// 用户信息
	UserID    uint   `gorm:"index;not null" json:"user_id"`
	UserName  string `gorm:"size:100" json:"user_name"`
	UserPhone string `gorm:"size:20" json:"user_phone"`
	UserEmail string `gorm:"size:100" json:"user_email"`

	// 供应商信息
	SupplierID   uint   `gorm:"index;not null" json:"supplier_id"`
	SupplierName string `gorm:"size:200" json:"supplier_name"`

	// 产品信息
	ProductID   uint   `gorm:"index;not null" json:"product_id"`
	ProductName string `gorm:"size:500" json:"product_name"`
	PackageID   uint   `gorm:"index" json:"package_id"`
	PackageName string `gorm:"size:200" json:"package_name"`
	ScheduleID  *uint  `json:"schedule_id,omitempty"`

	// 预订信息
	BookingDate time.Time `gorm:"index" json:"booking_date"`
	TimeSlot    string    `gorm:"size:20" json:"time_slot"`
	Quantity    int       `gorm:"not null;default:1" json:"quantity"`
	GuestCount  int       `gorm:"default:1" json:"guest_count"`

	// 价格信息
	UnitPrice  float64 `gorm:"type:decimal(10,2);not null" json:"unit_price"`
	TotalPrice float64 `gorm:"type:decimal(10,2);not null" json:"total_price"`
	Currency   string  `gorm:"size:10;default:AUD" json:"currency"`

	// Stripe 支付
	StripeSessionID       string `gorm:"size:200" json:"-"`
	StripePaymentIntentID string `gorm:"size:200" json:"-"`

	// 支付信息
	PaymentMethod string     `gorm:"size:50" json:"payment_method"`
	PaymentTime   *time.Time `json:"payment_time,omitempty"`
	PaymentRef    string     `gorm:"size:100" json:"payment_ref"`

	// 过期时间（未支付订单30分钟过期）
	ExpiresAt *time.Time `json:"expires_at,omitempty"`

	// 接单信息
	AcceptedAt   *time.Time `json:"accepted_at,omitempty"`
	AcceptedBy   *uint      `json:"accepted_by,omitempty"`
	RejectedAt   *time.Time `json:"rejected_at,omitempty"`
	RejectReason string     `gorm:"size:500" json:"reject_reason,omitempty"`

	// 完成信息
	CompletedAt *time.Time `json:"completed_at,omitempty"`

	// 核销信息（VRF-XXXXXX，订单创建时生成；未付款时不应回前端）
	VerificationCode string     `gorm:"size:16;index" json:"verification_code,omitempty"`
	VerifiedAt       *time.Time `json:"verified_at,omitempty"`
	VerifiedBy       *uint      `json:"verified_by,omitempty"`

	// 取消/退款
	CancelledAt  *time.Time `json:"cancelled_at,omitempty"`
	CancelReason string     `gorm:"size:500" json:"cancel_reason,omitempty"`
	RefundedAt   *time.Time `json:"refunded_at,omitempty"`
	RefundAmount float64    `gorm:"type:decimal(10,2)" json:"refund_amount"`
	RefundType   string     `gorm:"size:10" json:"refund_type,omitempty"`   // full / partial
	RefundReason string     `gorm:"size:500" json:"refund_reason,omitempty"`
	RefundStatus string     `gorm:"size:20" json:"refund_status,omitempty"` // pending / processing / completed / failed

	// 备注
	UserRemark     string `gorm:"size:1000" json:"user_remark"`
	SupplierRemark string `gorm:"size:1000" json:"supplier_remark"`
	InternalNote   string `gorm:"size:1000" json:"internal_note"`

	// 渠道信息（OCTO / Trip.com Connect）
	Channel         string `gorm:"size:20;default:direct" json:"channel"`          // direct / trip_com
	ChannelRef      string `gorm:"size:128" json:"channel_ref,omitempty"`          // 渠道订单引用号
	OctoBookingUUID string `gorm:"size:36;index" json:"octo_booking_uuid,omitempty"` // 关联 OCTO booking UUID

	// 联系人
	ContactName  string `gorm:"size:100" json:"contact_name"`
	ContactPhone string `gorm:"size:20" json:"contact_phone"`
	ContactEmail string `gorm:"size:100" json:"contact_email"`

	// 关联
	User     *models.User     `gorm:"foreignKey:UserID" json:"user,omitempty"`
	Supplier *models.Supplier `gorm:"foreignKey:SupplierID" json:"supplier,omitempty"`
}

func (Order) TableName() string {
	return "orders"
}

func (o *Order) BeforeCreate(tx *gorm.DB) error {
	if o.OrderNo == "" {
		o.OrderNo = GenerateOrderNo()
	}
	if o.ExpiresAt == nil {
		expires := time.Now().Add(30 * time.Minute)
		o.ExpiresAt = &expires
	}
	if o.VerificationCode == "" {
		o.VerificationCode = GenerateVerificationCode()
	}
	return nil
}

func GenerateOrderNo() string {
	now := time.Now()
	return now.Format("ES20060102") + randomDigits(6)
}

// verificationCodeAlphabet 去掉容易混淆的 0/O/1/I/L
const verificationCodeAlphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"

// GenerateVerificationCode 生成 VRF- 前缀 + 6 位字母数字的核销码
func GenerateVerificationCode() string {
	buf := make([]byte, 6)
	for i := range buf {
		buf[i] = verificationCodeAlphabet[rand.Intn(len(verificationCodeAlphabet))]
	}
	return "VRF-" + string(buf)
}

func randomDigits(n int) string {
	digits := make([]byte, n)
	for i := range digits {
		digits[i] = '0' + byte(rand.Intn(10))
	}
	return string(digits)
}

// OrderStatusHistory 订单状态变更历史
type OrderStatusHistory struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	CreatedAt time.Time `json:"created_at"`

	OrderID      uint        `gorm:"index;not null" json:"order_id"`
	FromStatus   OrderStatus `gorm:"size:20" json:"from_status"`
	ToStatus     OrderStatus `gorm:"size:20;not null" json:"to_status"`
	OperatorID   *uint       `json:"operator_id,omitempty"`
	OperatorType string      `gorm:"size:20" json:"operator_type"` // user/supplier/admin/system
	Remark       string      `gorm:"size:500" json:"remark"`
}

func (OrderStatusHistory) TableName() string {
	return "order_status_histories"
}
