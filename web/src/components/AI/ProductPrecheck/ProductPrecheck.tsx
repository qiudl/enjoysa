import { useState, useEffect } from 'react';
import { productPrecheck, type ProductPrecheckResponse } from '../../../services/aiService';

interface ProductPrecheckProps {
  productId: number;
}

export default function ProductPrecheck({ productId }: ProductPrecheckProps) {
  const [data, setData] = useState<ProductPrecheckResponse | null>(null);

  useEffect(() => {
    productPrecheck(productId).then(setData);
  }, [productId]);

  if (!data) return <span style={{ color: '#999', fontSize: 12 }}>...</span>;

  const color = data.score >= 70 ? '#10b981' : data.score >= 50 ? '#f59e0b' : '#ef4444';
  const bg = data.score >= 70 ? '#ecfdf5' : data.score >= 50 ? '#fffbeb' : '#fef2f2';

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <span style={{ background: bg, color, fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 8 }}>
        {data.score}
      </span>
      {data.risks.length > 0 && (
        <span title={data.risks.join('\n')} style={{ cursor: 'help', fontSize: 12 }}>
          ⚠️
        </span>
      )}
    </div>
  );
}
