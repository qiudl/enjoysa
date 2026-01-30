import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Header,
  Footer,
  Button,
} from '../../components/Common';
import styles from './ContactPage.module.css';

export interface ContactPageProps {
  /** 是否登录 */
  isLoggedIn?: boolean;
  /** 用户名 */
  userName?: string;
  /** 用户头像 */
  userAvatar?: string;
  /** 购物车数量 */
  cartCount?: number;
  /** 登录点击 */
  onLoginClick?: () => void;
  /** 注册点击 */
  onRegisterClick?: () => void;
  /** 导航点击 */
  onNavClick?: (path: string) => void;
  /** 搜索 */
  onSearch?: (keyword: string) => void;
}

interface ContactInfoItem {
  icon: string;
  label: string;
  value: string;
  description: string;
}

interface WorkingHoursItem {
  day: string;
  hours: string;
}

export const ContactPage: React.FC<ContactPageProps> = ({
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
  const contactInfoItems = t('contact.contactInfo.items', { returnObjects: true }) as ContactInfoItem[];
  const workingHoursItems = t('contact.workingHours.items', { returnObjects: true }) as WorkingHoursItem[];
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    subject: '',
    message: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));

    setSubmitting(false);
    setSubmitted(true);
    setFormData({ name: '', email: '', phone: '', subject: '', message: '' });
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

      {/* Hero Section */}
      <section className={styles.hero}>
        <div className={styles.heroOverlay} />
        <div className={styles.heroContent}>
          <h1 className={styles.heroTitle}>{t('contact.title')}</h1>
          <p className={styles.heroSubtitle}>{t('contact.subtitle')}</p>
        </div>
      </section>

      <main className={styles.main}>
        <div className={styles.container}>
          <div className={styles.grid}>
            {/* Contact Info */}
            <div className={styles.infoSection}>
              <h2 className={styles.sectionTitle}>{t('contact.contactInfo.title')}</h2>
              <div className={styles.contactList}>
                {contactInfoItems.map((item, index) => (
                  <div key={index} className={styles.contactItem}>
                    <span className={styles.contactIcon}>{item.icon}</span>
                    <div className={styles.contactContent}>
                      <span className={styles.contactLabel}>{item.label}</span>
                      <span className={styles.contactValue}>{item.value}</span>
                      <span className={styles.contactDesc}>{item.description}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Working Hours */}
              <div className={styles.workingHours}>
                <h3 className={styles.hoursTitle}>{t('contact.workingHours.title')}</h3>
                <ul className={styles.hoursList}>
                  {workingHoursItems.map((item, index) => (
                    <li key={index}>
                      <span className={styles.day}>{item.day}</span>
                      <span className={styles.hours}>{item.hours}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Contact Form */}
            <div className={styles.formSection}>
              <h2 className={styles.sectionTitle}>{t('contact.form.title')}</h2>

              {submitted ? (
                <div className={styles.successMessage}>
                  <span className={styles.successIcon}>✅</span>
                  <p>{t('contact.form.success')}</p>
                </div>
              ) : (
                <form className={styles.form} onSubmit={handleSubmit}>
                  <div className={styles.formGroup}>
                    <label htmlFor="name">{t('contact.form.name')}</label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      placeholder={t('contact.form.placeholder.name')}
                      required
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label htmlFor="email">{t('contact.form.email')}</label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      placeholder={t('contact.form.placeholder.email')}
                      required
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label htmlFor="phone">{t('contact.form.phone')}</label>
                    <input
                      type="tel"
                      id="phone"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      placeholder={t('contact.form.placeholder.phone')}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label htmlFor="subject">{t('contact.form.subject')}</label>
                    <input
                      type="text"
                      id="subject"
                      name="subject"
                      value={formData.subject}
                      onChange={handleChange}
                      placeholder={t('contact.form.placeholder.subject')}
                      required
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label htmlFor="message">{t('contact.form.message')}</label>
                    <textarea
                      id="message"
                      name="message"
                      value={formData.message}
                      onChange={handleChange}
                      placeholder={t('contact.form.placeholder.message')}
                      rows={5}
                      required
                    />
                  </div>
                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    fullWidth
                    loading={submitting}
                    disabled={submitting}
                  >
                    {submitting ? t('contact.form.sending') : t('contact.form.submit')}
                  </Button>
                </form>
              )}
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default ContactPage;
