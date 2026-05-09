/**
 * CreateChannelModal — REQ-20260509-0037 dev-10.
 *
 * Modal triggered by the "+" button in ChannelSidebar. Lets the supplier
 * spin up a new channel: name (required, ≤40), description (≤200), agent
 * member multi-select (≥1 required — first selected becomes default),
 * optional keyword rules (comma-separated). Closes on success or cancel.
 *
 * Backend contract: POST /chat/channels with { name, description,
 * agent_ids, keyword_rules }. The first id in agent_ids is the channel's
 * default responder (handler.go uses req.AgentIDs[0]).
 */
import { useEffect, useId, useMemo, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';

import { useGroupChat } from '../../../contexts/GroupChatContext';
import styles from './CreateChannelModal.module.css';

interface CreateChannelModalProps {
  onClose: () => void;
  onCreated?: (channelId: number) => void;
}

export function CreateChannelModal({ onClose, onCreated }: CreateChannelModalProps) {
  const { t } = useTranslation();
  const { agents, createChannel } = useGroupChat();
  const formId = useId();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [keywordRulesRaw, setKeywordRulesRaw] = useState('');
  const [selectedAgents, setSelectedAgents] = useState<number[]>(() =>
    agents.filter(a => a.default_in_new_channel).map(a => a.id),
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Esc closes the modal.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const canSubmit = useMemo(
    () => name.trim().length > 0 && selectedAgents.length > 0 && !submitting,
    [name, selectedAgents, submitting],
  );

  const toggleAgent = (id: number) => {
    setSelectedAgents(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  };

  // Move an agent to the front of the order so the supplier can pick the
  // default responder explicitly. The leftmost selected agent becomes the
  // channel's default per the backend contract.
  const promoteAsDefault = (id: number) => {
    setSelectedAgents(prev => [id, ...prev.filter(x => x !== id)]);
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const keyword_rules = keywordRulesRaw
        .split(/[,，]/)
        .map(s => s.trim())
        .filter(s => s.length > 0);
      const channel = await createChannel({
        name: name.trim(),
        description: description.trim(),
        agent_ids: selectedAgents,
        keyword_rules,
      });
      onCreated?.(channel.id);
      onClose();
    } catch (err) {
      setError((err as Error).message);
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.overlay} role="presentation" onClick={onClose}>
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${formId}-title`}
        onClick={e => e.stopPropagation()}
      >
        <header className={styles.header}>
          <h2 id={`${formId}-title`} className={styles.title}>
            {t('groupChat.createChannel.title')}
          </h2>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label={t('groupChat.createChannel.close')}
          >
            <X size={16} aria-hidden />
          </button>
        </header>

        <form className={styles.body} onSubmit={onSubmit}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>{t('groupChat.createChannel.nameLabel')}</span>
            <input
              type="text"
              className={styles.input}
              value={name}
              onChange={e => setName(e.target.value)}
              maxLength={40}
              placeholder={t('groupChat.createChannel.namePlaceholder')}
              required
              autoFocus
            />
          </label>

          <label className={styles.field}>
            <span className={styles.fieldLabel}>{t('groupChat.createChannel.descriptionLabel')}</span>
            <input
              type="text"
              className={styles.input}
              value={description}
              onChange={e => setDescription(e.target.value)}
              maxLength={200}
              placeholder={t('groupChat.createChannel.descriptionPlaceholder')}
            />
          </label>

          <fieldset className={styles.field}>
            <legend className={styles.fieldLabel}>
              {t('groupChat.createChannel.agentsLabel')}
              <span className={styles.fieldHint}>{t('groupChat.createChannel.agentsHint')}</span>
            </legend>
            <div className={styles.agentList}>
              {agents.map(a => {
                const checked = selectedAgents.includes(a.id);
                const isDefault = checked && selectedAgents[0] === a.id;
                return (
                  <div key={a.id} className={styles.agentRow}>
                    <label className={styles.agentLabel}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleAgent(a.id)}
                      />
                      <span className={styles.agentDot} style={{ background: a.color_hex || '#94a3b8' }} />
                      <span className={styles.agentName}>
                        {a.avatar_emoji || '🤖'} {a.name}
                      </span>
                    </label>
                    {checked && !isDefault && (
                      <button
                        type="button"
                        className={styles.makeDefault}
                        onClick={() => promoteAsDefault(a.id)}
                      >
                        {t('groupChat.createChannel.makeDefault')}
                      </button>
                    )}
                    {isDefault && (
                      <span className={styles.defaultBadge}>{t('groupChat.createChannel.defaultBadge')}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </fieldset>

          <label className={styles.field}>
            <span className={styles.fieldLabel}>{t('groupChat.createChannel.keywordsLabel')}</span>
            <input
              type="text"
              className={styles.input}
              value={keywordRulesRaw}
              onChange={e => setKeywordRulesRaw(e.target.value)}
              placeholder={t('groupChat.createChannel.keywordsPlaceholder')}
            />
            <span className={styles.fieldHint}>{t('groupChat.createChannel.keywordsHint')}</span>
          </label>

          {error && <div className={styles.error} role="alert">{error}</div>}

          <footer className={styles.footer}>
            <button type="button" className={styles.cancelBtn} onClick={onClose} disabled={submitting}>
              {t('groupChat.createChannel.cancel')}
            </button>
            <button type="submit" className={styles.submitBtn} disabled={!canSubmit}>
              {submitting ? t('groupChat.createChannel.submitting') : t('groupChat.createChannel.submit')}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
