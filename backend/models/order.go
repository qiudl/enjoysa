package models

import (
	"time"

	"gorm.io/gorm"
)

// OrderStatus 订单状态
type OrderStatus string

const (
	OrderStatusPending    OrderStatus = "pending"     // 待支付
	OrderStatusPaid       OrderStatus = "paid"        // 已支付，待接单
	OrderStatusAccepted   OrderStatus = "accepted"    // 已接单
	OrderStatusProcessing OrderStatus = "processing"  // 处理中
	OrderStatusCompleted  OrderStatus = "completed"   // 已完成
	OrderStatusCancelled  OrderStatus = "cancelled"   // 已取消
	OrderStatusRefunded   OrderStatus = "refunded"    // 已退款
)

// OrderType 订单类型
type OrderType string

const (
	OrderTypeTour       OrderType = "tour"       // 旅游团
	OrderTypeHotel      OrderType = "hotel"      // 酒店
	OrderTypeAttraction OrderType = "attraction" // 景点门票
	OrderTypeCarRental  OrderType = "car_rental" // 租车
	OrderTypeRestaurant OrderType = "restaurant" // 餐厅
)

// Order 订单模型
type Order struct {
	ID        uint           `gorm:"primaryKey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	// 订单基本信息
	OrderNo     string      `gorm:"uniqueIndex;size:32;not null" json:"order_no"`      // 订单号
	OrderType   OrderType   `gorm:"size:20;not null" json:"order_type"`                // 订单类型
	Status      OrderStatus `gorm:"size:20;not null;default:pending" json:"status"`    // 订单状态

	// 用户信息（C端）
	UserID      uint   `gorm:"index;not null" json:"user_id"`                          // 下单用户ID
	UserName    string `gorm:"size:100" json:"user_name"`                              // 用户姓名
	UserPhone   string `gorm:"size:20" json:"user_phone"`                              // 用户电话
	UserEmail   string `gorm:"size:100" json:"user_email"`                             // 用户邮箱

	// 供应商信息（B端）
	SupplierID   uint   `gorm:"index;not null" json:"supplier_id"`                     // 供应商ID
	SupplierName string `gorm:"size:200" json:"supplier_name"`                         // 供应商名称

	// 产品信息
	ProductID   uint   `gorm:"index;not null" json:"product_id"`                       // 产品ID
	ProductName string `gorm:"size:500" json:"product_name"`                           // 产品名称
	ProductSKU  string `gorm:"size:100" json:"product_sku"`                            // 产品SKU

	// 预订信息
	BookingDate  time.Time `gorm:"index" json:"booking_date"`                          // 预订日期
	CheckInDate  *time.Time `json:"check_in_date,omitempty"`                           // 入住日期（酒店）
	CheckOutDate *time.Time `json:"check_out_date,omitempty"`                          // 退房日期（酒店）
	Quantity     int       `gorm:"not null;default:1" json:"quantity"`                 // 数量
	GuestCount   int       `gorm:"default:1" json:"guest_count"`                       // 客人数量

	// 价格信息
	UnitPrice    float64 `gorm:"type:decimal(10,2);not null" json:"unit_price"`        // 单价
	TotalPrice   float64 `gorm:"type:decimal(10,2);not null" json:"total_price"`       // 总价
	Currency     string  `gorm:"size:10;default:ZAR" json:"currency"`                  // 货币（默认南非兰特）

	// 支付信息
	PaymentMethod string     `gorm:"size:50" json:"payment_method"`                    // 支付方式
	PaymentTime   *time.Time `json:"payment_time,omitempty"`                           // 支付时间
	PaymentRef    string     `gorm:"size:100" json:"payment_ref"`                      // 支付参考号

	// 接单信息
	AcceptedAt    *time.Time `json:"accepted_at,omitempty"`                            // 接单时间
	AcceptedBy    *uint      `json:"accepted_by,omitempty"`                            // 接单人ID
	RejectedAt    *time.Time `json:"rejected_at,omitempty"`                            // 拒绝时间
	RejectReason  string     `gorm:"size:500" json:"reject_reason,omitempty"`          // 拒绝原因

	// 完成信息
	CompletedAt   *time.Time `json:"completed_at,omitempty"`                           // 完成时间

	// 取消/退款信息
	CancelledAt   *time.Time `json:"cancelled_at,omitempty"`                           // 取消时间
	CancelReason  string     `gorm:"size:500" json:"cancel_reason,omitempty"`          // 取消原因
	RefundedAt    *time.Time `json:"refunded_at,omitempty"`                            // 退款时间
	RefundAmount  float64    `gorm:"type:decimal(10,2)" json:"refund_amount"`          // 退款金额

	// 备注
	UserRemark     string `gorm:"size:1000" json:"user_remark"`                        // 用户备注
	SupplierRemark string `gorm:"size:1000" json:"supplier_remark"`                    // 供应商备注
	InternalNote   string `gorm:"size:1000" json:"internal_note"`                      // 内部备注

	// 联系人信息（可能与下单用户不同）
	ContactName  string `gorm:"size:100" json:"contact_name"`                          // 联系人姓名
	ContactPhone string `gorm:"size:20" json:"contact_phone"`                          // 联系人电话
	ContactEmail string `gorm:"size:100" json:"contact_email"`                         // 联系人邮箱

	// 关联
	User     *User     `gorm:"foreignKey:UserID" json:"user,omitempty"`
	Supplier *Supplier `gorm:"foreignKey:SupplierID" json:"supplier,omitempty"`
}

// TableName 指定表名
func (Order) TableName() string {
	return "orders"
}

// BeforeCreate 创建前生成订单号
func (o *Order) BeforeCreate(tx *gorm.DB) error {
	if o.OrderNo == "" {
		o.OrderNo = GenerateOrderNo()
	}
	return nil
}

// GenerateOrderNo 生成订单号
func GenerateOrderNo() string {
	// 格式: ES + 年月日 + 6位随机数
	// 例如: ES20260131123456
	now := time.Now()
	return now.Format("ES20060102") + RandomString(6)
}

// RandomString 生成随机字符串（数字）
func RandomString(n int) string {
	const letters = "0123456789"
	b := make([]byte, n)
	for i := range b {
		b[i] = letters[time.Now().UnixNano()%int64(len(letters))]
		time.Sleep(time.Nanosecond)
	}
	return string(b)
}

// OrderStatusHistory 订单状态变更历史
type OrderStatusHistory struct {
	ID        uint           `gorm:"primaryKey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`

	OrderID     uint        `gorm:"index;not null" json:"order_id"`                    // 订单ID
	FromStatus  OrderStatus `gorm:"size:20" json:"from_status"`                        // 原状态
	ToStatus    OrderStatus `gorm:"size:20;not null" json:"to_status"`                 // 新状态
	OperatorID  *uint       `json:"operator_id,omitempty"`                             // 操作人ID
	OperatorType string     `gorm:"size:20" json:"operator_type"`                      // 操作人类型: user/supplier/admin/system
	Remark      string      `gorm:"size:500" json:"remark"`                            // 备注

	Order *Order `gorm:"foreignKey:OrderID" json:"order,omitempty"`
}

// TableName 指定表名
func (OrderStatusHistory) TableName() string {
	return "order_status_histories"
}
