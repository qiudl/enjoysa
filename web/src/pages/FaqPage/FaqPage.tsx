import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Header,
  Footer,
} from '../../components/Common';
import styles from './FaqPage.module.css';

export interface FaqPageProps {
  isLoggedIn?: boolean;
  userName?: string;
  userAvatar?: string;
  /** 购物车数量 */
  cartCount?: number;
  onLoginClick?: () => void;
  onRegisterClick?: () => void;
  onNavClick?: (path: string) => void;
  onSearch?: (keyword: string) => void;
}

interface FaqItem {
  question: string;
  answer: string;
}

type FaqCategory = 'booking' | 'payment' | 'tour' | 'other';

export const FaqPage: React.FC<FaqPageProps> = ({
  isLoggedIn = false,
  userName,
  userAvatar,
  cartCount = 0,
  onLoginClick,
  onRegisterClick,
  onNavClick,
  onSearch,
}) => {
  const { t } = useTranslation();
  const [openIndex, setOpenIndex] = React.useState<string | null>(null);

  const toggleFaq = (category: string, index: number) => {
    const key = `${category}-${index}`;
    setOpenIndex(openIndex === key ? null : key);
  };

  const renderFaqSection = (category: FaqCategory, title: string) => {
    const faqs = t(`faq.faqs.${category}`, { returnObjects: true }) as FaqItem[];
    return (
      <div className={styles.section} key={category}>
        <h2 className={styles.sectionTitle}>{title}</h2>
        <div className={styles.faqList}>
          {faqs.map((faq, index) => {
            const key = `${category}-${index}`;
            const isOpen = openIndex === key;
            return (
              <div
                key={index}
                className={`${styles.faqItem} ${isOpen ? styles.open : ''}`}
              >
                <button
                  className={styles.question}
                  onClick={() => toggleFaq(category, index)}
                >
                  <span>{faq.question}</span>
                  <span className={styles.icon}>{isOpen ? '−' : '+'}</span>
                </button>
                {isOpen && (
                  <div className={styles.answer}>
                    <p>{faq.answer}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className={styles.page}>
      <Header
        isLoggedIn={isLoggedIn}
        userName={userName}
        userAvatar={userAvatar}
        cartCount={cartCount}
        onLoginClick={onLoginClick}
        onRegisterClick={onRegisterClick}
        onNavClick={onNavClick}
        onSearch={onSearch}
      />

      <main className={styles.main}>
        <div className={styles.hero}>
          <div className={styles.heroContent}>
            <h1>{t('faq.title')}</h1>
            <p>{t('faq.subtitle')}</p>
          </div>
        </div>

        <div className={styles.container}>
          {renderFaqSection('booking', t('faq.categories.booking'))}
          {renderFaqSection('payment', t('faq.categories.payment'))}
          {renderFaqSection('tour', t('faq.categories.tour'))}
          {renderFaqSection('other', t('faq.categories.other'))}

          <div className={styles.contactBox}>
            <p>{t('faq.contact')}</p>
            <button
              className={styles.contactLink}
              onClick={() => onNavClick?.('/contact')}
            >
              {t('faq.contactLink')}
            </button>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default FaqPage;
