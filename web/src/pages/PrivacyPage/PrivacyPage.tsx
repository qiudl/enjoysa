import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Header,
  Footer,
} from '../../components/Common';
import styles from './PrivacyPage.module.css';

export interface PrivacyPageProps {
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

const sectionKeys = [
  'overview',
  'collection',
  'usage',
  'sharing',
  'cookies',
  'security',
  'retention',
  'rights',
  'children',
  'changes',
  'contact',
] as const;

export const PrivacyPage: React.FC<PrivacyPageProps> = ({
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
        <div className={styles.container}>
          <h1 className={styles.title}>{t('privacy.title')}</h1>
          <p className={styles.lastUpdated}>{t('privacy.lastUpdated')}</p>

          <div className={styles.content}>
            {sectionKeys.map((key) => (
              <section key={key} className={styles.section}>
                <h2>{t(`privacy.sections.${key}.title`)}</h2>
                <div className={styles.text}>
                  {(t(`privacy.sections.${key}.content`) as string).split('\n').map((paragraph, pIndex) => (
                    <p key={pIndex}>{paragraph}</p>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default PrivacyPage;
