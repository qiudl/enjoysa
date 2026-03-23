import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, RefreshCw, Download, Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import clsx from 'clsx';
import { UserStats } from '../../../components/Admin/UserStats';
import type { UserStatsData } from '../../../components/Admin/UserStats';
import { UserTable } from '../../../components/Admin/UserTable';
import type { UserData, UserStatus } from '../../../components/Admin/UserTable';
import { UserDetail } from '../../../components/Admin/UserDetail';
import { UserForm } from '../../../components/Admin/UserForm';
import type { UserFormData } from '../../../components/Admin/UserForm';
import { adminService, type ApiUser } from '../../../services/adminService';
import styles from './UserList.module.css';

// Map backend status → frontend display status
function mapStatus(backendStatus: string): UserStatus {
  switch (backendStatus) {
    case 'active': return 'active';
    case 'suspended': return 'inactive';
    case 'banned': return 'banned';
    default: return 'active';
  }
}

// Map frontend display status → backend status for API calls
function toBackendStatus(frontendStatus: UserStatus): string {
  switch (frontendStatus) {
    case 'active': return 'active';
    case 'inactive': return 'suspended';
    case 'banned': return 'banned';
    default: return 'active';
  }
}

function transformUser(u: ApiUser): UserData {
  return {
    id: String(u.id),
    name: u.name,
    email: u.email,
    phone: u.phone,
    avatar: u.avatar,
    status: mapStatus(u.status),
    orderCount: u.order_count ?? 0,
    totalSpent: u.total_spent ?? 0,
    createdAt: u.created_at,
    lastLoginAt: u.updated_at,
  };
}

const defaultStats: UserStatsData = {
  total: 0,
  active: 0,
  inactive: 0,
  newToday: 0,
  newThisMonth: 0,
};

type TabKey = 'all' | 'active' | 'inactive' | 'banned';

const PAGE_SIZE = 20;

export const UserList: React.FC = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserData[]>([]);
  const [stats, setStats] = useState<UserStatsData>(defaultStats);
  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Pagination state
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Form drawer state
  const [formOpen, setFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<ApiUser | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  // Search debounce
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const statusParam = activeTab === 'all' ? undefined : toBackendStatus(activeTab as UserStatus);
      const result = await adminService.listUsers({
        page,
        page_size: PAGE_SIZE,
        status: statusParam,
        keyword: debouncedSearch || undefined,
      });
      const items = (result.items || []).map(transformUser);
      setUsers(items);
      setTotal(result.total);

      // Refresh stats from unfiltered query only when on 'all' tab with no search
      if (activeTab === 'all' && !debouncedSearch) {
        const active = items.filter((u) => u.status === 'active').length;
        const inactive = items.filter((u) => u.status === 'inactive').length;
        setStats({ total: result.total, active, inactive, newToday: 0, newThisMonth: 0 });
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [page, activeTab, debouncedSearch]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Reset page when tab changes
  useEffect(() => {
    setPage(1);
  }, [activeTab]);

  const tabs: { key: TabKey; label: string; count?: number }[] = [
    { key: 'all', label: t('admin.users.tabs.all'), count: stats.total },
    { key: 'active', label: t('admin.users.tabs.active'), count: stats.active },
    { key: 'inactive', label: t('admin.users.tabs.inactive'), count: stats.inactive },
    { key: 'banned', label: t('admin.users.tabs.banned') },
  ];

  const handleView = (user: UserData) => {
    setSelectedUser(user);
    setDetailOpen(true);
  };

  const handleEdit = async (user: UserData) => {
    try {
      const apiUser = await adminService.getUser(Number(user.id));
      setEditingUser(apiUser);
      setFormOpen(true);
    } catch {
      // silent
    }
  };

  const handleDelete = async (user: UserData) => {
    if (!window.confirm(t('admin.users.deleteConfirm', { name: user.name }))) return;
    try {
      await adminService.deleteUser(Number(user.id));
      loadData();
    } catch {
      // silent
    }
  };

  const handleBan = async (user: UserData, _reason?: string) => {
    try {
      await adminService.toggleUserStatus(Number(user.id), 'banned');
      loadData();
    } catch {
      // silent
    }
    setDetailOpen(false);
  };

  const handleUnban = async (user: UserData) => {
    try {
      await adminService.toggleUserStatus(Number(user.id), 'active');
      loadData();
    } catch {
      // silent
    }
    setDetailOpen(false);
  };

  const handleCreateClick = () => {
    setEditingUser(null);
    setFormOpen(true);
  };

  const handleFormSubmit = async (data: UserFormData) => {
    setFormLoading(true);
    try {
      if (editingUser) {
        await adminService.updateUser(editingUser.id, {
          name: data.name,
          email: data.email,
          phone: data.phone || undefined,
          status: data.status,
        });
      } else {
        await adminService.createUser({
          name: data.name,
          email: data.email,
          phone: data.phone || undefined,
          password: data.password,
          status: data.status,
        });
      }
      setFormOpen(false);
      loadData();
    } catch {
      // silent
    } finally {
      setFormLoading(false);
    }
  };

  const handleStatClick = (status: string) => {
    if (status === 'total') {
      setActiveTab('all');
    } else if (status === 'active' || status === 'inactive' || status === 'banned') {
      setActiveTab(status);
    }
  };

  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);

  return (
    <div className={styles.page}>
      {/* Stats */}
      <UserStats data={stats} loading={loading} onStatClick={handleStatClick} />

      {/* Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          {/* Tabs */}
          <div className={styles.tabs}>
            {tabs.map((tab) => (
              <button
                key={tab.key}
                className={clsx(styles.tab, activeTab === tab.key && styles.active)}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
                {tab.count !== undefined && (
                  <span className={styles.tabCount}>{tab.count}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.toolbarRight}>
          {/* Search */}
          <div className={styles.searchWrapper}>
            <Search size={18} className={styles.searchIcon} />
            <input
              type="text"
              className={styles.searchInput}
              placeholder={t('admin.users.search')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Create User */}
          <button className={styles.createBtn} onClick={handleCreateClick}>
            <Plus size={18} />
            <span>{t('admin.users.actions.create')}</span>
          </button>

          {/* Actions */}
          <button className={styles.iconBtn} onClick={loadData} title={t('common.refresh')}>
            <RefreshCw size={18} />
          </button>
          <button className={styles.iconBtn} title={t('admin.users.export')}>
            <Download size={18} />
          </button>
        </div>
      </div>

      {/* Table */}
      <UserTable
        users={users}
        loading={loading}
        selectedIds={selectedIds}
        onSelect={setSelectedIds}
        onView={handleView}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onBan={handleBan}
        onUnban={handleUnban}
      />

      {/* Pagination */}
      {!loading && total > 0 && (
        <div className={styles.pagination}>
          <span className={styles.paginationInfo}>
            {t('admin.users.showing', { from, to, total })}
          </span>
          <div className={styles.paginationControls}>
            <button
              className={styles.pageBtn}
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft size={18} />
            </button>
            <span className={styles.pageIndicator}>
              {page} / {totalPages}
            </span>
            <button
              className={styles.pageBtn}
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      )}

      {/* Detail Drawer */}
      <UserDetail
        user={selectedUser}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        onBan={(u) => handleBan(u)}
        onUnban={handleUnban}
      />

      {/* Create / Edit Form Drawer */}
      <UserForm
        user={editingUser}
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={handleFormSubmit}
        loading={formLoading}
      />
    </div>
  );
};

export default UserList;
