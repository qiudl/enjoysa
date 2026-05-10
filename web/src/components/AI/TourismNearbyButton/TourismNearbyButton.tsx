import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MapPin, Loader2 } from 'lucide-react';
import { ApiError } from '../../../services/api';
import { tourismAgentService, type TourismNearbyItem } from '../../../services/tourismAgentService';
import styles from './TourismNearbyButton.module.css';

/**
 * REQ-20260510-0011 Phase 2 dev-2A — "📍 周边还有什么" embedded button.
 *
 * Sits in the C-end ProductDetailPage and, on click, fetches up to 5
 * KB entries that share the current product's (category, council). The
 * server caches these 24h so a popular product page hits the LLM zero
 * times. No auth required — anonymous visitors get the same browsing
 * aid as logged-in customers.
 *
 * The "AI 嵌入式设计" memory is the load-bearing constraint: this is a
 * button + inline list, NOT a chat window. The list deliberately omits
 * prices to avoid cross-promoting other suppliers and to stay clearly
 * informational.
 */
export interface TourismNearbyButtonProps {
  category: string;
  council: string;
  /** Excludes the source product if it happens to be in the KB itself. */
  excludeProductId?: number;
  language?: 'zh' | 'en';
}

export const TourismNearbyButton: React.FC<TourismNearbyButtonProps> = ({
  category,
  council,
  excludeProductId,
  language,
}) => {
  const { t, i18n } = useTranslation();
  const isZh = (language ?? (i18n.language?.startsWith('zh') ? 'zh' : 'en')) === 'zh';
  const [items, setItems] = useState<TourismNearbyItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    if (loading) return;
    if (!category || !council) {
      setError(t('tourism.embed.nearbyMissingDims', {
        defaultValue: '该商品缺少品类或区域信息，无法查询周边',
      }) as string);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const resp = await tourismAgentService.nearby({
        category,
        council,
        exclude_product_id: excludeProductId,
        limit: 5,
      });
      setItems(resp.items);
    } catch (err) {
      // 429 from the per-IP limiter shows up as ApiError with a generic
      // message — surface it as friendly copy rather than a stack trace.
      if (err instanceof ApiError && err.status === 429) {
        setError(t('tourism.embed.nearbyRateLimited', {
          defaultValue: '请求过于频繁，请稍后再试',
        }) as string);
      } else {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.shell}>
      <button
        type="button"
        className={styles.btn}
        onClick={handleClick}
        disabled={loading}
      >
        {loading ? <Loader2 size={14} className={styles.spin} /> : <MapPin size={14} />}
        {t('tourism.embed.nearbyButton', { defaultValue: '📍 周边还有什么' })}
      </button>

      {error && <div className={styles.banner}>{error}</div>}

      {items !== null && !loading && items.length === 0 && (
        <div className={styles.empty}>
          {t('tourism.embed.nearbyEmpty', { defaultValue: '该地区暂无相关推荐' })}
        </div>
      )}

      {items !== null && items.length > 0 && (
        <div className={styles.list}>
          {items.map((item) => (
            <div key={`${item.type}-${item.id}`} className={styles.row}>
              <span className={styles.typeBadge}>
                {typeLabel(item.type, t as (k: string, opts?: Record<string, unknown>) => string)}
              </span>
              <span className={styles.name}>
                {isZh ? item.name_zh : (item.name_en || item.name_zh)}
              </span>
              {item.council && <span className={styles.council}>{item.council}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

function typeLabel(t: string, translate: (k: string, opts?: Record<string, unknown>) => string): string {
  switch (t) {
    case 'attraction':
      return translate('tourism.embed.typeAttraction', { defaultValue: '景点' });
    case 'accommodation':
      return translate('tourism.embed.typeAccommodation', { defaultValue: '住宿' });
    case 'food':
      return translate('tourism.embed.typeFood', { defaultValue: '美食' });
    case 'experience':
      return translate('tourism.embed.typeExperience', { defaultValue: '体验' });
    default:
      return t;
  }
}

export default TourismNearbyButton;
