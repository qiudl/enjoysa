package rbac

import (
	"github.com/casbin/casbin/v2"
	casbinmodel "github.com/casbin/casbin/v2/model"
	gormadapter "github.com/casbin/gorm-adapter/v3"
	"gorm.io/gorm"
)

const casbinModelConf = `
[request_definition]
r = sub, obj, act

[policy_definition]
p = sub, obj, act

[role_definition]
g = _, _

[policy_effect]
e = some(where (p.eft == allow))

[matchers]
m = g(r.sub, p.sub) && keyMatch2(r.obj, p.obj) && regexMatch(r.act, p.act) || r.sub == "super_admin"
`

func NewCasbinEnforcer(db *gorm.DB) (*casbin.SyncedEnforcer, error) {
	adapter, err := gormadapter.NewAdapterByDBUseTableName(db, "", "casbin_rules")
	if err != nil {
		return nil, err
	}

	m, err := casbinmodel.NewModelFromString(casbinModelConf)
	if err != nil {
		return nil, err
	}

	enforcer, err := casbin.NewSyncedEnforcer(m, adapter)
	if err != nil {
		return nil, err
	}

	if err := enforcer.LoadPolicy(); err != nil {
		return nil, err
	}

	return enforcer, nil
}
