import React, { useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import clsx from 'clsx';
import styles from './Modal.module.css';

export interface ModalProps {
  /** 是否显示 */
  open: boolean;
  /** 标题 */
  title?: string;
  /** 标题英文 */
  titleEn?: string;
  /** 尺寸 */
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  /** 是否显示关闭按钮 */
  closable?: boolean;
  /** 是否显示遮罩 */
  showOverlay?: boolean;
  /** 点击遮罩是否关闭 */
  closeOnOverlayClick?: boolean;
  /** 按 ESC 是否关闭 */
  closeOnEsc?: boolean;
  /** 是否居中显示 */
  centered?: boolean;
  /** 自定义页脚 */
  footer?: React.ReactNode;
  /** 隐藏页脚 */
  hideFooter?: boolean;
  /** 确认按钮文本 */
  okText?: string;
  /** 取消按钮文本 */
  cancelText?: string;
  /** 确认按钮加载状态 */
  confirmLoading?: boolean;
  /** 语言 */
  language?: 'zh' | 'en';
  /** 子元素 */
  children: React.ReactNode;
  /** 关闭回调 */
  onClose: () => void;
  /** 确认回调 */
  onOk?: () => void;
  /** 取消回调 */
  onCancel?: () => void;
}

export const Modal: React.FC<ModalProps> = ({
  open,
  title,
  titleEn,
  size = 'md',
  closable = true,
  showOverlay = true,
  closeOnOverlayClick = true,
  closeOnEsc = true,
  centered = true,
  footer,
  hideFooter = false,
  okText,
  cancelText,
  confirmLoading = false,
  language,
  children,
  onClose,
  onOk,
  onCancel,
}) => {
  const { i18n } = useTranslation();
  const isZh = language ? language === 'zh' : (i18n.language === 'zh' || i18n.language === 'zh-CN');

  const displayTitle = isZh ? title : (titleEn || title);
  const displayOkText = okText || (isZh ? '确定' : 'OK');
  const displayCancelText = cancelText || (isZh ? '取消' : 'Cancel');

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape' && closeOnEsc) {
      onClose();
    }
  }, [closeOnEsc, onClose]);

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [open, handleKeyDown]);

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && closeOnOverlayClick) {
      onClose();
    }
  };

  const handleCancel = () => {
    onCancel?.();
    onClose();
  };

  if (!open) return null;

  const defaultFooter = (
    <>
      <button className={styles.cancelButton} onClick={handleCancel}>
        {displayCancelText}
      </button>
      <button
        className={styles.okButton}
        onClick={onOk}
        disabled={confirmLoading}
      >
        {confirmLoading && <span className={styles.spinner} />}
        {displayOkText}
      </button>
    </>
  );

  return (
    <div
      className={clsx(styles.overlay, !showOverlay && styles.transparent)}
      onClick={handleOverlayClick}
    >
      <div
        className={clsx(
          styles.modal,
          styles[size],
          centered && styles.centered
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-title' : undefined}
      >
        {/* Header */}
        {(title || closable) && (
          <div className={styles.header}>
            {displayTitle && (
              <h2 id="modal-title" className={styles.title}>
                {displayTitle}
              </h2>
            )}
            {closable && (
              <button className={styles.closeButton} onClick={onClose}>
                <X size={20} />
              </button>
            )}
          </div>
        )}

        {/* Body */}
        <div className={styles.body}>
          {children}
        </div>

        {/* Footer */}
        {!hideFooter && (
          <div className={styles.footer}>
            {footer !== undefined ? footer : defaultFooter}
          </div>
        )}
      </div>
    </div>
  );
};

// Confirm Modal
export interface ConfirmModalProps {
  open: boolean;
  type?: 'info' | 'success' | 'warning' | 'danger';
  title: string;
  titleEn?: string;
  message: string;
  messageEn?: string;
  okText?: string;
  cancelText?: string;
  confirmLoading?: boolean;
  language?: 'zh' | 'en';
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  open,
  type = 'info',
  title,
  titleEn,
  message,
  messageEn,
  okText,
  cancelText,
  confirmLoading,
  language,
  onConfirm,
  onCancel,
}) => {
  const { i18n } = useTranslation();
  const isZh = language ? language === 'zh' : (i18n.language === 'zh' || i18n.language === 'zh-CN');

  const displayMessage = isZh ? message : (messageEn || message);

  return (
    <Modal
      open={open}
      title={title}
      titleEn={titleEn}
      size="sm"
      okText={okText}
      cancelText={cancelText}
      confirmLoading={confirmLoading}
      language={language}
      onClose={onCancel}
      onOk={onConfirm}
      onCancel={onCancel}
    >
      <div className={clsx(styles.confirmContent, styles[`confirm${type.charAt(0).toUpperCase() + type.slice(1)}`])}>
        <p className={styles.confirmMessage}>{displayMessage}</p>
      </div>
    </Modal>
  );
};

export default Modal;
