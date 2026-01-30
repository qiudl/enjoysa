import React, { useEffect, useState } from 'react';
import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-react';
import clsx from 'clsx';
import styles from './Toast.module.css';

export interface ToastProps {
  /** Toast ID */
  id?: string;
  /** 类型 */
  type?: 'success' | 'error' | 'warning' | 'info';
  /** 标题 */
  title?: string;
  /** 消息内容 */
  message: string;
  /** 持续时间(ms)，0表示不自动关闭 */
  duration?: number;
  /** 是否显示关闭按钮 */
  closable?: boolean;
  /** 位置 */
  position?: 'top' | 'top-right' | 'top-left' | 'bottom' | 'bottom-right' | 'bottom-left';
  /** 关闭回调 */
  onClose?: () => void;
}

const iconMap = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertCircle,
  info: Info,
};

export const Toast: React.FC<ToastProps> = ({
  type = 'info',
  title,
  message,
  duration = 3000,
  closable = true,
  position = 'top-right',
  onClose,
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const [isLeaving, setIsLeaving] = useState(false);

  const Icon = iconMap[type];

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        handleClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [duration]);

  const handleClose = () => {
    setIsLeaving(true);
    setTimeout(() => {
      setIsVisible(false);
      onClose?.();
    }, 300);
  };

  if (!isVisible) return null;

  return (
    <div
      className={clsx(
        styles.toast,
        styles[type],
        styles[position],
        isLeaving && styles.leaving
      )}
      role="alert"
    >
      <div className={styles.iconWrapper}>
        <Icon size={20} />
      </div>
      <div className={styles.content}>
        {title && <h4 className={styles.title}>{title}</h4>}
        <p className={styles.message}>{message}</p>
      </div>
      {closable && (
        <button className={styles.closeButton} onClick={handleClose}>
          <X size={16} />
        </button>
      )}
    </div>
  );
};

// Toast Container for managing multiple toasts
export interface ToastItem extends ToastProps {
  id: string;
}

export interface ToastContainerProps {
  toasts: ToastItem[];
  position?: 'top' | 'top-right' | 'top-left' | 'bottom' | 'bottom-right' | 'bottom-left';
  onRemove: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({
  toasts,
  position = 'top-right',
  onRemove,
}) => {
  return (
    <div className={clsx(styles.container, styles[`container${position.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join('')}`])}>
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          {...toast}
          position={position}
          onClose={() => onRemove(toast.id)}
        />
      ))}
    </div>
  );
};

export default Toast;
