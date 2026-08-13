import React, { useState } from 'react';
import { ArrowRight, Clock3, Mail, MapPin, MessageCircle, Phone, Send } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Footer, Header } from '../../components/Common';
import { post } from '../../services/api';
import styles from './ContactPage.module.css';

export interface ContactPageProps {
  isLoggedIn?: boolean;
  userName?: string;
  userAvatar?: string;
  cartCount?: number;
  onLoginClick?: () => void;
  onRegisterClick?: () => void;
  onNavClick?: (path: string) => void;
  onSearch?: (keyword: string) => void;
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
  const { t, i18n } = useTranslation();
  const isZh = i18n.language?.startsWith('zh');
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', subject: '', message: '' });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData((current) => ({ ...current, [event.target.name]: event.target.value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      await post('/contact', formData);
      setSubmitted(true);
      setFormData({ name: '', email: '', phone: '', subject: '', message: '' });
    } catch {
      // Keep the completed form visible so the visitor can retry.
    } finally {
      setSubmitting(false);
    }
  };

  const contactItems = [
    { Icon: Phone, label: isZh ? '电话' : 'Phone', value: '+61 0406830901', href: 'tel:+61406830901', detail: isZh ? '澳大利亚中部时间' : 'Australian Central Time' },
    { Icon: Mail, label: isZh ? '邮箱' : 'Email', value: 'tonylai@enjoysau.com', href: 'mailto:tonylai@enjoysau.com', detail: isZh ? '我们会尽快回复您' : 'We will respond as soon as possible' },
    { Icon: MapPin, label: isZh ? '所在地' : 'Based in', value: 'Adelaide, South Australia', detail: isZh ? '专注南澳本地旅行' : 'South Australia travel specialists' },
  ];

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

      <section className={styles.hero}>
        <div className={styles.heroContent}>
          <span className={styles.eyebrow}>{isZh ? '联络 ENJOYSA' : 'CONTACT ENJOYSA'}</span>
          <h1>{isZh ? '让我们一起规划你的南澳之旅' : 'Let’s plan your South Australian journey'}</h1>
          <p>{isZh ? '无论是产品咨询、行程搭配还是团体需求，告诉我们你的想法，由熟悉南澳的团队为你提供建议。' : 'From product questions and itinerary ideas to group travel, tell our South Australia-based team what you have in mind.'}</p>
        </div>
        <span className={styles.heroLocation}><MapPin size={17} /> Adelaide, South Australia</span>
      </section>

      <main className={styles.main}>
        <section className={styles.contactIntro}>
          <div className={styles.infoColumn}>
            <span className={styles.sectionNumber}>01 / {isZh ? '直接联络' : 'GET IN TOUCH'}</span>
            <h2>{isZh ? '有任何问题，都可以从这里开始' : 'Every good journey starts with a conversation'}</h2>
            <p className={styles.lead}>{isZh ? '我们在阿德莱德，专注于南澳的景点体验、美食美酒和特色住宿。' : 'Based in Adelaide, we focus on South Australian experiences, food and wine, and distinctive stays.'}</p>

            <div className={styles.contactList}>
              {contactItems.map(({ Icon, label, value, href, detail }) => (
                <article key={label} className={styles.contactItem}>
                  <span className={styles.contactIcon}><Icon size={22} strokeWidth={1.6} /></span>
                  <div>
                    <span className={styles.contactLabel}>{label}</span>
                    {href ? <a href={href}>{value}</a> : <strong>{value}</strong>}
                    <small>{detail}</small>
                  </div>
                </article>
              ))}
            </div>

            <div className={styles.hoursCard}>
              <Clock3 size={22} />
              <div>
                <strong>{isZh ? '服务时间' : 'Service hours'}</strong>
                <span>{isZh ? '周一至周五 9:00–18:00，周六 10:00–16:00（ACST/ACDT）' : 'Mon–Fri 9:00–18:00, Sat 10:00–16:00 (ACST/ACDT)'}</span>
              </div>
            </div>
          </div>

          <div className={styles.adelaideImage}>
            <img src="https://assets.atdw-online.com.au/images/a413083a58fc524373c90042fa3d6f21.jpeg?fit=crop&w=1200&h=1400&sharp=10&rot=360" alt={isZh ? '阿德莱德南澳城市风景' : 'Adelaide, South Australia cityscape'} />
            <span><MessageCircle size={18} /> {isZh ? '本地团队回复' : 'Local team response'}</span>
          </div>
        </section>

        <section className={styles.formSection}>
          <div className={styles.formIntro}>
            <span className={styles.sectionNumber}>02 / {isZh ? '发送咨询' : 'SEND AN ENQUIRY'}</span>
            <h2>{isZh ? '告诉我们，你想怎样遇见南澳' : 'Tell us how you would like to experience South Australia'}</h2>
            <p>{isZh ? '如果已经有出行日期、人数或感兴趣的地区，请一并告诉我们，这会帮助我们更快提供合适建议。' : 'Share your dates, group size and preferred regions if known, so we can offer more useful advice.'}</p>
          </div>

          <div className={styles.formCard}>
            {submitted ? (
              <div className={styles.successMessage}>
                <span>✓</span>
                <h3>{isZh ? '已收到你的留言' : 'Your message is on its way'}</h3>
                <p>{t('contact.form.success')}</p>
              </div>
            ) : (
              <form className={styles.form} onSubmit={handleSubmit}>
                <div className={styles.twoColumns}>
                  <div className={styles.formGroup}>
                    <label htmlFor="contact-name">{t('contact.form.name')}</label>
                    <input data-testid="contact-input-name" type="text" id="contact-name" name="name" value={formData.name} onChange={handleChange} placeholder={t('contact.form.placeholder.name')} required />
                  </div>
                  <div className={styles.formGroup}>
                    <label htmlFor="contact-email">{t('contact.form.email')}</label>
                    <input data-testid="contact-input-email" type="email" id="contact-email" name="email" value={formData.email} onChange={handleChange} placeholder={t('contact.form.placeholder.email')} required />
                  </div>
                </div>
                <div className={styles.twoColumns}>
                  <div className={styles.formGroup}>
                    <label htmlFor="contact-phone">{t('contact.form.phone')}</label>
                    <input type="tel" id="contact-phone" name="phone" value={formData.phone} onChange={handleChange} placeholder={t('contact.form.placeholder.phone')} />
                  </div>
                  <div className={styles.formGroup}>
                    <label htmlFor="contact-subject">{t('contact.form.subject')}</label>
                    <input type="text" id="contact-subject" name="subject" value={formData.subject} onChange={handleChange} placeholder={t('contact.form.placeholder.subject')} required />
                  </div>
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="contact-message">{t('contact.form.message')}</label>
                  <textarea id="contact-message" name="message" value={formData.message} onChange={handleChange} placeholder={t('contact.form.placeholder.message')} rows={6} required />
                </div>
                <button type="submit" className={styles.submitButton} data-testid="contact-btn-submit" disabled={submitting}>
                  <Send size={18} /> {submitting ? t('contact.form.sending') : t('contact.form.submit')} <ArrowRight size={18} />
                </button>
              </form>
            )}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default ContactPage;
