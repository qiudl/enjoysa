import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, RefreshCw, Download } from 'lucide-react';
import clsx from 'clsx';
import { UserStats } from '../../../components/Admin/UserStats';
import type { UserStatsData } from '../../../components/Admin/UserStats';
import { UserTable } from '../../../components/Admin/UserTable';
import type { UserData, UserStatus } from '../../../components/Admin/UserTable';
import { UserDetail } from '../../../components/Admin/UserDetail';
import { adminService, type ApiUser } from '../../../services/adminService';
import styles from './UserList.module.css';

function transformUser(u: ApiUser): UserData {
  return {
    id: String(u.id),
    name: u.name,
    email: u.email,
    phone: u.phone,
    avatar: u.avatar,
    status: (u.status || 'active') as UserStatus,
    orderCount: 0,
    totalSpent: 0,
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

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const result = await adminService.listUsers({ page: 1, page_size: 50 });
      const items = (result.items || []).map(transformUser);
      setUsers(items);
      const active = items.filter((u) => u.status === 'active').length;
      const inactive = items.filter((u) => u.status === 'inactive').length;
      setStats({ total: result.total, active, inactive, newToday: 0, newThisMonth: 0 });
    } catch {
      // fallback
    } finally {
      setLoading(false);
    }
  };

  const tabs: { key: TabKey; label: string; count?: number }[] = [
    { key: 'all', label: t('admin.users.tabs.all'), count: stats.total },
    { key: 'active', label: t('admin.users.tabs.active'), count: stats.active },
    { key: 'inactive', label: t('admin.users.tabs.inactive'), count: stats.inactive },
    { key: 'banned', label: t('admin.users.tabs.banned') },
  ];

  const filteredUsers = users.filter((user) => {
    // Filter by tab
    if (activeTab !== 'all' && user.status !== activeTab) {
      return false;
    }
    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        user.name.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query) ||
        (user.phone && user.phone.toLowerCase().includes(query))
      );
    }
    return true;
  });

  const handleView = (user: UserData) => {
    setSelectedUser(user);
    setDetailOpen(true);
  };

  const handleBan = async (user: UserData, reason: string) => {
    // API call to ban user
    console.log('Ban user:', user.id, 'Reason:', reason);
    setUsers((prev) =>
      prev.map((u) =>
        u.id === user.id
          ? { ...u, status: 'banned' as UserStatus }
          : u
      )
    );
    setDetailOpen(false);
  };

  const handleUnban = async (user: UserData) => {
    // API call to unban user
    console.log('Unban user:', user.id);
    setUsers((prev) =>
      prev.map((u) =>
        u.id === user.id
          ? { ...u, status: 'active' as UserStatus }
          : u
      )
    );
    setDetailOpen(false);
  };

  const handleStatClick = (status: string) => {
    if (status === 'total') {
      setActiveTab('all');
    } else if (status === 'active' || status === 'inactive' || status === 'banned') {
      setActiveTab(status);
    }
  };

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
        users={filteredUsers}
        loading={loading}
        selectedIds={selectedIds}
        onSelect={setSelectedIds}
        onView={handleView}
        onBan={(u) => handleBan(u, '')}
        onUnban={handleUnban}
      />

      {/* Pagination */}
      {!loading && filteredUsers.length > 0 && (
        <div className={styles.pagination}>
          <span className={styles.paginationInfo}>
            {t('admin.users.showing', {
              from: 1,
              to: filteredUsers.length,
              total: filteredUsers.length,
            })}
          </span>
        </div>
      )}

      {/* Detail Drawer */}
      <UserDetail
        user={selectedUser}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        onBan={handleBan}
        onUnban={handleUnban}
      />
    </div>
  );
};

export default UserList;
