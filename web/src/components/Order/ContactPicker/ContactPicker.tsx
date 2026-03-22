import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '../../Common';
import { listContacts, type UserContact } from '../../../services/userContactService';
import styles from './ContactPicker.module.css';

export interface ContactPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (contact: UserContact) => void;
}

export const ContactPicker: React.FC<ContactPickerProps> = ({ isOpen, onClose, onSelect }) => {
  const { t } = useTranslation();
  const [contacts, setContacts] = useState<UserContact[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      listContacts()
        .then(setContacts)
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [isOpen]);

  const typeLabel = (type: string) => {
    if (type === 'child') return t('contacts.typeChild');
    if (type === 'infant') return t('contacts.typeInfant');
    return t('contacts.typeAdult');
  };

  return (
    <Modal open={isOpen} onClose={onClose} title={t('contacts.selectContact')}>
      {loading ? (
        <div className={styles.empty}>
          <div style={{ width: 24, height: 24, border: '3px solid #e5e7eb', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto' }} />
        </div>
      ) : contacts.length === 0 ? (
        <div className={styles.empty}>{t('contacts.empty')}</div>
      ) : (
        <div className={styles.list}>
          {contacts.map(contact => (
            <div
              key={contact.id}
              className={styles.item}
              onClick={() => { onSelect(contact); onClose(); }}
            >
              <div className={styles.itemInfo}>
                <div>
                  <span className={styles.itemName}>{contact.first_name} {contact.last_name}</span>
                  {contact.is_self && <span className={styles.itemBadge}>{t('contacts.self')}</span>}
                </div>
                <div className={styles.itemDetails}>
                  <span>{typeLabel(contact.default_type)}</span>
                  {contact.phone && <span>{contact.phone}</span>}
                  {contact.passport_number && <span>{contact.passport_number}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
};

export default ContactPicker;
