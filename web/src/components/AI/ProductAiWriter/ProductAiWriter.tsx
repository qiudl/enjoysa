import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { generateProductContent, type GeneratedContent } from '../../../services/aiService';

interface ProductAiWriterProps {
  nameZh: string;
  onApply: (content: GeneratedContent) => void;
}

export default function ProductAiWriter({ nameZh, onApply }: ProductAiWriterProps) {
  const { t } = useTranslation();
  const [keywords, setKeywords] = useState('');
  const [result, setResult] = useState<GeneratedContent | null>(null);
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    if (!nameZh || !keywords || loading) return;
    setLoading(true);
    const data = await generateProductContent(nameZh, keywords);
    setResult(data);
    setLoading(false);
  };

  return (
    <div style={{ background: '#f8f9fb', borderRadius: 12, padding: 16, marginBottom: 16, border: '1px solid #e8e8f0' }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: '#333', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
        ✍️ {t('aiWriter.title', 'AI 写手')}
        <span style={{ background: 'linear-gradient(135deg,#667eea,#764ba2)', color: '#fff', fontSize: 11, padding: '2px 8px', borderRadius: 8 }}>AI</span>
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <input
          style={{ flex: 1, border: '1px solid #e5e5e5', borderRadius: 8, padding: '8px 12px', fontSize: 13, outline: 'none' }}
          placeholder={t('aiWriter.keywordsPlaceholder', '输入关键词，如"考拉 海豹 含午餐 10小时"')}
          value={keywords}
          onChange={(e) => setKeywords(e.target.value)}
        />
        <button
          onClick={handleGenerate}
          disabled={loading || !nameZh}
          style={{ background: 'linear-gradient(135deg,#667eea,#764ba2)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap', opacity: loading ? 0.6 : 1 }}
        >
          {loading ? '生成中...' : '✨ ' + t('aiWriter.generate', 'AI 生成')}
        </button>
      </div>
      {result && (
        <div style={{ background: '#fff', borderRadius: 8, padding: 12, fontSize: 12, color: '#444', lineHeight: 1.6, maxHeight: 200, overflowY: 'auto' }}>
          <div style={{ color: '#667eea', fontWeight: 600, marginBottom: 4 }}>✅ {t('aiWriter.generated', '已生成')}</div>
          <div><strong>EN:</strong> {result.name_en}</div>
          <div style={{ marginTop: 4 }}><strong>{t('aiWriter.descZh', '中文描述')}:</strong> {result.description_zh?.slice(0, 100)}...</div>
          <div style={{ marginTop: 4 }}><strong>{t('aiWriter.highlights', '亮点')}:</strong> {result.highlights?.length || 0} 条</div>
          <div style={{ marginTop: 4 }}><strong>FAQ:</strong> {result.faqs?.length || 0} 条</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button onClick={() => onApply(result)} style={{ background: '#667eea', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: 12, cursor: 'pointer' }}>
              ✅ {t('aiWriter.apply', '采用并填充')}
            </button>
            <button onClick={handleGenerate} style={{ background: '#fff', border: '1px solid #ddd', borderRadius: 6, padding: '6px 14px', fontSize: 12, cursor: 'pointer' }}>
              🔄 {t('aiWriter.regenerate', '重新生成')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
