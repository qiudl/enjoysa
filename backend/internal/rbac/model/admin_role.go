package model

type AdminRole struct {
	AdminID uint `gorm:"primaryKey;autoIncrement:false" json:"admin_id"`
	RoleID  uint `gorm:"primaryKey;autoIncrement:false" json:"role_id"`
}

func (AdminRole) TableName() string {
	return "admin_roles"
}
