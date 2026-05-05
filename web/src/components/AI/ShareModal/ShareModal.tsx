import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import Modal from '../../Common/Modal/Modal';
import { useAdminAuth } from '../../../contexts/AdminAuthContext';
import { shareMessages } from '../../../services/chatService';
import type { ShareMessagesResult } from '../../../services/chatService';
import type { UserType } from '../../../services/api';
import styles from './ShareModal.module.css';

export interface ShareModalMessage {
  id: number;
  role: 'user' | 'assistant' | string;
  content: string;
}

interface ShareModalProps {
  open: boolean;
  sessionId: number;
  messages: ShareModalMessage[];
  initiallySelectedIds: number[];
  userType: UserType;
  onClose: () => void;
  onSuccess: (result: ShareMessagesResult) => void;
}

const previewExcerpt = (s: string, n: number) => {
  if (!s) return '';
  return s.length > n ? s.slice(0, n) + '…' : s;
};

export const ShareModal: React.FC<ShareModalProps> = ({
  open,
  sessionId,
  messages,
  initiallySelectedIds,
  userType,
  onClose,
  onSuccess,
}) => {
  const { t } = useTranslation();
  const { admin } = useAdminAuth();
  const isAdmin = userType === 'admin' && !!admin;

  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set(initiallySelectedIds));
  const [note, setNote] = useState('');
  const [addToKB, setAddToKB] = useState<boolean>(isAdmin);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setSelectedIds(new Set(initiallySelectedIds));
      setNote('');
      setAddToKB(isAdmin);
      setError(null);
    }
  }, [open, initiallySelectedIds, isAdmin]);

  const toggle = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const orderedSelected = useMemo(() => messages.filter(m => selectedIds.has(m.id)), [messages, selectedIds]);

  const previewQ = useMemo(() => orderedSelected.find(m => m.role === 'user')?.content ?? '', [orderedSelected]);
  const previewA = useMemo(
    () => orderedSelected.filter(m => m.role === 'assistant').map(m => m.content).join('\n\n'),
    [orderedSelected],
  );

  const canSubmit = orderedSelected.length > 0 && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await shareMessages({
        session_id: sessionId,
        message_ids: orderedSelected.map(m => m.id),
        add_to_knowledge_base: addToKB && isAdmin,
        note: note.trim() || undefined,
      }, userType);
      if (result?.success) {
        onSuccess(result);
        onClose();
      } else {
        setError(result?.error_message || t('aiPanel.share.failure', { defaultValue: '发送失败，请重试' }) as string);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      title={t('aiPanel.share.modalTitle', { defaultValue: '分享到飞书运营群' }) as string}
      size="lg"
      okText={t('aiPanel.share.send', { defaultValue: '发送到飞书' }) as string}
      cancelText={t('aiPanel.share.cancel', { defaultValue: '取消' }) as string}
      confirmLoading={submitting}
      onClose={onClose}
      onOk={handleSubmit}
    >
      <div className={styles.body}>
        <div className={styles.col}>
          <div className={styles.colTitle}>
            {t('aiPanel.share.selectMessages', { defaultValue: '选择消息' })} ({orderedSelected.length} / {messages.length})
          </div>
          <div className={styles.list}>
            {messages.length === 0 && (
              <div className={styles.empty}>{t('aiPanel.share.empty', { defaultValue: '暂无可分享消息' })}</div>
            )}
            {messages.map(m => (
              <label key={m.id} className={styles.row}>
                <input
                  type="checkbox"
                  checked={selectedIds.has(m.id)}
                  onChange={() => toggle(m.id)}
                />
                <span>
                  <span className={clsx(styles.role, m.role === 'assistant' && styles.roleAssistant)}>
                    {m.role === 'user' ? 'Q' : m.role === 'assistant' ? 'A' : m.role}
                  </span>
                  {previewExcerpt(m.content, 140)}
                </span>
              </label>
            ))}
          </div>

          <div>
            <div className={styles.colTitle}>{t('aiPanel.share.note', { defaultValue: '备注（可选）' })}</div>
            <textarea
              className={styles.note}
              value={note}
              onChange={e => setNote(e.target.value)}
              maxLength={500}
              placeholder={t('aiPanel.share.notePlaceholder', { defaultValue: '给同事的简短说明...' }) as string}
            />
            {isAdmin && (
              <label className={styles.kbCheckbox}>
                <input
                  type="checkbox"
                  checked={addToKB}
                  onChange={e => setAddToKB(e.target.checked)}
                />
                {t('aiPanel.share.addToKB', { defaultValue: '同步入平台知识库（admin）' })}
              </label>
            )}
          </div>
        </div>

        <div className={styles.col}>
          <div className={styles.colTitle}>{t('aiPanel.share.preview', { defaultValue: '飞书卡片预览' })}</div>
          <div className={styles.preview}>
            <div className={styles.previewSection}>
              <div className={styles.previewLabel}>🙋 {t('aiPanel.share.question', { defaultValue: '问题' })}</div>
              {previewQ || '—'}
            </div>
            <div className={styles.previewSection}>
              <div className={styles.previewLabel}>🤖 {t('aiPanel.share.answer', { defaultValue: 'AI 答复' })}</div>
              {previewExcerpt(previewA, 800) || '—'}
            </div>
            {note && (
              <div className={styles.previewSection}>
                <div className={styles.previewLabel}>📝 {t('aiPanel.share.note', { defaultValue: '备注' })}</div>
                {note}
              </div>
            )}
          </div>
          {error && <div className={styles.error}>{error}</div>}
        </div>
      </div>
    </Modal>
  );
};

export default ShareModal;
