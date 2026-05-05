import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { generateProductContent, type GeneratedContent } from '../../../services/aiService';
import styles from './ProductAiWriter.module.css';

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
    <div className={styles.wrapper}>
      <div className={styles.header}>
        ✍️ {t('aiWriter.title', 'AI 写手')}
        <span className={styles.badge}>AI</span>
      </div>
      <div className={styles.inputRow}>
        <input
          className={styles.input}
          placeholder={t('aiWriter.keywordsPlaceholder', '输入关键词，如"考拉 海豹 含午餐 10小时"')}
          value={keywords}
          onChange={(e) => setKeywords(e.target.value)}
        />
        <button
          onClick={handleGenerate}
          disabled={loading || !nameZh || !keywords.trim()}
          className={styles.generateBtn}
          title={!nameZh ? t('aiWriter.needName', '请先填写产品中文名') : !keywords.trim() ? t('aiWriter.needKeywords', '请输入关键词') : ''}
        >
          {loading ? '生成中...' : '✨ ' + t('aiWriter.generate', 'AI 生成')}
        </button>
      </div>
      {result && (
        <div className={styles.resultBox}>
          <div className={styles.resultLabel}>✅ {t('aiWriter.generated', '已生成')}</div>
          <div><strong>EN:</strong> {result.name_en}</div>
          <div className={styles.resultLine}><strong>{t('aiWriter.descZh', '中文描述')}:</strong> {result.description_zh?.slice(0, 100)}...</div>
          <div className={styles.resultLine}><strong>{t('aiWriter.highlights', '亮点')}:</strong> {result.highlights?.length || 0} 条</div>
          <div className={styles.resultLine}><strong>FAQ:</strong> {result.faqs?.length || 0} 条</div>
          <div className={styles.actions}>
            <button onClick={() => onApply(result)} className={styles.applyBtn}>
              ✅ {t('aiWriter.apply', '采用并填充')}
            </button>
            <button onClick={handleGenerate} className={styles.regenBtn}>
              🔄 {t('aiWriter.regenerate', '重新生成')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
