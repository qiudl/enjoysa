import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import type { Settlement } from '../../../pages/Supplier/SupplierSettlementPage/SupplierSettlementPage';
import styles from './DisputeModal.module.css';

interface Props {
  settlement: Settlement;
  onClose: () => void;
  onSubmit: (settlementId: string, reason: string, amount: number) => void;
}

export const DisputeModal: React.FC<Props> = ({ settlement, onClose, onSubmit }) => {
  const { t } = useTranslation();
  const [reason, setReason] = useState('');
  const [amount, setAmount] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = () => {
    if (!reason.trim()) return;
    const disputeAmount = parseFloat(amount) || 0;
    onSubmit(settlement.id, reason, disputeAmount);
    setSubmitted(true);
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <span className={styles.title}>{t('supplier.settlement.dispute.title')}</span>
          <button className={styles.closeBtn} onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {submitted ? (
          <div className={styles.success}>
            <div className={styles.successIcon}>✅</div>
            <div className={styles.successText}>{t('supplier.settlement.dispute.submitted')}</div>
            <div className={styles.successSub}>{t('supplier.settlement.dispute.submittedDesc')}</div>
          </div>
        ) : (
          <>
            <div className={styles.body}>
              <div className={styles.field}>
                <label className={styles.label}>
                  {t('supplier.settlement.period')}: {settlement.period}
                </label>
              </div>
              <div className={styles.field}>
                <label className={styles.label}>{t('supplier.settlement.dispute.amount')}</label>
                <input
                  type="number"
                  className={styles.input}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder={`${t('supplier.settlement.netAmount')}: ¥${settlement.netAmount.toLocaleString()}`}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>{t('supplier.settlement.dispute.reason')} *</label>
                <textarea
                  className={styles.textarea}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={t('supplier.settlement.dispute.reasonPlaceholder')}
                />
              </div>
            </div>
            <div className={styles.footer}>
              <button className={styles.cancelBtn} onClick={onClose}>
                {t('common.cancel')}
              </button>
              <button
                className={styles.submitBtn}
                onClick={handleSubmit}
                disabled={!reason.trim()}
              >
                {t('supplier.settlement.dispute.submit')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default DisputeModal;
