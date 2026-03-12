import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, RefreshCw, Plus, Shield } from 'lucide-react';
import clsx from 'clsx';
import { AdminTable } from '../../../components/Admin/AdminTable';
import type { AdminUser, AdminRole, AdminStatus } from '../../../components/Admin/AdminTable';
import { AdminForm } from '../../../components/Admin/AdminForm';
import type { AdminFormData } from '../../../components/Admin/AdminForm';
import { RolePermissions } from '../../../components/Admin/RolePermissions';
import styles from './AdminList.module.css';

// Mock data for demonstration
const mockAdmins: AdminUser[] = [
  {
    id: '1',
    name: '系统管理员',
    email: 'admin@enjoysa.com',
    phone: '+61 400 000 001',
    role: 'super_admin',
    status: 'active',
    permissions: ['all'],
    createdAt: '2025-01-01T00:00:00Z',
    lastLoginAt: '2026-02-02T09:00:00Z',
  },
  {
    id: '2',
    name: '张运营',
    email: 'ops@enjoysa.com',
    phone: '+86 138 0000 0002',
    role: 'admin',
    status: 'active',
    permissions: ['dashboard', 'suppliers', 'products', 'orders', 'users', 'finance'],
    createdAt: '2025-06-15T10:30:00Z',
    lastLoginAt: '2026-02-01T14:20:00Z',
  },
  {
    id: '3',
    name: 'Sarah Manager',
    email: 'sarah@enjoysa.com',
    phone: '+61 412 000 003',
    role: 'operator',
    status: 'active',
    permissions: ['dashboard', 'products', 'orders'],
    createdAt: '2025-09-01T08:00:00Z',
    lastLoginAt: '2026-02-02T08:15:00Z',
  },
  {
    id: '4',
    name: '李审核',
    email: 'reviewer@enjoysa.com',
    phone: '+86 139 0000 0004',
    role: 'viewer',
    status: 'inactive',
    permissions: ['dashboard', 'products'],
    createdAt: '2025-11-20T15:45:00Z',
    lastLoginAt: '2025-12-15T10:30:00Z',
  },
  {
    id: '5',
    name: 'Mike Chen',
    email: 'mike@enjoysa.com',
    phone: '+61 423 000 005',
    role: 'operator',
    status: 'suspended',
    permissions: ['dashboard', 'orders'],
    createdAt: '2025-08-10T11:00:00Z',
    lastLoginAt: '2025-10-20T16:00:00Z',
  },
];

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

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setAdmins(mockAdmins);
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

  const handleDelete = (admin: AdminUser) => {
    if (confirm(isZh ? `确定要删除管理员 "${admin.name}" 吗？` : `Are you sure you want to delete admin "${admin.name}"?`)) {
      setAdmins((prev) => prev.filter((a) => a.id !== admin.id));
    }
  };

  const handleToggleStatus = (admin: AdminUser) => {
    const newStatus: AdminStatus = admin.status === 'active' ? 'suspended' : 'active';
    setAdmins((prev) =>
      prev.map((a) =>
        a.id === admin.id ? { ...a, status: newStatus } : a
      )
    );
  };

  const handleAddAdmin = () => {
    setEditingAdmin(null);
    setFormOpen(true);
  };

  const handleFormSubmit = (data: AdminFormData) => {
    if (editingAdmin) {
      // Update existing admin
      setAdmins((prev) =>
        prev.map((a) =>
          a.id === editingAdmin.id
            ? { ...a, ...data }
            : a
        )
      );
    } else {
      // Create new admin
      const newAdmin: AdminUser = {
        id: String(Date.now()),
        ...data,
        createdAt: new Date().toISOString(),
      };
      setAdmins((prev) => [newAdmin, ...prev]);
    }
    setFormOpen(false);
    setEditingAdmin(null);
  };

  const handleRoleSave = (role: AdminRole, permissions: string[]) => {
    console.log('Save role permissions:', role, permissions);
    // In real app, call API to save role permissions
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
          roles={[]}
          permissions={[]}
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
