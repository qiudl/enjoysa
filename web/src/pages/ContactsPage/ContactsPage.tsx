import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Header, Footer, Button, Modal } from '../../components/Common';
import { listContacts, createContact, updateContact, deleteContact, type UserContact, type ContactInput } from '../../services/userContactService';
import styles from './ContactsPage.module.css';

export interface ContactsPageProps {
  cartCount?: number;
  onLoginClick?: () => void;
  onRegisterClick?: () => void;
  onNavClick?: (path: string) => void;
  onBack?: () => void;
}

const emptyForm: ContactInput = {
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  date_of_birth: '',
  nationality: '',
  passport_number: '',
  default_type: 'adult',
  is_self: false,
  special_requirements: '',
};

export const ContactsPage: React.FC<ContactsPageProps> = ({
  cartCount = 0,
  onLoginClick,
  onRegisterClick,
  onNavClick,
  onBack,
}) => {
  const { t } = useTranslation();
  const [contacts, setContacts] = useState<UserContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<ContactInput>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<number | null>(null);

  const loadContacts = useCallback(async () => {
    try {
      const list = await listContacts();
      setContacts(list);
    } catch (err) {
      console.error('Failed to load contacts:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadContacts(); }, [loadContacts]);

  const handleAdd = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(true);
  };

  const handleEdit = (contact: UserContact) => {
    setForm({
      first_name: contact.first_name,
      last_name: contact.last_name,
      email: contact.email,
      phone: contact.phone,
      date_of_birth: contact.date_of_birth || '',
      nationality: contact.nationality,
      passport_number: '', // don't pre-fill encrypted value
      default_type: contact.default_type,
      is_self: contact.is_self,
      special_requirements: contact.special_requirements,
    });
    setEditingId(contact.id);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.first_name.trim() || !form.last_name.trim()) return;
    setSaving(true);
    try {
      if (editingId) {
        await updateContact(editingId, form);
      } else {
        await createContact(form);
      }
      setShowForm(false);
      await loadContacts();
    } catch (err) {
      console.error('Failed to save contact:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteContact(id);
      setShowDeleteConfirm(null);
      await loadContacts();
    } catch (err) {
      console.error('Failed to delete contact:', err);
    }
  };

  const updateField = (field: keyof ContactInput, value: string | boolean) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const typeLabel = (type: string) => {
    if (type === 'child') return t('contacts.typeChild');
    if (type === 'infant') return t('contacts.typeInfant');
    return t('contacts.typeAdult');
  };

  return (
    <div className={styles.page}>
      <Header
        isLoggedIn
        cartCount={cartCount}
        onLoginClick={onLoginClick}
        onRegisterClick={onRegisterClick}
        onNavClick={onNavClick}
      />

      <main className={styles.main}>
        <div className={styles.header}>
          <h1 className={styles.title}>
            {onBack && (
              <button className={styles.cardBtn} onClick={onBack} style={{ marginRight: 8 }}>←</button>
            )}
            {t('contacts.title')}
            <span className={styles.contactCount}>({contacts.length}/20)</span>
          </h1>
          {contacts.length < 20 && (
            <Button variant="primary" size="sm" onClick={handleAdd}>
              + {t('contacts.addContact')}
            </Button>
          )}
        </div>

        {loading ? (
          <div className={styles.empty}>
            <div style={{ width: 32, height: 32, border: '3px solid #e5e7eb', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          </div>
        ) : contacts.length === 0 ? (
          <div className={styles.empty}>
            <span className={styles.emptyIcon}>👥</span>
            <p>{t('contacts.empty')}</p>
            <p className={styles.emptyHint}>{t('contacts.emptyHint')}</p>
            <Button variant="primary" onClick={handleAdd}>
              + {t('contacts.addContact')}
            </Button>
          </div>
        ) : (
          <div className={styles.list}>
            {contacts.map(contact => (
              <div key={contact.id} className={styles.card}>
                <div className={styles.cardHeader}>
                  <div>
                    <span className={styles.cardName}>
                      {contact.first_name} {contact.last_name}
                    </span>
                    {contact.is_self && (
                      <span className={styles.cardBadge}>{t('contacts.self')}</span>
                    )}
                    <span className={styles.cardTypeBadge}>{typeLabel(contact.default_type)}</span>
                  </div>
                  <div className={styles.cardActions}>
                    <button className={styles.cardBtn} onClick={() => handleEdit(contact)}>
                      {t('common.edit')}
                    </button>
                    <button className={`${styles.cardBtn} ${styles.deleteBtn}`} onClick={() => setShowDeleteConfirm(contact.id)}>
                      {t('common.delete')}
                    </button>
                  </div>
                </div>
                <div className={styles.cardBody}>
                  {contact.email && (
                    <div className={styles.cardField}>📧 <span>{contact.email}</span></div>
                  )}
                  {contact.phone && (
                    <div className={styles.cardField}>📱 <span>{contact.phone}</span></div>
                  )}
                  {contact.passport_number && (
                    <div className={styles.cardField}>🛂 <span>{contact.passport_number}</span></div>
                  )}
                  {contact.nationality && (
                    <div className={styles.cardField}>🌍 <span>{contact.nationality}</span></div>
                  )}
                  {contact.date_of_birth && (
                    <div className={styles.cardField}>🎂 <span>{contact.date_of_birth}</span></div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <Footer />

      {/* Add/Edit Modal */}
      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editingId ? t('contacts.editContact') : t('contacts.addContact')}
      >
        <div className={styles.form}>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>{t('contacts.lastName')}</label>
              <input className={styles.formInput} value={form.last_name} onChange={e => updateField('last_name', e.target.value)} />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>{t('contacts.firstName')}</label>
              <input className={styles.formInput} value={form.first_name} onChange={e => updateField('first_name', e.target.value)} />
            </div>
          </div>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>{t('contacts.email')}</label>
              <input className={styles.formInput} type="email" value={form.email || ''} onChange={e => updateField('email', e.target.value)} />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>{t('contacts.phone')}</label>
              <input className={styles.formInput} value={form.phone || ''} onChange={e => updateField('phone', e.target.value)} />
            </div>
          </div>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>{t('contacts.dateOfBirth')}</label>
              <input className={styles.formInput} type="date" value={form.date_of_birth || ''} onChange={e => updateField('date_of_birth', e.target.value)} />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>{t('contacts.nationality')}</label>
              <input className={styles.formInput} value={form.nationality || ''} onChange={e => updateField('nationality', e.target.value)} />
            </div>
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>{t('contacts.passportNumber')}</label>
            <input className={styles.formInput} value={form.passport_number || ''} onChange={e => updateField('passport_number', e.target.value)} placeholder={editingId ? t('contacts.passportPlaceholder') : ''} />
          </div>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>{t('contacts.type')}</label>
              <select className={styles.formSelect} value={form.default_type} onChange={e => updateField('default_type', e.target.value)}>
                <option value="adult">{t('contacts.typeAdult')}</option>
                <option value="child">{t('contacts.typeChild')}</option>
                <option value="infant">{t('contacts.typeInfant')}</option>
              </select>
            </div>
            <div className={styles.formGroup} style={{ justifyContent: 'flex-end' }}>
              <label className={styles.formCheckbox}>
                <input type="checkbox" checked={form.is_self || false} onChange={e => updateField('is_self', e.target.checked)} />
                {t('contacts.isSelf')}
              </label>
            </div>
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>{t('contacts.specialRequirements')}</label>
            <input className={styles.formInput} value={form.special_requirements || ''} onChange={e => updateField('special_requirements', e.target.value)} />
          </div>
          <div className={styles.formActions}>
            <Button variant="outline" onClick={() => setShowForm(false)}>{t('common.cancel')}</Button>
            <Button variant="primary" onClick={handleSave} disabled={saving || !form.first_name.trim() || !form.last_name.trim()}>
              {saving ? '...' : t('common.save')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirm Modal */}
      <Modal
        open={showDeleteConfirm !== null}
        onClose={() => setShowDeleteConfirm(null)}
        title={t('contacts.deleteContact')}
      >
        <p>{t('contacts.deleteConfirm')}</p>
        <div className={styles.formActions} style={{ marginTop: 16 }}>
          <Button variant="outline" onClick={() => setShowDeleteConfirm(null)}>{t('common.cancel')}</Button>
          <Button variant="primary" onClick={() => showDeleteConfirm && handleDelete(showDeleteConfirm)} style={{ background: 'var(--color-error)' }}>
            {t('common.delete')}
          </Button>
        </div>
      </Modal>
    </div>
  );
};

export default ContactsPage;
