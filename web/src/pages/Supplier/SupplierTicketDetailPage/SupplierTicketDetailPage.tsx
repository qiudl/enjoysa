import React, { useState, useRef, useEffect, lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
const TicketAiAnalysis = lazy(() => import('../../../components/AI/TicketAiAnalysis/TicketAiAnalysis'));
import {
  ArrowLeft,
  Send,
  Paperclip,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  FileText,
  Lock,
  ThumbsUp,
  ThumbsDown,
} from 'lucide-react';
import styles from './SupplierTicketDetailPage.module.css';

/* ------------------------------------------------------------------ */
/*  Data models                                                        */
/* ------------------------------------------------------------------ */

type MessageType = 'customer_message' | 'staff_reply' | 'system_event' | 'internal_note';

interface TicketMessage {
  id: string;
  type: MessageType;
  content: string;
  author: string;
  authorRole: 'customer' | 'staff' | 'system';
  createdAt: string;
  attachments?: { name: string; type: string }[];
}

interface RefundApproval {
  amount: number;
  currency: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'executed';
  approver?: string;
  approvedAt?: string;
  rejectionReason?: string;
}

interface TicketDetail {
  id: string;
  ticketNo: string;
  type: 'refund' | 'complaint' | 'exchange';
  status: 'pending' | 'processing' | 'resolved' | 'rejected';
  customer: string;
  customerEmail: string;
  product: string;
  productEn: string;
  amount: number;
  slaHoursLeft: number;
  createdAt: string;
  description: string;
  messages: TicketMessage[];
  refundApproval?: RefundApproval;
}

/* ------------------------------------------------------------------ */
/*  Mock data                                                          */
/* ------------------------------------------------------------------ */

const mockTicket: TicketDetail = {
  id: 't1',
  ticketNo: 'AS-20260320-001',
  type: 'refund',
  status: 'processing',
  customer: 'Alice Wang',
  customerEmail: 'alice.wang@example.com',
  product: '\u888b\u9f20\u5c9b\u4e00\u65e5\u6e38',
  productEn: 'Kangaroo Island Day Tour',
  amount: 398,
  slaHoursLeft: 18,
  createdAt: '2026-03-20 14:30',
  description: 'Weather cancellation, requesting full refund',
  messages: [
    {
      id: 'm1',
      type: 'customer_message',
      content:
        'Hi, I booked the Kangaroo Island Day Tour for March 22 but the weather forecast says there will be a severe storm. I would like to request a full refund please.',
      author: 'Alice Wang',
      authorRole: 'customer',
      createdAt: '2026-03-20 14:30',
      attachments: [
        { name: 'booking_confirmation.pdf', type: 'pdf' },
        { name: 'weather_alert.png', type: 'image' },
      ],
    },
    {
      id: 'm2',
      type: 'system_event',
      content: 'Ticket created. Status changed to Pending.',
      author: 'System',
      authorRole: 'system',
      createdAt: '2026-03-20 14:30',
    },
    {
      id: 'm3',
      type: 'staff_reply',
      content:
        'Hello Alice, thank you for reaching out. I can see your booking and I am checking the weather advisory for that date. We will get back to you shortly with a resolution.',
      author: 'Sarah (Support)',
      authorRole: 'staff',
      createdAt: '2026-03-20 15:10',
    },
    {
      id: 'm4',
      type: 'internal_note',
      content:
        'Verified BOM severe weather warning for Kangaroo Island on March 22. Tour operator has confirmed cancellation. Eligible for full refund per our weather policy.',
      author: 'Sarah (Support)',
      authorRole: 'staff',
      createdAt: '2026-03-20 15:45',
    },
    {
      id: 'm5',
      type: 'system_event',
      content: 'Status changed from Pending to Processing.',
      author: 'System',
      authorRole: 'system',
      createdAt: '2026-03-20 15:46',
    },
    {
      id: 'm6',
      type: 'staff_reply',
      content:
        'Hi Alice, we have confirmed the severe weather warning and the tour operator has cancelled the tour. I have initiated a full refund of AUD $398.00. You should see it within 3-5 business days.',
      author: 'Sarah (Support)',
      authorRole: 'staff',
      createdAt: '2026-03-20 16:00',
      attachments: [{ name: 'refund_receipt.pdf', type: 'pdf' }],
    },
  ],
  refundApproval: {
    amount: 398,
    currency: 'AUD',
    reason: 'Severe weather cancellation - full refund per policy',
    status: 'pending',
  },
};

/* ------------------------------------------------------------------ */
/*  Helper maps                                                        */
/* ------------------------------------------------------------------ */

const typeColors: Record<string, string> = {
  refund: '#ef4444',
  complaint: '#f59e0b',
  exchange: '#3b82f6',
};

const statusStyleMap: Record<string, { bg: string; color: string }> = {
  pending: { bg: '#fef3c7', color: '#d97706' },
  processing: { bg: '#dbeafe', color: '#2563eb' },
  resolved: { bg: '#ecfdf5', color: '#059669' },
  rejected: { bg: '#fef2f2', color: '#dc2626' },
};

const approvalStatusStyleMap: Record<string, { bg: string; color: string }> = {
  pending: { bg: '#fef3c7', color: '#d97706' },
  approved: { bg: '#ecfdf5', color: '#059669' },
  rejected: { bg: '#fef2f2', color: '#dc2626' },
  executed: { bg: '#dbeafe', color: '#2563eb' },
};

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

export interface SupplierTicketDetailPageProps {
  ticketId?: string;
  onNavigate?: (path: string) => void;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export const SupplierTicketDetailPage: React.FC<SupplierTicketDetailPageProps> = ({
  onNavigate,
}) => {
  const { t, i18n } = useTranslation();

  // -- State -------------------------------------------------------
  const [ticket, setTicket] = useState<TicketDetail>({ ...mockTicket });
  const [replyText, setReplyText] = useState('');
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const timelineEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll when messages change
  useEffect(() => {
    timelineEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [ticket.messages.length]);

  // -- Handlers ----------------------------------------------------
  const handleSend = () => {
    const text = replyText.trim();
    if (!text) return;

    const newMsg: TicketMessage = {
      id: `m${Date.now()}`,
      type: isInternalNote ? 'internal_note' : 'staff_reply',
      content: text,
      author: 'You (Staff)',
      authorRole: 'staff',
      createdAt: new Date().toLocaleString('sv-SE', { hour12: false }).replace('T', ' ').slice(0, 16),
    };

    setTicket((prev) => ({
      ...prev,
      messages: [...prev.messages, newMsg],
    }));
    setReplyText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleApprove = () => {
    if (!ticket.refundApproval) return;
    setTicket((prev) => ({
      ...prev,
      refundApproval: prev.refundApproval
        ? {
            ...prev.refundApproval,
            status: 'approved',
            approver: 'You (Staff)',
            approvedAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
          }
        : undefined,
    }));
    setShowRejectInput(false);
  };

  const handleReject = () => {
    if (!ticket.refundApproval || !rejectReason.trim()) return;
    setTicket((prev) => ({
      ...prev,
      refundApproval: prev.refundApproval
        ? {
            ...prev.refundApproval,
            status: 'rejected',
            rejectionReason: rejectReason.trim(),
          }
        : undefined,
    }));
    setShowRejectInput(false);
    setRejectReason('');
  };

  // -- Collect all attachments from messages -----------------------
  const allAttachments = ticket.messages.reduce<{ name: string; type: string; messageId: string }[]>(
    (acc, msg) => {
      if (msg.attachments) {
        msg.attachments.forEach((att) => acc.push({ ...att, messageId: msg.id }));
      }
      return acc;
    },
    [],
  );

  // -- Approval status label key -----------------------------------
  const approvalStatusKey = (status: string) => {
    const map: Record<string, string> = {
      pending: 'supplier.ticket.statusPending',
      approved: 'supplier.ticket.statusApproved',
      rejected: 'supplier.ticket.statusRejected',
      executed: 'supplier.ticket.statusExecuted',
    };
    return map[status] || status;
  };

  // -- Render helpers ---------------------------------------------
  const renderMessage = (msg: TicketMessage) => {
    if (msg.type === 'system_event') {
      return (
        <div key={msg.id} className={`${styles.message} ${styles.messageSystem}`}>
          <div className={styles.systemLine}>
            <span className={styles.systemIcon}>
              <AlertTriangle size={12} />
            </span>
            <span className={styles.systemText}>
              {t('supplier.ticket.messageSystem')}: {msg.content}
            </span>
          </div>
          <span className={styles.messageTime}>{msg.createdAt}</span>
        </div>
      );
    }

    const isCustomer = msg.type === 'customer_message';
    const isNote = msg.type === 'internal_note';

    const bubbleClass = isCustomer
      ? styles.messageCustomer
      : isNote
        ? styles.messageNote
        : styles.messageStaff;

    return (
      <div key={msg.id} className={`${styles.message} ${bubbleClass}`}>
        <div className={styles.messageMeta}>
          <span className={styles.messageAuthor}>{msg.author}</span>
          {isNote && (
            <span className={styles.internalBadge}>
              <Lock size={10} />
              {t('supplier.ticket.internal')}
            </span>
          )}
          <span className={styles.messageTime}>{msg.createdAt}</span>
        </div>
        <div className={styles.messageBubble}>{msg.content}</div>
        {msg.attachments && msg.attachments.length > 0 && (
          <div className={styles.messageAttachments}>
            {msg.attachments.map((att, idx) => (
              <span key={idx} className={styles.attachmentBadge}>
                <FileText size={12} />
                {att.name}
              </span>
            ))}
          </div>
        )}
      </div>
    );
  };

  // -- Main render -------------------------------------------------
  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <button
          className={styles.backBtn}
          onClick={() => onNavigate?.('/supplier/after-sales')}
          title={t('supplier.ticket.backToList')}
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className={styles.ticketTitle}>{ticket.ticketNo}</h1>
      </div>

      {/* Content: left timeline + right info */}
      <div className={styles.content}>
        {/* Left: Timeline & Reply */}
        <div className={styles.timelineSection}>
          <h2 className={styles.sectionTitle}>{t('supplier.ticket.timeline')}</h2>

          {/* AI Analysis */}
          {ticket.messages.length > 0 && (
            <Suspense fallback={null}>
              <TicketAiAnalysis
                message={ticket.messages[0]?.content || ''}
                ticketId={ticket.id}
              />
            </Suspense>
          )}

          <div className={styles.timelineList}>
            {ticket.messages.map(renderMessage)}
            <div ref={timelineEndRef} />
          </div>

          {/* Reply Area */}
          <div className={styles.replyArea}>
            <textarea
              className={styles.replyInput}
              placeholder={t('supplier.ticket.replyPlaceholder')}
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={3}
            />
            <div className={styles.replyToolbar}>
              <label className={styles.noteCheckbox}>
                <input
                  type="checkbox"
                  checked={isInternalNote}
                  onChange={(e) => setIsInternalNote(e.target.checked)}
                />
                <Lock size={12} />
                <span>{t('supplier.ticket.internalNote')}</span>
              </label>
              <div className={styles.replyActions}>
                <button className={styles.attachBtn} title={t('supplier.ticket.attachFile')}>
                  <Paperclip size={16} />
                </button>
                <button
                  className={styles.sendBtn}
                  onClick={handleSend}
                  disabled={!replyText.trim()}
                >
                  <Send size={14} />
                  {t('supplier.ticket.send')}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Info Cards */}
        <div className={styles.infoSection}>
          {/* Ticket Info Card */}
          <div className={styles.infoCard}>
            <h3 className={styles.cardTitle}>{t('supplier.ticket.ticketInfo')}</h3>

            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>{t('supplier.ticket.status')}</span>
              <span
                className={styles.statusBadge}
                style={{
                  backgroundColor: statusStyleMap[ticket.status]?.bg,
                  color: statusStyleMap[ticket.status]?.color,
                }}
              >
                {ticket.status === 'pending' && <Clock size={12} />}
                {ticket.status === 'processing' && <Clock size={12} />}
                {ticket.status === 'resolved' && <CheckCircle size={12} />}
                {ticket.status === 'rejected' && <XCircle size={12} />}
                {ticket.status.charAt(0).toUpperCase() + ticket.status.slice(1)}
              </span>
            </div>

            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>{t('supplier.ticket.type')}</span>
              <span
                className={styles.typeBadge}
                style={{
                  backgroundColor: `${typeColors[ticket.type]}15`,
                  color: typeColors[ticket.type],
                }}
              >
                {ticket.type.charAt(0).toUpperCase() + ticket.type.slice(1)}
              </span>
            </div>

            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>{t('supplier.ticket.customer')}</span>
              <span className={styles.infoValue}>{ticket.customer}</span>
            </div>

            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>{t('supplier.ticket.email')}</span>
              <span className={styles.infoValueEmail}>{ticket.customerEmail}</span>
            </div>

            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>{t('supplier.ticket.product')}</span>
              <span className={styles.infoValue}>
                {i18n.language === 'en' ? ticket.productEn : ticket.product}
              </span>
            </div>

            {ticket.type === 'refund' && ticket.amount > 0 && (
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>{t('supplier.ticket.amount')}</span>
                <span className={styles.infoValueAmount}>AUD ${ticket.amount.toFixed(2)}</span>
              </div>
            )}

            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>{t('supplier.ticket.slaRemaining')}</span>
              <span
                className={`${styles.slaBadge} ${ticket.slaHoursLeft <= 4 ? styles.slaUrgent : ''}`}
              >
                <Clock size={12} />
                {ticket.slaHoursLeft}h
              </span>
            </div>

            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>{t('supplier.ticket.created')}</span>
              <span className={styles.infoValueMuted}>{ticket.createdAt}</span>
            </div>
          </div>

          {/* Refund Approval Card */}
          {ticket.type === 'refund' && ticket.refundApproval && (
            <div className={`${styles.infoCard} ${styles.refundCard}`}>
              <h3 className={styles.cardTitle}>{t('supplier.ticket.refundApproval')}</h3>

              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>{t('supplier.ticket.refundAmount')}</span>
                <span className={styles.infoValueAmount}>
                  {ticket.refundApproval.currency} ${ticket.refundApproval.amount.toFixed(2)}
                </span>
              </div>

              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>{t('supplier.ticket.refundReason')}</span>
                <span className={styles.infoValue}>{ticket.refundApproval.reason}</span>
              </div>

              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>{t('supplier.ticket.refundStatus')}</span>
                <span
                  className={styles.statusBadge}
                  style={{
                    backgroundColor: approvalStatusStyleMap[ticket.refundApproval.status]?.bg,
                    color: approvalStatusStyleMap[ticket.refundApproval.status]?.color,
                  }}
                >
                  {t(approvalStatusKey(ticket.refundApproval.status))}
                </span>
              </div>

              {ticket.refundApproval.approver && (
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>{t('supplier.ticket.approver')}</span>
                  <span className={styles.infoValue}>{ticket.refundApproval.approver}</span>
                </div>
              )}

              {ticket.refundApproval.approvedAt && (
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>{t('supplier.ticket.approvedAt')}</span>
                  <span className={styles.infoValueMuted}>{ticket.refundApproval.approvedAt}</span>
                </div>
              )}

              {ticket.refundApproval.rejectionReason && (
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>{t('supplier.ticket.rejectReason')}</span>
                  <span className={styles.infoValueReject}>
                    {ticket.refundApproval.rejectionReason}
                  </span>
                </div>
              )}

              {/* Action buttons when pending */}
              {ticket.refundApproval.status === 'pending' && (
                <div className={styles.approvalActions}>
                  {!showRejectInput ? (
                    <>
                      <button className={styles.approveBtn} onClick={handleApprove}>
                        <ThumbsUp size={14} />
                        {t('supplier.ticket.approve')}
                      </button>
                      <button
                        className={styles.rejectBtn}
                        onClick={() => setShowRejectInput(true)}
                      >
                        <ThumbsDown size={14} />
                        {t('supplier.ticket.reject')}
                      </button>
                    </>
                  ) : (
                    <div className={styles.rejectInputArea}>
                      <textarea
                        className={styles.rejectReasonInput}
                        placeholder={t('supplier.ticket.rejectReasonPlaceholder')}
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        rows={2}
                      />
                      <div className={styles.rejectBtnRow}>
                        <button
                          className={styles.rejectConfirmBtn}
                          onClick={handleReject}
                          disabled={!rejectReason.trim()}
                        >
                          {t('supplier.ticket.reject')}
                        </button>
                        <button
                          className={styles.rejectCancelBtn}
                          onClick={() => {
                            setShowRejectInput(false);
                            setRejectReason('');
                          }}
                        >
                          {t('supplier.ticket.cancel')}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Attachments Card */}
          {allAttachments.length > 0 && (
            <div className={styles.infoCard}>
              <h3 className={styles.cardTitle}>
                {t('supplier.ticket.attachments')} ({allAttachments.length})
              </h3>
              <div className={styles.attachmentList}>
                {allAttachments.map((att, idx) => (
                  <div key={idx} className={styles.attachmentItem}>
                    <FileText size={14} />
                    <span className={styles.attachmentName}>{att.name}</span>
                    <span className={styles.attachmentType}>{att.type.toUpperCase()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SupplierTicketDetailPage;
