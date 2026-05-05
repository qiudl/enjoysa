import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { listShares, type ShareHistoryItem } from '../../../services/chatService';
import styles from './ShareHistorySection.module.css';

const PAGE_SIZE = 20;

const formatTime = (iso: string): string => {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleString();
  } catch {
    return iso;
  }
};

const countMessages = (raw: string): number => {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
};

export const ShareHistorySection: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<ShareHistoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listShares(page, PAGE_SIZE, 'supplier')
      .then(res => {
        if (cancelled) return;
        setItems(res.items || []);
        setTotal(res.total || 0);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [page]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <section className={styles.section}>
      <h2>{t('supplier.settings.shareHistory.title', { defaultValue: 'AI 对话分享历史' })}</h2>
      <p style={{ color: '#666', fontSize: 13, marginTop: -4 }}>
        {t('supplier.settings.shareHistory.subtitle', {
          defaultValue: '本企业账号通过 AI 助手分享到飞书的记录',
        })}
      </p>

      {loading && items.length === 0 ? (
        <div className={styles.empty}>{t('common.loading', { defaultValue: '加载中...' })}</div>
      ) : items.length === 0 ? (
        <div className={styles.empty}>
          {t('supplier.settings.shareHistory.empty', { defaultValue: '暂无分享记录' })}
        </div>
      ) : (
        <>
          <div className={styles.list}>
            {items.map(it => (
              <div key={it.id} className={styles.row}>
                <span className={styles.note}>
                  {it.note || `Session #${it.session_id} · ${countMessages(it.message_ids)} ${t('supplier.settings.shareHistory.msgs', { defaultValue: '条消息' })}`}
                  {it.added_to_kb && (
                    <span style={{ marginLeft: 6, color: '#1677ff', fontSize: 11 }}>
                      📚 {t('supplier.settings.shareHistory.inKB', { defaultValue: '已入库' })}
                    </span>
                  )}
                </span>
                <span className={styles.meta}>{formatTime(it.created_at)}</span>
                <span className={it.success ? styles.statusOk : styles.statusFail}>
                  {it.success
                    ? t('supplier.settings.shareHistory.statusOk', { defaultValue: '✓ 成功' })
                    : t('supplier.settings.shareHistory.statusFail', { defaultValue: '✗ 失败' })}
                </span>
                <button
                  className={styles.openBtn}
                  onClick={() => navigate(`/supplier/ai-chat/sessions/${it.session_id}`)}
                >
                  {t('supplier.settings.shareHistory.open', { defaultValue: '打开' })}
                </button>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className={styles.pager}>
              <button
                className={styles.pageBtn}
                disabled={page <= 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
              >
                ← {t('common.prev', { defaultValue: '上一页' })}
              </button>
              <span style={{ fontSize: 12, color: '#666', alignSelf: 'center' }}>
                {page} / {totalPages}
              </span>
              <button
                className={styles.pageBtn}
                disabled={page >= totalPages}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              >
                {t('common.next', { defaultValue: '下一页' })} →
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
};

export default ShareHistorySection;
