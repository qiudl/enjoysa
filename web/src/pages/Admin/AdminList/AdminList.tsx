import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, RefreshCw, Plus, Shield } from 'lucide-react';
import clsx from 'clsx';
import { AdminTable } from '../../../components/Admin/AdminTable';
import type { AdminUser, AdminRole, AdminStatus } from '../../../components/Admin/AdminTable';
import { AdminForm } from '../../../components/Admin/AdminForm';
import type { AdminFormData } from '../../../components/Admin/AdminForm';
import { RolePermissions } from '../../../components/Admin/RolePermissions';
import type { RoleConfig, Permission } from '../../../components/Admin/RolePermissions';
import { adminService, type ApiAdmin, type ApiRole, type ApiMenu } from '../../../services/adminService';
import styles from './AdminList.module.css';

function transformAdmin(a: ApiAdmin): AdminUser {
  return {
    id: String(a.id),
    name: a.name,
    email: a.email,
    role: (a.role || 'admin') as AdminUser['role'],
    status: (a.status || 'active') as AdminStatus,
    permissions: a.role === 'super_admin' ? ['all'] : ['dashboard'],
    createdAt: a.created_at,
    lastLoginAt: a.last_login_at,
  };
}

type TabKey = 'list' | 'roles';
type FilterTab = 'all' | 'active' | 'inactive' | 'suspended';

export const AdminList: React.FC = () => {
  const { i18n } = useTranslation();
  const isZh = i18n.language === 'zh' || i18n.language === 'zh-CN';

  const [loading, setLoading] = useState(true);
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [activeTab, setActiveTab] = useState<TabKey>('list');
  const [filterTab, setFilterTab] = useState<FilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<AdminUser | null>(null);

  // RBAC state
  const [apiRoles, setApiRoles] = useState<ApiRole[]>([]);
  const [apiMenus, setApiMenus] = useState<ApiMenu[]>([]);
  const [roleMenuMap, setRoleMenuMap] = useState<Record<number, number[]>>({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const result = await adminService.listAdmins({ page: 1, page_size: 50 });
      setAdmins((result.items || []).map(transformAdmin));
    } catch { /* ignore */ }
    setLoading(false);
  };

  const mainTabs: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: 'list', label: isZh ? '管理员列表' : 'Admin List', icon: <Shield size={16} /> },
    { key: 'roles', label: isZh ? '角色权限' : 'Role Permissions', icon: <Shield size={16} /> },
  ];

  const filterTabs: { key: FilterTab; label: string; count: number }[] = [
    { key: 'all', label: isZh ? '全部' : 'All', count: admins.length },
    { key: 'active', label: isZh ? '正常' : 'Active', count: admins.filter((a) => a.status === 'active').length },
    { key: 'inactive', label: isZh ? '未激活' : 'Inactive', count: admins.filter((a) => a.status === 'inactive').length },
    { key: 'suspended', label: isZh ? '已停用' : 'Suspended', count: admins.filter((a) => a.status === 'suspended').length },
  ];

  const filteredAdmins = admins.filter((admin) => {
    if (filterTab !== 'all' && admin.status !== filterTab) {
      return false;
    }
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        admin.name.toLowerCase().includes(query) ||
        admin.email.toLowerCase().includes(query)
      );
    }
    return true;
  });

  const handleView = (admin: AdminUser) => {
    setEditingAdmin(admin);
    setFormOpen(true);
  };

  const handleEdit = (admin: AdminUser) => {
    setEditingAdmin(admin);
    setFormOpen(true);
  };

  const handleDelete = async (admin: AdminUser) => {
    if (confirm(isZh ? `确定要删除管理员 "${admin.name}" 吗？` : `Are you sure you want to delete admin "${admin.name}"?`)) {
      try {
        await adminService.deleteAdmin(Number(admin.id));
        setAdmins((prev) => prev.filter((a) => a.id !== admin.id));
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Failed to delete admin');
      }
    }
  };

  const handleToggleStatus = async (admin: AdminUser) => {
    const newStatus: AdminStatus = admin.status === 'active' ? 'suspended' : 'active';
    try {
      await adminService.toggleAdminStatus(Number(admin.id), newStatus);
      setAdmins((prev) =>
        prev.map((a) =>
          a.id === admin.id ? { ...a, status: newStatus } : a
        )
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update status');
    }
  };

  const handleAddAdmin = () => {
    setEditingAdmin(null);
    setFormOpen(true);
  };

  const handleFormSubmit = async (data: AdminFormData) => {
    try {
      if (editingAdmin) {
        // Update existing admin via API
        const updated = await adminService.updateAdmin(Number(editingAdmin.id), {
          name: data.name,
          email: data.email,
          role: data.role,
          status: data.status,
        });
        setAdmins((prev) =>
          prev.map((a) =>
            a.id === editingAdmin.id ? transformAdmin(updated) : a
          )
        );
        // If password was provided, reset it
        if (data.password) {
          await adminService.resetAdminPassword(Number(editingAdmin.id), data.password);
        }
      } else {
        // Create new admin via API (password is required in form validation)
        const created = await adminService.createAdmin({
          email: data.email,
          password: data.password || 'Admin123!',
          name: data.name,
          role: data.role,
        });
        setAdmins((prev) => [transformAdmin(created), ...prev]);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Operation failed');
    }
    setFormOpen(false);
    setEditingAdmin(null);
  };

  // Load RBAC data when switching to roles tab
  useEffect(() => {
    if (activeTab === 'roles') {
      loadRBACData();
    }
  }, [activeTab]);

  const loadRBACData = async () => {
    try {
      const [roles, menus] = await Promise.all([
        adminService.listRoles(),
        adminService.listMenus(),
      ]);
      setApiRoles(roles);
      setApiMenus(menus);

      // Load menu IDs for each role
      const menuMap: Record<number, number[]> = {};
      await Promise.all(
        roles.filter(r => r.code !== 'super_admin').map(async (role) => {
          try {
            const result = await adminService.getRoleMenus(role.id);
            menuMap[role.id] = result.menu_ids || [];
          } catch {
            menuMap[role.id] = [];
          }
        })
      );
      setRoleMenuMap(menuMap);
    } catch { /* ignore */ }
  };

  // Build permission list from menus (non-directory, non-empty authority)
  const buildPermissions = (): Permission[] => {
    const permSet = new Map<string, Permission>();
    const flattenMenus = (menus: ApiMenu[]) => {
      for (const m of menus) {
        if (m.authority && !permSet.has(m.authority)) {
          permSet.set(m.authority, {
            key: m.authority,
            labelZh: m.title_zh || m.title,
            labelEn: m.title,
          });
        }
        if (m.children) flattenMenus(m.children);
      }
    };
    flattenMenus(apiMenus);
    return Array.from(permSet.values());
  };

  // Build role configs from API data
  const buildRoleConfigs = (): RoleConfig[] => {
    const allPerms = buildPermissions().map(p => p.key);

    // Flatten menus to get menu_id -> authority map
    const menuAuthority = new Map<number, string>();
    const flattenForMap = (menus: ApiMenu[]) => {
      for (const m of menus) {
        if (m.authority) menuAuthority.set(m.id, m.authority);
        if (m.children) flattenForMap(m.children);
      }
    };
    flattenForMap(apiMenus);

    return apiRoles.map((role): RoleConfig => {
      if (role.code === 'super_admin') {
        return {
          role: role.code as AdminRole,
          labelZh: role.name,
          labelEn: role.name,
          permissions: allPerms,
          isEditable: false,
        };
      }

      // Map menu IDs to authority strings
      const menuIds = roleMenuMap[role.id] || [];
      const perms = new Set<string>();
      for (const mid of menuIds) {
        const auth = menuAuthority.get(mid);
        if (auth) perms.add(auth);
      }

      return {
        role: role.code as AdminRole,
        labelZh: role.name,
        labelEn: role.name,
        permissions: Array.from(perms),
        isEditable: true,
      };
    });
  };

  const handleRoleSave = async (roleCode: AdminRole, permissions: string[]) => {
    // Find the role by code
    const role = apiRoles.find(r => r.code === roleCode);
    if (!role) return;

    // Map permission keys back to menu IDs
    const flatMenus: ApiMenu[] = [];
    const flatten = (menus: ApiMenu[]) => {
      for (const m of menus) {
        flatMenus.push(m);
        if (m.children) flatten(m.children);
      }
    };
    flatten(apiMenus);

    // Collect menu IDs for the selected permissions
    const menuIds = new Set<number>();
    for (const m of flatMenus) {
      if (m.authority && permissions.includes(m.authority)) {
        menuIds.add(m.id);
        // Also add parent directory
        if (m.parent_id) menuIds.add(m.parent_id);
      }
    }

    try {
      await adminService.updateRoleMenus(role.id, Array.from(menuIds));
      // Refresh role-menu map
      const result = await adminService.getRoleMenus(role.id);
      setRoleMenuMap(prev => ({ ...prev, [role.id]: result.menu_ids || [] }));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save permissions');
    }
  };

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.pageTitle}>{isZh ? '管理员管理' : 'Admin Management'}</h1>
          <p className={styles.pageDescription}>
            {isZh ? '管理系统管理员账号和角色权限' : 'Manage system admin accounts and role permissions'}
          </p>
        </div>
        {activeTab === 'list' && (
          <button className={styles.addBtn} onClick={handleAddAdmin}>
            <Plus size={18} />
            {isZh ? '添加管理员' : 'Add Admin'}
          </button>
        )}
      </div>

      {/* Main Tabs */}
      <div className={styles.mainTabs}>
        {mainTabs.map((tab) => (
          <button
            key={tab.key}
            className={clsx(styles.mainTab, activeTab === tab.key && styles.active)}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'list' && (
        <>
          {/* Toolbar */}
          <div className={styles.toolbar}>
            <div className={styles.toolbarLeft}>
              <div className={styles.filterTabs}>
                {filterTabs.map((tab) => (
                  <button
                    key={tab.key}
                    className={clsx(styles.filterTab, filterTab === tab.key && styles.active)}
                    onClick={() => setFilterTab(tab.key)}
                  >
                    {tab.label}
                    <span className={styles.tabCount}>{tab.count}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.toolbarRight}>
              <div className={styles.searchWrapper}>
                <Search size={18} className={styles.searchIcon} />
                <input
                  type="text"
                  className={styles.searchInput}
                  placeholder={isZh ? '搜索管理员...' : 'Search admins...'}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <button className={styles.iconBtn} onClick={loadData} title={isZh ? '刷新' : 'Refresh'}>
                <RefreshCw size={18} />
              </button>
            </div>
          </div>

          {/* Table */}
          <AdminTable
            admins={filteredAdmins}
            loading={loading}
            selectedIds={selectedIds}
            onSelect={setSelectedIds}
            onView={handleView}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onToggleStatus={handleToggleStatus}
          />

          {/* Pagination */}
          {!loading && filteredAdmins.length > 0 && (
            <div className={styles.pagination}>
              <span className={styles.paginationInfo}>
                {isZh
                  ? `显示 1-${filteredAdmins.length} 共 ${filteredAdmins.length} 条`
                  : `Showing 1-${filteredAdmins.length} of ${filteredAdmins.length}`}
              </span>
            </div>
          )}
        </>
      )}

      {activeTab === 'roles' && (
        <RolePermissions
          roles={apiRoles.length > 0 ? buildRoleConfigs() : []}
          permissions={apiRoles.length > 0 ? buildPermissions() : []}
          onSave={handleRoleSave}
        />
      )}

      {/* Admin Form Drawer */}
      <AdminForm
        admin={editingAdmin}
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditingAdmin(null);
        }}
        onSubmit={handleFormSubmit}
      />
    </div>
  );
};

export default AdminList;
