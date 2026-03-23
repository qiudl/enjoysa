import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { UserPlus, Edit2, UserX, UserCheck, X, Users, Shield, ShoppingCart, DollarSign, Headphones } from 'lucide-react';
import styles from './SupplierTeamPage.module.css';

export interface SupplierTeamPageProps {
  onNavigate?: (path: string) => void;
}

type Role = 'admin' | 'operations' | 'finance' | 'support';

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: 'active' | 'disabled';
  lastLogin: string;
  joinedAt: string;
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

export const SupplierTeamPage: React.FC<SupplierTeamPageProps> = () => {
  const { t } = useTranslation();
  const [members, setMembers] = useState<TeamMember[]>(mockMembers);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<Role>('operations');
  const [editingId, setEditingId] = useState<string | null>(null);

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
    setInviteEmail('');
    setInviteRole('operations');
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

      {/* Member List */}
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
    </div>
  );
};

export default SupplierTeamPage;
