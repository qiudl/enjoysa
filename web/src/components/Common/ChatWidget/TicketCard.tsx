import React, { useState } from 'react';
import { Ticket, AlertCircle, CheckCircle, Clock, Send } from 'lucide-react';
import { createTicket } from '../../../services/chatService';
import styles from './ChatWidget.module.css';

interface TicketCardProps {
  onCreated?: (ticketNo: string) => void;
  defaultType?: string;
  defaultSubject?: string;
}

const TICKET_TYPES = [
  { value: 'refund', label: '退款申请' },
  { value: 'exchange', label: '退换货' },
  { value: 'complaint', label: '投诉' },
  { value: 'inquiry', label: '咨询' },
];

export const TicketCard: React.FC<TicketCardProps> = ({ onCreated, defaultType, defaultSubject }) => {
  const [type, setType] = useState(defaultType || 'inquiry');
  const [subject, setSubject] = useState(defaultSubject || '');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ticketNo: string } | null>(null);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!subject.trim()) {
      setError('请填写问题标题');
      return;
    }
    setSubmitting(true);
    setError('');

    const ticket = await createTicket({ type, subject, description });
    setSubmitting(false);

    if (ticket) {
      setResult({ ticketNo: ticket.ticket_no });
      onCreated?.(ticket.ticket_no);
    } else {
      setError('创建失败，请稍后重试');
    }
  };

  if (result) {
    return (
      <div className={styles.ticketCard}>
        <div className={styles.ticketSuccess}>
          <CheckCircle size={20} color="#22c55e" />
          <div>
            <strong>工单已创建</strong>
            <p>工单号：{result.ticketNo}</p>
            <p className={styles.ticketHint}>我们会尽快处理，退款类工单预计 3-5 个工作日</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.ticketCard}>
      <div className={styles.ticketHeader}>
        <Ticket size={16} />
        <span>创建售后工单</span>
      </div>

      <div className={styles.ticketForm}>
        <div className={styles.ticketField}>
          <label>问题类型</label>
          <div className={styles.ticketTypes}>
            {TICKET_TYPES.map(t => (
              <button
                key={t.value}
                className={`${styles.typeBtn} ${type === t.value ? styles.typeBtnActive : ''}`}
                onClick={() => setType(t.value)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.ticketField}>
          <label>问题标题</label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="简要描述您的问题"
            maxLength={200}
          />
        </div>

        <div className={styles.ticketField}>
          <label>详细描述（可选）</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="请详细描述问题..."
            rows={3}
          />
        </div>

        {error && (
          <div className={styles.ticketError}>
            <AlertCircle size={14} />
            {error}
          </div>
        )}

        <button
          className={styles.ticketSubmit}
          onClick={handleSubmit}
          disabled={submitting || !subject.trim()}
        >
          {submitting ? <Clock size={14} /> : <Send size={14} />}
          {submitting ? '提交中...' : '提交工单'}
        </button>
      </div>
    </div>
  );
};
