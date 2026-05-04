import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { productQA, productQAFeedback } from '../../../services/aiService';
import styles from './SmartFAQ.module.css';

interface SmartFAQProps {
  productId: number;
  language?: string;
  quickQuestions?: string[];
}

export default function SmartFAQ({ productId, language = 'zh', quickQuestions }: SmartFAQProps) {
  const { t } = useTranslation();
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [currentQ, setCurrentQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [feedbackGiven, setFeedbackGiven] = useState<boolean | null>(null);

  const defaultQuestions = quickQuestions || [
    t('aiFaq.q1', '包含午餐吗？'),
    t('aiFaq.q2', '适合几岁小朋友？'),
    t('aiFaq.q3', '需要自驾吗？'),
    t('aiFaq.q4', '可以退款吗？'),
  ];

  const doAsk = async (q: string) => {
    if (!q.trim() || loading) return;
    setLoading(true);
    setCurrentQ(q);
    setAnswer('');
    setFeedbackGiven(null);

    const result = await productQA(productId, q, language);
    setAnswer(result?.answer || t('aiFaq.noAnswer', '抱歉，暂时无法回答这个问题，建议联系客服。'));
    setLoading(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    doAsk(question);
    setQuestion('');
  };

  const handleFeedback = (helpful: boolean) => {
    setFeedbackGiven(helpful);
    productQAFeedback(productId, currentQ, answer, helpful);
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.title}>
        💬 {t('aiFaq.title', '关于这个产品')}
        <span className={styles.badge}>{t('aiFaq.badge', 'AI 智能问答')}</span>
      </div>

      <div className={styles.quickTags}>
        {defaultQuestions.map((q) => (
          <button key={q} className={styles.quickTag} onClick={() => doAsk(q)}>{q}</button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className={styles.inputRow}>
        <input
          className={styles.input}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder={t('aiFaq.placeholder', '输入你想了解的任何问题...')}
        />
        <button type="submit" className={styles.askBtn} disabled={loading}>
          {t('aiFaq.ask', '提问')} ✨
        </button>
      </form>

      {loading && (
        <div className={styles.loading}>
          <span className={styles.spinner} />
          {t('aiFaq.thinking', 'AI 正在思考...')}
        </div>
      )}

      {!loading && answer && (
        <div className={styles.answer}>
          <div className={styles.answerQ}>Q: {currentQ}</div>
          <div className={styles.answerA}>{answer}</div>
          <div className={styles.feedback}>
            <button
              className={`${styles.feedbackBtn} ${feedbackGiven === true ? styles.active : ''}`}
              onClick={() => handleFeedback(true)}
            >
              👍 {t('aiFaq.helpful', '有帮助')}
            </button>
            <button
              className={`${styles.feedbackBtn} ${feedbackGiven === false ? styles.active : ''}`}
              onClick={() => handleFeedback(false)}
            >
              👎 {t('aiFaq.notHelpful', '没帮助')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
