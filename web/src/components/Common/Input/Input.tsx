import React, { forwardRef, useState } from 'react';
import clsx from 'clsx';
import { Eye, EyeOff } from 'lucide-react';
import styles from './Input.module.css';

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  /** 标签 */
  label?: string;
  /** 错误信息 */
  error?: string;
  /** 帮助文本 */
  helperText?: string;
  /** 输入框尺寸 */
  size?: 'sm' | 'md' | 'lg';
  /** 左侧图标 */
  leftIcon?: React.ReactNode;
  /** 右侧图标或操作 */
  rightElement?: React.ReactNode;
  /** 是否显示清除按钮 */
  clearable?: boolean;
  /** 清除时的回调 */
  onClear?: () => void;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      helperText,
      size = 'md',
      leftIcon,
      rightElement,
      clearable = false,
      onClear,
      type = 'text',
      className,
      disabled,
      value,
      ...props
    },
    ref
  ) => {
    const [showPassword, setShowPassword] = useState(false);
    const isPassword = type === 'password';
    const inputType = isPassword && showPassword ? 'text' : type;

    const handleClear = () => {
      onClear?.();
    };

    const showClearButton = clearable && value && !disabled;

    return (
      <div className={clsx(styles.wrapper, className)}>
        {label && (
          <label className={styles.label}>
            {label}
            {props.required && <span className={styles.required}>*</span>}
          </label>
        )}
        <div
          className={clsx(styles.inputWrapper, styles[size], {
            [styles.error]: !!error,
            [styles.disabled]: disabled,
            [styles.hasLeftIcon]: !!leftIcon,
            [styles.hasRightElement]: !!rightElement || isPassword || showClearButton,
          })}
        >
          {leftIcon && <span className={styles.leftIcon}>{leftIcon}</span>}
          <input
            ref={ref}
            type={inputType}
            className={styles.input}
            disabled={disabled}
            value={value}
            {...props}
          />
          {showClearButton && (
            <button
              type="button"
              className={styles.clearButton}
              onClick={handleClear}
              tabIndex={-1}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
          {isPassword && (
            <button
              type="button"
              className={styles.togglePassword}
              onClick={() => setShowPassword(!showPassword)}
              tabIndex={-1}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          )}
          {rightElement && <span className={styles.rightElement}>{rightElement}</span>}
        </div>
        {(error || helperText) && (
          <span className={clsx(styles.helperText, { [styles.errorText]: !!error })}>
            {error || helperText}
          </span>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input;
