import React, { Component } from 'react';
import type { ErrorInfo } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import styles from './ErrorBoundary.module.css';

export interface ErrorBoundaryProps {
  /** 子元素 */
  children: React.ReactNode;
  /** 回退组件 */
  fallback?: React.ReactNode;
  /** 错误回调 */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /** 是否显示错误详情 */
  showDetails?: boolean;
  /** 语言 */
  language?: 'zh' | 'en';
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    this.props.onError?.(error, errorInfo);

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('ErrorBoundary caught an error:', error, errorInfo);
    }
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    const { children, fallback, showDetails = false, language } = this.props;
    const { hasError, error, errorInfo } = this.state;
    const isZh = language === 'zh' || (!language && typeof window !== 'undefined' && navigator.language.startsWith('zh'));

    if (hasError) {
      if (fallback) {
        return fallback;
      }

      return (
        <div className={styles.container}>
          <div className={styles.content}>
            <div className={styles.iconWrapper}>
              <AlertTriangle size={48} />
            </div>
            <h1 className={styles.title}>
              {isZh ? '页面出现错误' : 'Something went wrong'}
            </h1>
            <p className={styles.message}>
              {isZh
                ? '抱歉，页面遇到了一些问题。请尝试刷新页面或返回首页。'
                : 'Sorry, there was an error loading this page. Please try refreshing or go back to the home page.'}
            </p>

            <div className={styles.actions}>
              <button className={styles.retryButton} onClick={this.handleRetry}>
                <RefreshCw size={18} />
                {isZh ? '重试' : 'Try Again'}
              </button>
              <button className={styles.homeButton} onClick={this.handleGoHome}>
                <Home size={18} />
                {isZh ? '返回首页' : 'Go Home'}
              </button>
            </div>

            {showDetails && error && (
              <details className={styles.details}>
                <summary className={styles.detailsSummary}>
                  {isZh ? '查看错误详情' : 'View error details'}
                </summary>
                <div className={styles.detailsContent}>
                  <div className={styles.errorName}>
                    <strong>{isZh ? '错误类型:' : 'Error:'}</strong> {error.name}
                  </div>
                  <div className={styles.errorMessage}>
                    <strong>{isZh ? '错误信息:' : 'Message:'}</strong> {error.message}
                  </div>
                  {errorInfo?.componentStack && (
                    <pre className={styles.stackTrace}>
                      {errorInfo.componentStack}
                    </pre>
                  )}
                </div>
              </details>
            )}
          </div>
        </div>
      );
    }

    return children;
  }
}

// Functional Error Fallback Component
export interface ErrorFallbackProps {
  error?: Error;
  resetError?: () => void;
  language?: 'zh' | 'en';
}

export const ErrorFallback: React.FC<ErrorFallbackProps> = ({
  error,
  resetError,
  language,
}) => {
  const isZh = language === 'zh' || (!language && typeof window !== 'undefined' && navigator.language.startsWith('zh'));

  return (
    <div className={styles.fallback}>
      <AlertTriangle size={32} className={styles.fallbackIcon} />
      <h3 className={styles.fallbackTitle}>
        {isZh ? '加载失败' : 'Failed to load'}
      </h3>
      <p className={styles.fallbackMessage}>
        {error?.message || (isZh ? '组件加载时出现错误' : 'An error occurred while loading this component')}
      </p>
      {resetError && (
        <button className={styles.fallbackButton} onClick={resetError}>
          <RefreshCw size={16} />
          {isZh ? '重试' : 'Retry'}
        </button>
      )}
    </div>
  );
};

export default ErrorBoundary;
