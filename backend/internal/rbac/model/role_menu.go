package model

type SysRoleMenu struct {
	RoleID uint `gorm:"primaryKey;autoIncrement:false" json:"role_id"`
	MenuID uint `gorm:"primaryKey;autoIncrement:false" json:"menu_id"`
}

func (SysRoleMenu) TableName() string {
	return "sys_role_menus"
}
