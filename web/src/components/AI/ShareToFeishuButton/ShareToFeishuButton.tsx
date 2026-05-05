import React from 'react';
import { useTranslation } from 'react-i18next';
import { Share2 } from 'lucide-react';
import clsx from 'clsx';
import styles from './ShareToFeishuButton.module.css';

interface ShareToFeishuButtonProps {
  visible: boolean;          // hover state from the parent message bubble
  onClick: () => void;
  disabled?: boolean;
}

export const ShareToFeishuButton: React.FC<ShareToFeishuButtonProps> = ({ visible, onClick, disabled }) => {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      className={clsx(styles.btn, visible && styles.btnVisible)}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      disabled={disabled}
      title={t('aiPanel.share.button', { defaultValue: '分享到飞书' }) as string}
      aria-label={t('aiPanel.share.button', { defaultValue: '分享到飞书' }) as string}
    >
      <Share2 size={12} />
    </button>
  );
};

export default ShareToFeishuButton;
