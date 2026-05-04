import { useState, useEffect } from 'react';
import { productPrecheck, type ProductPrecheckResponse } from '../../../services/aiService';
import styles from './ProductPrecheck.module.css';

interface ProductPrecheckProps {
  productId: number;
}

export default function ProductPrecheck({ productId }: ProductPrecheckProps) {
  const [data, setData] = useState<ProductPrecheckResponse | null>(null);

  useEffect(() => {
    productPrecheck(productId).then(setData);
  }, [productId]);

  if (!data) return <span className={styles.placeholder}>...</span>;

  const color = data.score >= 70 ? '#10b981' : data.score >= 50 ? '#f59e0b' : '#ef4444';
  const bg = data.score >= 70 ? '#ecfdf5' : data.score >= 50 ? '#fffbeb' : '#fef2f2';

  return (
    <div className={styles.wrapper}>
      <span className={styles.scoreBadge} style={{ background: bg, color }}>
        {data.score}
      </span>
      {data.risks.length > 0 && (
        <span title={data.risks.join('\n')} className={styles.riskIcon}>
          ⚠️
        </span>
      )}
    </div>
  );
}
