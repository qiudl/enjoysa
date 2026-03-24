import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { User, Plus, Trash2, ChevronDown, ChevronUp, Users, AlertTriangle, Check } from 'lucide-react';
import { Input } from '../../Common/Input';
import { ContactPicker } from '../ContactPicker';
import type { UserContact } from '../../../services/userContactService';
import { upsertContact } from '../../../services/userContactService';
import styles from './ParticipantForm.module.css';
import type { ParticipantDetail } from '../../../types';

export interface ParticipantFormProps {
  /** 参与者列表 */
  participants: ParticipantDetail[];
  /** 参与者变化回调 */
  onChange?: (participants: ParticipantDetail[]) => void;
  /** 最大参与者数量 */
  maxParticipants?: number;
  /** 最小参与者数量 */
  minParticipants?: number;
  /** 是否需要护照信息 */
  requirePassport?: boolean;
  /** 是否只读 */
  readonly?: boolean;
  /** 各参与者字段错误信息 { [participantIndex]: { fieldName: errorMsg } } */
  errors?: Record<number, Record<string, string>>;
  /** 字段修改时清除对应错误 */
  onFieldChange?: (index: number, field: string) => void;
  /** 是否已登录（显示常用联系人按钮） */
  isAuthenticated?: boolean;
}

const defaultParticipant: Omit<ParticipantDetail, 'id'> = {
  type: 'adult',
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  dateOfBirth: '',
  nationality: '',
  passportNumber: '',
  specialRequirements: '',
};

/** Check if a participant has all required fields filled */
const isParticipantComplete = (p: ParticipantDetail, requirePassport: boolean): boolean => {
  if (!p.firstName.trim() || !p.lastName.trim()) return false;
  if (!p.email?.trim() || !p.phone?.trim()) return false;
  if (requirePassport && !p.passportNumber?.trim()) return false;
  return true;
};

/** Check if a participant has any field filled */
const hasAnyField = (p: ParticipantDetail): boolean => {
  return !!(p.firstName.trim() || p.lastName.trim() || p.email?.trim() || p.phone?.trim());
};

export const ParticipantForm: React.FC<ParticipantFormProps> = ({
  participants,
  onChange,
  maxParticipants = 10,
  minParticipants = 1,
  requirePassport = false,
  readonly = false,
  errors,
  onFieldChange,
  isAuthenticated = false,
}) => {
  const { t } = useTranslation();
  const [pickerTarget, setPickerTarget] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<string[]>(
    participants.length > 0 ? [participants[0].id] : []
  );
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  // Track which participants were just saved to contacts
  const [savedContactIds, setSavedContactIds] = useState<Set<string>>(new Set());

  // Auto-expand error cards when errors change
  useEffect(() => {
    if (!errors) return;
    const errorIndices = Object.keys(errors).map(Number);
    if (errorIndices.length === 0) return;

    const errorIds = errorIndices
      .filter(i => participants[i])
      .map(i => participants[i].id);

    setExpandedIds(prev => {
      const merged = new Set([...prev, ...errorIds]);
      return [...merged];
    });

    // Scroll to first error card
    const firstErrorIdx = Math.min(...errorIndices);
    const firstErrorP = participants[firstErrorIdx];
    if (firstErrorP) {
      const el = cardRefs.current[firstErrorP.id];
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [errors, participants]);

  // Auto-save contacts with debounce
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const savedSnapshots = useRef<Record<string, string>>({});

  const autoSaveContact = useCallback((p: ParticipantDetail) => {
    if (!isAuthenticated || readonly) return;
    if (!p.firstName.trim() || !p.lastName.trim()) return;

    const snapshot = JSON.stringify({
      first_name: p.firstName, last_name: p.lastName,
      email: p.email, phone: p.phone, date_of_birth: p.dateOfBirth,
      nationality: p.nationality, passport_number: p.passportNumber,
      special_requirements: p.specialRequirements, default_type: p.type,
    });

    if (savedSnapshots.current[p.id] === snapshot) return;

    if (saveTimers.current[p.id]) clearTimeout(saveTimers.current[p.id]);
    saveTimers.current[p.id] = setTimeout(() => {
      savedSnapshots.current[p.id] = snapshot;
      upsertContact({
        first_name: p.firstName.trim(),
        last_name: p.lastName.trim(),
        email: p.email?.trim() || undefined,
        phone: p.phone?.trim() || undefined,
        date_of_birth: p.dateOfBirth || undefined,
        nationality: p.nationality?.trim() || undefined,
        passport_number: p.passportNumber?.trim() || undefined,
        special_requirements: p.specialRequirements?.trim() || undefined,
        default_type: p.type || 'adult',
      }).then(() => {
        setSavedContactIds(prev => new Set(prev).add(p.id));
        setTimeout(() => {
          setSavedContactIds(prev => {
            const next = new Set(prev);
            next.delete(p.id);
            return next;
          });
        }, 3000);
      }).catch(() => {
        delete savedSnapshots.current[p.id];
      });
    }, 2000);
  }, [isAuthenticated, readonly]);

  useEffect(() => {
    participants.forEach(autoSaveContact);
  }, [participants, autoSaveContact]);

  // Cleanup timers on unmount
  useEffect(() => {
    const timers = saveTimers.current;
    return () => { Object.values(timers).forEach(clearTimeout); };
  }, []);

  // Smart auto-expand: when current participant completes, expand next incomplete one
  const prevCompletionRef = useRef<string[]>([]);
  useEffect(() => {
    const completedIds = participants
      .filter(p => isParticipantComplete(p, requirePassport))
      .map(p => p.id);
    const prevCompleted = prevCompletionRef.current;

    // Find newly completed participants
    const newlyCompleted = completedIds.filter(id => !prevCompleted.includes(id));
    prevCompletionRef.current = completedIds;

    if (newlyCompleted.length > 0) {
      // Find next incomplete participant
      const nextIncomplete = participants.find(
        p => !isParticipantComplete(p, requirePassport) && !expandedIds.includes(p.id)
      );
      if (nextIncomplete) {
        setExpandedIds(prev => [...prev, nextIncomplete.id]);
        setTimeout(() => {
          cardRefs.current[nextIncomplete.id]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
      }
    }
  }, [participants, requirePassport, expandedIds]);

  const toggleExpand = (id: string) => {
    setExpandedIds(prev =>
      prev.includes(id)
        ? prev.filter(i => i !== id)
        : [...prev, id]
    );
  };

  const addParticipant = () => {
    if (participants.length >= maxParticipants) return;

    const newId = `p-${Date.now()}`;
    const newParticipant: ParticipantDetail = {
      ...defaultParticipant,
      id: newId,
    };
    onChange?.([...participants, newParticipant]);
    setExpandedIds(prev => [...prev, newId]);
  };

  const removeParticipant = (id: string) => {
    if (participants.length <= minParticipants) return;
    onChange?.(participants.filter(p => p.id !== id));
    setExpandedIds(prev => prev.filter(i => i !== id));
  };

  const updateParticipant = (id: string, field: keyof ParticipantDetail, value: string) => {
    const idx = participants.findIndex(p => p.id === id);
    if (idx >= 0) onFieldChange?.(idx, field);
    onChange?.(
      participants.map(p =>
        p.id === id ? { ...p, [field]: value } : p
      )
    );
  };

  const handleContactSelect = (contact: UserContact) => {
    if (!pickerTarget) return;
    onChange?.(
      participants.map(p =>
        p.id === pickerTarget ? {
          ...p,
          firstName: contact.first_name,
          lastName: contact.last_name,
          email: contact.email || p.email,
          phone: contact.phone || p.phone,
          dateOfBirth: contact.date_of_birth || p.dateOfBirth,
          nationality: contact.nationality || p.nationality,
          passportNumber: contact.passport_number || p.passportNumber,
          specialRequirements: contact.special_requirements || p.specialRequirements,
          type: contact.default_type || p.type,
        } : p
      )
    );
    setPickerTarget(null);
  };

  const isExpanded = (id: string) => expandedIds.includes(id);

  const getStatusLabel = (p: ParticipantDetail, index: number) => {
    if (errors?.[index] && Object.keys(errors[index]).length > 0) {
      return { text: t('participant.incomplete', 'Incomplete'), className: styles.statusError };
    }
    if (isParticipantComplete(p, requirePassport)) {
      return { text: t('participant.completed', 'Completed'), className: styles.statusDone };
    }
    if (hasAnyField(p)) {
      return { text: t('participant.filling', 'Filling'), className: styles.statusFilling };
    }
    return { text: t('participant.pending', 'Pending'), className: styles.statusPending };
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>
          <User size={20} />
          {t('participant.title')}
        </h3>
        <span className={styles.count}>
          {participants.filter(p => isParticipantComplete(p, requirePassport)).length} / {participants.length} {t('participant.completed', 'completed')}
        </span>
      </div>

      <div className={styles.list}>
        {participants.map((participant, index) => {
          const hasError = errors?.[index] && Object.keys(errors[index]).length > 0;
          const completed = isParticipantComplete(participant, requirePassport);
          const status = getStatusLabel(participant, index);
          const isChild = participant.type === 'child';

          return (
            <div
              key={participant.id}
              ref={el => { cardRefs.current[participant.id] = el; }}
              className={clsx(
                styles.card,
                isExpanded(participant.id) && styles.expanded,
                hasError && styles.hasError,
                completed && styles.completed,
              )}
            >
              <button
                type="button"
                className={styles.cardHeader}
                onClick={() => toggleExpand(participant.id)}
              >
                <div className={styles.cardTitle}>
                  <span className={clsx(
                    styles.number,
                    completed && styles.numberDone,
                    hasError && styles.numberError,
                  )}>
                    {completed ? '✓' : hasError ? '!' : (index + 1)}
                  </span>
                  <span className={styles.name}>
                    {participant.firstName && participant.lastName
                      ? `${participant.firstName} ${participant.lastName}`
                      : t('participant.unnamed')}
                  </span>
                  <span className={clsx(styles.typeBadge, isChild ? styles.typeBadgeChild : styles.typeBadgeAdult)}>
                    {isChild ? t('participant.child', 'Child') : t('participant.adult', 'Adult')}
                  </span>
                </div>
                <div className={styles.cardActions}>
                  {savedContactIds.has(participant.id) && (
                    <span className={styles.savedIndicator}>
                      <Check size={12} />
                      {t('participant.savedToContacts', 'Saved')}
                    </span>
                  )}
                  <span className={clsx(styles.statusBadge, status.className)}>
                    {status.text}
                  </span>
                  {!readonly && participants.length > minParticipants && (
                    <button
                      type="button"
                      className={styles.removeButton}
                      onClick={(e) => {
                        e.stopPropagation();
                        removeParticipant(participant.id);
                      }}
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                  {isExpanded(participant.id) ? (
                    <ChevronUp size={20} />
                  ) : (
                    <ChevronDown size={20} />
                  )}
                </div>
              </button>

              {isExpanded(participant.id) && (
                <div className={styles.cardContent}>
                  {!readonly && isAuthenticated && (
                    <button
                      type="button"
                      className={styles.selectContactBtn}
                      onClick={() => setPickerTarget(participant.id)}
                    >
                      <Users size={14} />
                      {t('contacts.selectContact')}
                    </button>
                  )}

                  {/* Type selector */}
                  {!readonly && (
                    <div className={styles.typeSelector}>
                      <button
                        type="button"
                        className={clsx(styles.typeOption, !isChild && styles.typeOptionSelected)}
                        onClick={() => updateParticipant(participant.id, 'type', 'adult')}
                      >
                        <span className={styles.typeIcon}>🧑</span>
                        <span className={styles.typeLabel}>{t('participant.adult', 'Adult')}</span>
                        <span className={styles.typeDesc}>{t('participant.adultAge', '18+')}</span>
                      </button>
                      <button
                        type="button"
                        className={clsx(styles.typeOption, isChild && styles.typeOptionSelected)}
                        onClick={() => updateParticipant(participant.id, 'type', 'child')}
                      >
                        <span className={styles.typeIcon}>👦</span>
                        <span className={styles.typeLabel}>{t('participant.child', 'Child')}</span>
                        <span className={styles.typeDesc}>{t('participant.childAge', '2-11')}</span>
                      </button>
                    </div>
                  )}

                  {/* Child alert */}
                  {isChild && (
                    <div className={styles.childAlert}>
                      <div className={styles.childAlertTitle}>
                        <AlertTriangle size={16} />
                        {t('participant.childNotice', "Children's Notice")}
                      </div>
                      <ul className={styles.childAlertList}>
                        <li>{t('participant.childAge2to11', 'Must be aged 2-11, bring valid ID')}</li>
                        <li>{t('participant.childAdultRequired', 'Must be accompanied by an adult')}</li>
                        <li>{t('participant.childHeightLimit', 'Some activities have height limits (e.g. ≥110cm)')}</li>
                        <li>{t('participant.childNoteAge', 'Note actual age in special requirements')}</li>
                      </ul>
                    </div>
                  )}

                  <div className={styles.row}>
                    <Input
                      label={t('participant.firstName')}
                      value={participant.firstName}
                      onChange={(e) => updateParticipant(participant.id, 'firstName', e.target.value)}
                      placeholder={t('participant.firstNamePlaceholder')}
                      required
                      disabled={readonly}
                      error={errors?.[index]?.firstName}
                    />
                    <Input
                      label={t('participant.lastName')}
                      value={participant.lastName}
                      onChange={(e) => updateParticipant(participant.id, 'lastName', e.target.value)}
                      placeholder={t('participant.lastNamePlaceholder')}
                      required
                      disabled={readonly}
                      error={errors?.[index]?.lastName}
                    />
                  </div>

                  <div className={styles.row}>
                    <Input
                      label={t('participant.email')}
                      type="email"
                      value={participant.email || ''}
                      onChange={(e) => updateParticipant(participant.id, 'email', e.target.value)}
                      placeholder={t('participant.emailPlaceholder')}
                      required
                      disabled={readonly}
                      error={errors?.[index]?.email}
                    />
                    <Input
                      label={t('participant.phone')}
                      type="tel"
                      value={participant.phone || ''}
                      onChange={(e) => updateParticipant(participant.id, 'phone', e.target.value)}
                      placeholder={t('participant.phonePlaceholder')}
                      required
                      disabled={readonly}
                      error={errors?.[index]?.phone}
                    />
                  </div>

                  <div className={styles.row}>
                    <Input
                      label={t('participant.dateOfBirth')}
                      type="date"
                      value={participant.dateOfBirth || ''}
                      onChange={(e) => updateParticipant(participant.id, 'dateOfBirth', e.target.value)}
                      disabled={readonly}
                    />
                    <Input
                      label={t('participant.nationality')}
                      value={participant.nationality || ''}
                      onChange={(e) => updateParticipant(participant.id, 'nationality', e.target.value)}
                      placeholder={t('participant.nationalityPlaceholder')}
                      disabled={readonly}
                    />
                  </div>

                  {requirePassport && (
                    <Input
                      label={t('participant.passportNumber')}
                      value={participant.passportNumber || ''}
                      onChange={(e) => updateParticipant(participant.id, 'passportNumber', e.target.value)}
                      placeholder={t('participant.passportPlaceholder')}
                      required
                      disabled={readonly}
                      error={errors?.[index]?.passportNumber}
                    />
                  )}

                  <Input
                    label={t('participant.specialRequirements')}
                    value={participant.specialRequirements || ''}
                    onChange={(e) => updateParticipant(participant.id, 'specialRequirements', e.target.value)}
                    placeholder={isChild
                      ? t('participant.childSpecialPlaceholder', 'Note age and height, e.g. 7 years old, 125cm')
                      : t('participant.specialRequirementsPlaceholder')}
                    disabled={readonly}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!readonly && participants.length < maxParticipants && (
        <button
          type="button"
          className={styles.addButton}
          onClick={addParticipant}
        >
          <Plus size={20} />
          {t('participant.add')}
        </button>
      )}

      <ContactPicker
        isOpen={pickerTarget !== null}
        onClose={() => setPickerTarget(null)}
        onSelect={handleContactSelect}
      />
    </div>
  );
};

export default ParticipantForm;
