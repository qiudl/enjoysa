import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { UserPlus, Edit2, UserX, UserCheck, X, Users, Shield, ShoppingCart, DollarSign, Headphones, Key, Link2, Clock, Check, Trash2, Loader2 } from 'lucide-react';
import { supplierTeamService, type TeamMember as ApiMember, type TeamInvitation as ApiInvitation } from '../../../services/supplierTeamService';
import styles from './SupplierTeamPage.module.css';

export interface SupplierTeamPageProps {
  onNavigate?: (path: string) => void;
}

type Role = 'admin' | 'operations' | 'finance' | 'support' | 'staff';
type TabKey = 'members' | 'permissions' | 'invitations';
type AccessLevel = 'full' | 'readonly' | 'none';
type InviteExpiry = '1d' | '3d' | '7d' | 'never';

interface PermissionRow {
  page: string;
  labelKey: string;
  access: Record<string, AccessLevel>;
}

const roleConfig: Record<string, { color: string; icon: React.ReactNode; labelKey: string }> = {
  admin: { color: '#ef4444', icon: <Shield size={14} />, labelKey: 'supplier.team.roleAdmin' },
  operations: { color: '#3b82f6', icon: <ShoppingCart size={14} />, labelKey: 'supplier.team.roleOperations' },
  finance: { color: '#10b981', icon: <DollarSign size={14} />, labelKey: 'supplier.team.roleFinance' },
  support: { color: '#f59e0b', icon: <Headphones size={14} />, labelKey: 'supplier.team.roleSupport' },
  staff: { color: '#6b7280', icon: <Users size={14} />, labelKey: 'supplier.team.roleStaff' },
};

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

const accessCycle: AccessLevel[] = ['full', 'readonly', 'none'];

export const SupplierTeamPage: React.FC<SupplierTeamPageProps> = () => {
  const { t } = useTranslation();
  const [members, setMembers] = useState<ApiMember[]>([]);
  const [invitations, setInvitations] = useState<ApiInvitation[]>([]);
  const [activeTab, setActiveTab] = useState<TabKey>('members');
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<Role>('operations');
  const [inviteExpiry, setInviteExpiry] = useState<InviteExpiry>('3d');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [permissions, setPermissions] = useState<PermissionRow[]>(defaultPermissions);
  const [resetPasswordId, setResetPasswordId] = useState<number | null>(null);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchMembers = useCallback(async () => {
    try {
      const data = await supplierTeamService.listMembers();
      setMembers(data || []);
    } catch {
      // silently fail
    }
  }, []);

  const fetchInvitations = useCallback(async () => {
    try {
      const data = await supplierTeamService.listInvitations();
      setInvitations(data || []);
    } catch {
      // silently fail
    }
  }, []);

  useEffect(() => {
    Promise.all([fetchMembers(), fetchInvitations()]).finally(() => setLoading(false));
  }, [fetchMembers, fetchInvitations]);

  const activeCount = members.filter((m) => m.status === 'active').length;

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setActionLoading(true);
    try {
      await supplierTeamService.inviteMember({
        email: inviteEmail,
        role: inviteRole,
        expiry: inviteExpiry,
      });
      setInviteEmail('');
      setInviteRole('operations');
      setInviteExpiry('3d');
      setShowInvite(false);
      fetchInvitations();
    } catch {
      // silently fail
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleStatus = async (id: number, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
    try {
      await supplierTeamService.updateStatus(id, newStatus);
      fetchMembers();
    } catch {
      // silently fail
    }
  };

  const handleRoleChange = async (id: number, role: string) => {
    try {
      await supplierTeamService.updateRole(id, role);
      fetchMembers();
    } catch {
      // silently fail
    }
    setEditingId(null);
  };

  const handlePermissionToggle = (pageIdx: number, role: string) => {
    if (role === 'admin') return;
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

  const handleResetPassword = async (id: number) => {
    setResetPasswordId(id);
    setTempPassword(null);
    try {
      const data = await supplierTeamService.resetPassword(id);
      setTempPassword(data.temp_password);
    } catch {
      setTempPassword('Error generating password');
    }
  };

  const handleRevokeInvite = async (id: number) => {
    try {
      await supplierTeamService.revokeInvitation(id);
      fetchInvitations();
    } catch {
      // silently fail
    }
  };

  const handleResendInvite = async (id: number) => {
    try {
      await supplierTeamService.resendInvitation(id);
      fetchInvitations();
    } catch {
      // silently fail
    }
  };

  const tabs: { key: TabKey; labelKey: string }[] = [
    { key: 'members', labelKey: 'supplier.team.tabMembers' },
    { key: 'permissions', labelKey: 'supplier.team.tabPermissions' },
    { key: 'invitations', labelKey: 'supplier.team.tabInvitations' },
  ];

  const permRoles = ['admin', 'operations', 'finance', 'support'];

  if (loading) {
    return (
      <div className={styles.container}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <Loader2 size={32} style={{ animation: 'spin 0.8s linear infinite' }} />
        </div>
      </div>
    );
  }

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
          {members.length === 0 ? (
            <div className={styles.emptyState}>
              <Users size={32} className={styles.emptyIcon} />
              <p>{t('supplier.team.noMembers', 'No team members yet')}</p>
            </div>
          ) : members.map((member) => {
            const rc = roleConfig[member.role] || roleConfig.staff;
            return (
              <div key={member.id} className={`${styles.memberCard} ${member.status !== 'active' ? styles.disabled : ''}`}>
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
                      onChange={(e) => handleRoleChange(member.id, e.target.value)}
                      onBlur={() => setEditingId(null)}
                      autoFocus
                    >
                      {Object.keys(roleConfig).map((r) => (
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
                    {t('supplier.team.lastLogin')}: {member.last_login_at ? new Date(member.last_login_at).toLocaleDateString() : '-'}
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
                    onClick={() => handleToggleStatus(member.id, member.status)}
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
                  {permRoles.map((role) => (
                    <th key={role}>{t(roleConfig[role].labelKey)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {permissions.map((row, idx) => (
                  <tr key={row.page}>
                    <td className={styles.pageName}>{t(row.labelKey)}</td>
                    {permRoles.map((role) => {
                      const level = row.access[role] || 'none';
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
              const rc = roleConfig[inv.role] || roleConfig.staff;
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
                      {t('supplier.team.expires')}: {new Date(inv.expires_at).toLocaleDateString()}
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
                  {Object.keys(roleConfig).map((r) => (
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
                disabled={!inviteEmail.trim() || actionLoading}
              >
                {actionLoading ? <Loader2 size={16} style={{ animation: 'spin 0.8s linear infinite' }} /> : <Users size={16} />}
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
              {!tempPassword && (
                <div style={{ textAlign: 'center', padding: 20 }}>
                  <Loader2 size={24} style={{ animation: 'spin 0.8s linear infinite' }} />
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
