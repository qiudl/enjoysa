import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { UserPlus, Edit2, UserX, UserCheck, X, Users, Shield, ShoppingCart, DollarSign, Headphones, Key, Link2, Clock, Check, Trash2 } from 'lucide-react';
import styles from './SupplierTeamPage.module.css';

export interface SupplierTeamPageProps {
  onNavigate?: (path: string) => void;
}

type Role = 'admin' | 'operations' | 'finance' | 'support';
type TabKey = 'members' | 'permissions' | 'invitations';
type AccessLevel = 'full' | 'readonly' | 'none';
type InviteExpiry = '1d' | '3d' | '7d' | 'never';

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: 'active' | 'disabled';
  lastLogin: string;
  joinedAt: string;
}

interface Invitation {
  id: string;
  email: string;
  role: Role;
  status: 'pending' | 'accepted' | 'expired';
  expiresAt: string;
  createdAt: string;
}

interface PermissionRow {
  page: string;
  labelKey: string;
  access: Record<Role, AccessLevel>;
}

const roleConfig: Record<Role, { color: string; icon: React.ReactNode; labelKey: string }> = {
  admin: { color: '#ef4444', icon: <Shield size={14} />, labelKey: 'supplier.team.roleAdmin' },
  operations: { color: '#3b82f6', icon: <ShoppingCart size={14} />, labelKey: 'supplier.team.roleOperations' },
  finance: { color: '#10b981', icon: <DollarSign size={14} />, labelKey: 'supplier.team.roleFinance' },
  support: { color: '#f59e0b', icon: <Headphones size={14} />, labelKey: 'supplier.team.roleSupport' },
};

const mockMembers: TeamMember[] = [
  { id: 'm1', name: 'James Chen', email: 'james@adelaidetours.com', role: 'admin', status: 'active', lastLogin: '2026-03-23 10:30', joinedAt: '2025-06-01' },
  { id: 'm2', name: 'Sarah Li', email: 'sarah@adelaidetours.com', role: 'operations', status: 'active', lastLogin: '2026-03-23 09:15', joinedAt: '2025-08-15' },
  { id: 'm3', name: 'Michael Wang', email: 'michael@adelaidetours.com', role: 'operations', status: 'active', lastLogin: '2026-03-22 16:45', joinedAt: '2025-10-01' },
  { id: 'm4', name: 'Emily Zhang', email: 'emily@adelaidetours.com', role: 'finance', status: 'active', lastLogin: '2026-03-21 14:20', joinedAt: '2025-11-20' },
  { id: 'm5', name: 'David Liu', email: 'david@adelaidetours.com', role: 'support', status: 'disabled', lastLogin: '2026-02-28 11:00', joinedAt: '2026-01-10' },
];

const defaultPermissions: PermissionRow[] = [
  { page: 'dashboard', labelKey: 'supplier.nav.dashboard', access: { admin: 'full', operations: 'full', finance: 'full', support: 'full' } },
  { page: 'products', labelKey: 'supplier.nav.products', access: { admin: 'full', operations: 'full', finance: 'none', support: 'none' } },
  { page: 'orders', labelKey: 'supplier.nav.orders', access: { admin: 'full', operations: 'full', finance: 'readonly', support: 'full' } },
  { page: 'settlement', labelKey: 'supplier.nav.settlement', access: { admin: 'full', operations: 'none', finance: 'full', support: 'none' } },
  { page: 'afterSales', labelKey: 'supplier.nav.afterSales', access: { admin: 'full', operations: 'full', finance: 'none', support: 'full' } },
  { page: 'team', labelKey: 'supplier.nav.team', access: { admin: 'full', operations: 'none', finance: 'none', support: 'none' } },
  { page: 'reports', labelKey: 'supplier.nav.reports', access: { admin: 'full', operations: 'full', finance: 'full', support: 'none' } },
  { page: 'settings', labelKey: 'supplier.nav.settings', access: { admin: 'full', operations: 'none', finance: 'none', support: 'none' } },
];

const mockInvitations: Invitation[] = [
  { id: 'inv1', email: 'lucy@adelaidetours.com', role: 'operations', status: 'pending', expiresAt: '2026-03-26', createdAt: '2026-03-23' },
  { id: 'inv2', email: 'tom@adelaidetours.com', role: 'support', status: 'accepted', expiresAt: '2026-03-20', createdAt: '2026-03-17' },
  { id: 'inv3', email: 'kate@adelaidetours.com', role: 'finance', status: 'expired', expiresAt: '2026-03-15', createdAt: '2026-03-08' },
];

const accessCycle: AccessLevel[] = ['full', 'readonly', 'none'];

export const SupplierTeamPage: React.FC<SupplierTeamPageProps> = () => {
  const { t } = useTranslation();
  const [members, setMembers] = useState<TeamMember[]>(mockMembers);
  const [activeTab, setActiveTab] = useState<TabKey>('members');
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<Role>('operations');
  const [inviteExpiry, setInviteExpiry] = useState<InviteExpiry>('3d');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<PermissionRow[]>(defaultPermissions);
  const [invitations, setInvitations] = useState<Invitation[]>(mockInvitations);
  const [resetPasswordId, setResetPasswordId] = useState<string | null>(null);
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  const activeCount = members.filter((m) => m.status === 'active').length;

  const handleInvite = () => {
    if (!inviteEmail.trim()) return;
    const newMember: TeamMember = {
      id: `m${Date.now()}`,
      name: inviteEmail.split('@')[0],
      email: inviteEmail,
      role: inviteRole,
      status: 'active',
      lastLogin: '-',
      joinedAt: new Date().toISOString().slice(0, 10),
    };
    setMembers((prev) => [...prev, newMember]);

    const expiryDays = inviteExpiry === '1d' ? 1 : inviteExpiry === '3d' ? 3 : inviteExpiry === '7d' ? 7 : 365;
    const expDate = new Date();
    expDate.setDate(expDate.getDate() + expiryDays);
    const newInvite: Invitation = {
      id: `inv${Date.now()}`,
      email: inviteEmail,
      role: inviteRole,
      status: 'accepted',
      expiresAt: expDate.toISOString().slice(0, 10),
      createdAt: new Date().toISOString().slice(0, 10),
    };
    setInvitations((prev) => [newInvite, ...prev]);

    setInviteEmail('');
    setInviteRole('operations');
    setInviteExpiry('3d');
    setShowInvite(false);
  };

  const handleToggleStatus = (id: string) => {
    setMembers((prev) =>
      prev.map((m) =>
        m.id === id ? { ...m, status: m.status === 'active' ? 'disabled' : 'active' } : m
      )
    );
  };

  const handleRoleChange = (id: string, role: Role) => {
    setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, role } : m)));
    setEditingId(null);
  };

  const handlePermissionToggle = (pageIdx: number, role: Role) => {
    if (role === 'admin') return; // Admin always full
    setPermissions((prev) => {
      const updated = [...prev];
      const current = updated[pageIdx].access[role];
      const nextIdx = (accessCycle.indexOf(current) + 1) % accessCycle.length;
      updated[pageIdx] = {
        ...updated[pageIdx],
        access: { ...updated[pageIdx].access, [role]: accessCycle[nextIdx] },
      };
      return updated;
    });
  };

  const handleResetPassword = (id: string) => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let pw = '';
    for (let i = 0; i < 10; i++) pw += chars.charAt(Math.floor(Math.random() * chars.length));
    setResetPasswordId(id);
    setTempPassword(pw);
  };

  const handleRevokeInvite = (id: string) => {
    setInvitations((prev) => prev.filter((inv) => inv.id !== id));
  };

  const handleResendInvite = (id: string) => {
    setInvitations((prev) =>
      prev.map((inv) => {
        if (inv.id !== id) return inv;
        const expDate = new Date();
        expDate.setDate(expDate.getDate() + 3);
        return { ...inv, status: 'pending', expiresAt: expDate.toISOString().slice(0, 10) };
      })
    );
  };

  const tabs: { key: TabKey; labelKey: string }[] = [
    { key: 'members', labelKey: 'supplier.team.tabMembers' },
    { key: 'permissions', labelKey: 'supplier.team.tabPermissions' },
    { key: 'invitations', labelKey: 'supplier.team.tabInvitations' },
  ];

  return (
    <div className={styles.container}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>{t('supplier.team.title')}</h1>
        <button className={styles.inviteBtn} onClick={() => setShowInvite(true)}>
          <UserPlus size={16} />
          {t('supplier.team.invite')}
        </button>
      </div>

      {/* Stats */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <span className={styles.statValue}>{members.length}</span>
          <span className={styles.statLabel}>{t('supplier.team.totalMembers')}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statValue}>{activeCount}</span>
          <span className={styles.statLabel}>{t('supplier.team.activeMembers')}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statValue}>{Object.keys(roleConfig).length}</span>
          <span className={styles.statLabel}>{t('supplier.team.roles')}</span>
        </div>
      </div>

      {/* Tabs */}
      <div className={styles.tabBar}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            className={`${styles.tabBtn} ${activeTab === tab.key ? styles.tabActive : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {t(tab.labelKey)}
          </button>
        ))}
      </div>

      {/* Members Tab */}
      {activeTab === 'members' && (
        <div className={styles.memberList}>
          {members.map((member) => {
            const rc = roleConfig[member.role];
            return (
              <div key={member.id} className={`${styles.memberCard} ${member.status === 'disabled' ? styles.disabled : ''}`}>
                <div className={styles.memberInfo}>
                  <div className={styles.avatar} style={{ backgroundColor: rc.color }}>
                    {member.name.charAt(0)}
                  </div>
                  <div className={styles.memberDetails}>
                    <span className={styles.memberName}>{member.name}</span>
                    <span className={styles.memberEmail}>{member.email}</span>
                  </div>
                </div>

                <div className={styles.memberMeta}>
                  {editingId === member.id ? (
                    <select
                      className={styles.roleSelect}
                      value={member.role}
                      onChange={(e) => handleRoleChange(member.id, e.target.value as Role)}
                      onBlur={() => setEditingId(null)}
                      autoFocus
                    >
                      {(Object.keys(roleConfig) as Role[]).map((r) => (
                        <option key={r} value={r}>{t(roleConfig[r].labelKey)}</option>
                      ))}
                    </select>
                  ) : (
                    <span
                      className={styles.roleBadge}
                      style={{ backgroundColor: `${rc.color}15`, color: rc.color }}
                    >
                      {rc.icon}
                      {t(rc.labelKey)}
                    </span>
                  )}

                  <span className={`${styles.statusBadge} ${member.status === 'active' ? styles.statusActive : styles.statusDisabled}`}>
                    {t(`supplier.team.status${member.status === 'active' ? 'Active' : 'Disabled'}`)}
                  </span>

                  <span className={styles.lastLogin}>
                    {t('supplier.team.lastLogin')}: {member.lastLogin}
                  </span>
                </div>

                <div className={styles.memberActions}>
                  <button
                    className={styles.actionBtn}
                    onClick={() => setEditingId(member.id)}
                    title={t('supplier.team.editRole')}
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    className={styles.actionBtn}
                    onClick={() => handleResetPassword(member.id)}
                    title={t('supplier.team.resetPassword')}
                  >
                    <Key size={16} />
                  </button>
                  <button
                    className={`${styles.actionBtn} ${member.status === 'active' ? styles.dangerAction : styles.successAction}`}
                    onClick={() => handleToggleStatus(member.id)}
                    title={member.status === 'active' ? t('supplier.team.disable') : t('supplier.team.enable')}
                  >
                    {member.status === 'active' ? <UserX size={16} /> : <UserCheck size={16} />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Permissions Tab */}
      {activeTab === 'permissions' && (
        <div className={styles.permissionSection}>
          <p className={styles.permissionHint}>{t('supplier.team.permissionHint')}</p>
          <div className={styles.permissionTable}>
            <table>
              <thead>
                <tr>
                  <th>{t('supplier.team.page')}</th>
                  {(Object.keys(roleConfig) as Role[]).map((role) => (
                    <th key={role}>{t(roleConfig[role].labelKey)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {permissions.map((row, idx) => (
                  <tr key={row.page}>
                    <td className={styles.pageName}>{t(row.labelKey)}</td>
                    {(Object.keys(roleConfig) as Role[]).map((role) => {
                      const level = row.access[role];
                      return (
                        <td key={role}>
                          <button
                            className={`${styles.accessBtn} ${styles[`access_${level}`]}`}
                            onClick={() => handlePermissionToggle(idx, role)}
                            disabled={role === 'admin'}
                            title={t(`supplier.team.access${level.charAt(0).toUpperCase() + level.slice(1)}`)}
                          >
                            {level === 'full' && t('supplier.team.accessFull')}
                            {level === 'readonly' && t('supplier.team.accessReadonly')}
                            {level === 'none' && t('supplier.team.accessNone')}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Invitations Tab */}
      {activeTab === 'invitations' && (
        <div className={styles.invitationList}>
          {invitations.length === 0 ? (
            <div className={styles.emptyState}>
              <Link2 size={32} className={styles.emptyIcon} />
              <p>{t('supplier.team.noInvitations')}</p>
            </div>
          ) : (
            invitations.map((inv) => {
              const rc = roleConfig[inv.role];
              return (
                <div key={inv.id} className={styles.invitationCard}>
                  <div className={styles.invitationInfo}>
                    <span className={styles.invitationEmail}>{inv.email}</span>
                    <span className={styles.roleBadge} style={{ backgroundColor: `${rc.color}15`, color: rc.color }}>
                      {rc.icon}
                      {t(rc.labelKey)}
                    </span>
                  </div>
                  <div className={styles.invitationMeta}>
                    <span className={`${styles.invitationStatus} ${styles[`invStatus_${inv.status}`]}`}>
                      {inv.status === 'pending' && <Clock size={12} />}
                      {inv.status === 'accepted' && <Check size={12} />}
                      {inv.status === 'expired' && <X size={12} />}
                      {t(`supplier.team.inv${inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}`)}
                    </span>
                    <span className={styles.invitationDate}>
                      {t('supplier.team.expires')}: {inv.expiresAt}
                    </span>
                  </div>
                  <div className={styles.invitationActions}>
                    {inv.status === 'expired' && (
                      <button className={styles.resendBtn} onClick={() => handleResendInvite(inv.id)}>
                        {t('supplier.team.resend')}
                      </button>
                    )}
                    {inv.status === 'pending' && (
                      <button className={styles.revokeBtn} onClick={() => handleRevokeInvite(inv.id)}>
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Invite Modal */}
      {showInvite && (
        <div className={styles.overlay} onClick={() => setShowInvite(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <span className={styles.modalTitle}>{t('supplier.team.inviteMember')}</span>
              <button className={styles.closeBtn} onClick={() => setShowInvite(false)}>
                <X size={18} />
              </button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>{t('supplier.team.email')}</label>
                <input
                  type="email"
                  className={styles.input}
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder={t('supplier.team.emailPlaceholder')}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>{t('supplier.team.role')}</label>
                <select
                  className={styles.select}
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as Role)}
                >
                  {(Object.keys(roleConfig) as Role[]).map((r) => (
                    <option key={r} value={r}>{t(roleConfig[r].labelKey)}</option>
                  ))}
                </select>
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>{t('supplier.team.linkExpiry')}</label>
                <div className={styles.expiryOptions}>
                  {(['1d', '3d', '7d', 'never'] as InviteExpiry[]).map((exp) => (
                    <button
                      key={exp}
                      className={`${styles.expiryBtn} ${inviteExpiry === exp ? styles.expiryActive : ''}`}
                      onClick={() => setInviteExpiry(exp)}
                    >
                      {t(`supplier.team.expiry${exp.charAt(0).toUpperCase() + exp.slice(1)}`)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.cancelBtn} onClick={() => setShowInvite(false)}>
                {t('common.cancel')}
              </button>
              <button
                className={styles.submitBtn}
                onClick={handleInvite}
                disabled={!inviteEmail.trim()}
              >
                <Users size={16} />
                {t('supplier.team.sendInvite')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {resetPasswordId && (
        <div className={styles.overlay} onClick={() => { setResetPasswordId(null); setTempPassword(null); }}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <span className={styles.modalTitle}>{t('supplier.team.resetPassword')}</span>
              <button className={styles.closeBtn} onClick={() => { setResetPasswordId(null); setTempPassword(null); }}>
                <X size={18} />
              </button>
            </div>
            <div className={styles.modalBody}>
              <p className={styles.resetInfo}>
                {t('supplier.team.resetPasswordInfo', { name: members.find((m) => m.id === resetPasswordId)?.name })}
              </p>
              {tempPassword && (
                <div className={styles.tempPasswordBox}>
                  <span className={styles.tempPasswordLabel}>{t('supplier.team.tempPassword')}</span>
                  <code className={styles.tempPasswordCode}>{tempPassword}</code>
                </div>
              )}
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.submitBtn} onClick={() => { setResetPasswordId(null); setTempPassword(null); }}>
                {t('common.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SupplierTeamPage;
