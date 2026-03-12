import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, RefreshCw, Download } from 'lucide-react';
import clsx from 'clsx';
import { UserStats } from '../../../components/Admin/UserStats';
import type { UserStatsData } from '../../../components/Admin/UserStats';
import { UserTable } from '../../../components/Admin/UserTable';
import type { UserData, UserStatus } from '../../../components/Admin/UserTable';
import { UserDetail } from '../../../components/Admin/UserDetail';
import styles from './UserList.module.css';

// Mock data for demonstration
const mockUsers: UserData[] = [
  {
    id: '1',
    name: '张三',
    email: 'zhang@example.com',
    phone: '+86 138 0000 0001',
    avatar: '',
    status: 'active',
    orderCount: 12,
    totalSpent: 2580,
    createdAt: '2025-06-15T10:30:00Z',
    lastLoginAt: '2026-02-01T14:20:00Z',
  },
  {
    id: '2',
    name: 'John Smith',
    email: 'john@example.com',
    phone: '+61 412 000 002',
    avatar: '',
    status: 'active',
    orderCount: 8,
    totalSpent: 1890,
    createdAt: '2025-08-20T09:00:00Z',
    lastLoginAt: '2026-02-02T08:15:00Z',
  },
  {
    id: '3',
    name: '李四',
    email: 'li@example.com',
    phone: '+86 139 0000 0003',
    avatar: '',
    status: 'inactive',
    orderCount: 3,
    totalSpent: 456,
    createdAt: '2025-10-05T11:45:00Z',
    lastLoginAt: '2025-12-01T16:30:00Z',
  },
  {
    id: '4',
    name: 'Sarah Johnson',
    email: 'sarah@example.com',
    phone: '+61 423 000 004',
    avatar: '',
    status: 'banned',
    orderCount: 0,
    totalSpent: 0,
    createdAt: '2025-11-10T08:00:00Z',
    lastLoginAt: '2025-11-15T09:00:00Z',
  },
  {
    id: '5',
    name: '王五',
    email: 'wang@example.com',
    phone: '+86 137 0000 0005',
    avatar: '',
    status: 'active',
    orderCount: 25,
    totalSpent: 5680,
    createdAt: '2025-03-01T15:20:00Z',
    lastLoginAt: '2026-02-02T10:45:00Z',
  },
];

const mockStats: UserStatsData = {
  total: 3256,
  active: 2890,
  inactive: 354,
  newToday: 12,
  newThisMonth: 156,
};

type TabKey = 'all' | 'active' | 'inactive' | 'banned';

export const UserList: React.FC = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserData[]>([]);
  const [stats, setStats] = useState<UserStatsData>(mockStats);
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
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setUsers(mockUsers);
    setStats(mockStats);
    setLoading(false);
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
