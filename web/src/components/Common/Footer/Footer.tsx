import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { MapPin, Phone, Mail } from 'lucide-react';
import clsx from 'clsx';
import styles from './Footer.module.css';

export interface FooterProps {
  /** Logo 图片 URL */
  logo?: string;
  /** 公司简介 */
  description?: string;
  /** 联系电话 */
  phone?: string;
  /** 联系邮箱 */
  email?: string;
  /** 地址 */
  address?: string;
  /** ICP 备案号 */
  icp?: string;
  /** 导航项点击回调 */
  onNavClick?: (path: string) => void;
  /** 社交媒体点击回调 */
  onSocialClick?: (platform: string) => void;
}

const quickLinks = [
  { key: 'home', path: '/' },
  { key: 'destinations', path: '/destinations' },
  { key: 'categories', path: '/categories' },
  { key: 'about', path: '/about' },
  { key: 'contact', path: '/contact' },
];

const serviceLinks = [
  { key: 'faq', path: '/faq' },
  { key: 'serviceAgreement', path: '/terms' },
  { key: 'privacyPolicy', path: '/privacy' },
  { key: 'contactUs', path: '/contact' },
];

const partnerLinks = [
  { key: 'supplierPortal', path: '/supplier/login' },
  { key: 'adminPortal', path: '/admin/login' },
];

export const Footer: React.FC<FooterProps> = ({
  logo,
  description,
  phone = '+61 0406830901',
  email = 'tonylai@enjoysau.com',
  address = 'Adelaide, South Australia',
  icp,
  onNavClick,
  onSocialClick,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const handleNavClick = (path: string) => {
    if (onNavClick) {
      onNavClick(path);
    } else {
      navigate(path);
    }
  };

  const defaultDescription = t('footer.aboutText');

  return (
    <footer className={styles.footer}>
      <div className={styles.container}>
        {/* Main Content */}
        <div className={styles.main}>
          {/* Brand Section */}
          <div className={styles.brand}>
            <div className={styles.logo}>
              <img src={logo || '/images/logo.jpg'} alt="EnjoySA 畅游南澳" className={styles.logoImage} />
            </div>
            <p className={styles.description}>{description || defaultDescription}</p>

            {/* Contact Info */}
            <div className={styles.contactList}>
              <div className={styles.contactItem}>
                <Phone size={16} />
                <a href={`tel:${phone}`}>{phone}</a>
              </div>
              <div className={styles.contactItem}>
                <Mail size={16} />
                <a href={`mailto:${email}`}>{email}</a>
              </div>
              <div className={styles.contactItem}>
                <MapPin size={16} />
                <span>{address}</span>
              </div>
            </div>
          </div>

          {/* Quick Links */}
          <div className={styles.linkSection}>
            <h4 className={styles.linkTitle}>{t('footer.quickLinks')}</h4>
            <ul className={styles.linkList}>
              {quickLinks.map((link) => (
                <li key={link.key}>
                  <button
                    className={styles.link}
                    onClick={() => handleNavClick(link.path)}
                  >
                    {t(`nav.${link.key}`)}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Service Links */}
          <div className={styles.linkSection}>
            <h4 className={styles.linkTitle}>{t('footer.customerService')}</h4>
            <ul className={styles.linkList}>
              {serviceLinks.map((link) => (
                <li key={link.key}>
                  <button
                    className={styles.link}
                    onClick={() => handleNavClick(link.path)}
                  >
                    {t(`footer.${link.key}`)}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Partner Links */}
          <div className={styles.linkSection}>
            <h4 className={styles.linkTitle}>{t('footer.partnerPortal')}</h4>
            <ul className={styles.linkList}>
              {partnerLinks.map((link) => (
                <li key={link.key}>
                  <button
                    className={styles.link}
                    onClick={() => handleNavClick(link.path)}
                  >
                    {t(`footer.${link.key}`)}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Social Media */}
          <div className={styles.linkSection}>
            <h4 className={styles.linkTitle}>{t('footer.followUs')}</h4>
            <div className={styles.socialList}>
              <button
                className={clsx(styles.socialButton, styles.wechat)}
                onClick={() => onSocialClick?.('wechat')}
                aria-label="WeChat"
              >
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                  <path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 0 1 .213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 0 0 .167-.054l1.903-1.114a.864.864 0 0 1 .717-.098 10.16 10.16 0 0 0 2.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-4.196-6.348-8.596-6.348zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178A1.17 1.17 0 0 1 4.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178 1.17 1.17 0 0 1-1.162-1.178c0-.651.52-1.18 1.162-1.18zm5.34 2.867c-1.797-.052-3.746.512-5.28 1.786-1.72 1.428-2.687 3.72-1.78 6.22.942 2.453 3.666 4.229 6.884 4.229.826 0 1.622-.12 2.361-.336a.722.722 0 0 1 .598.082l1.584.926a.272.272 0 0 0 .14.045c.134 0 .24-.111.24-.247 0-.06-.023-.12-.038-.177l-.327-1.233a.582.582 0 0 1-.023-.156.49.49 0 0 1 .201-.398C23.024 18.48 24 16.82 24 14.98c0-3.21-2.931-5.837-6.656-6.088V8.89c-.135-.004-.268-.03-.406-.03zm-2.53 3.274c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.97-.982zm4.844 0c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.969-.982z"/>
                </svg>
              </button>
              <button
                className={clsx(styles.socialButton, styles.weibo)}
                onClick={() => onSocialClick?.('weibo')}
                aria-label="Weibo"
              >
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                  <path d="M10.098 20.323c-3.977.391-7.414-1.406-7.672-4.02-.259-2.609 2.759-5.047 6.74-5.441 3.979-.394 7.413 1.404 7.671 4.018.259 2.6-2.759 5.049-6.739 5.443zM9.05 17.219c-.384.616-1.208.884-1.829.602-.612-.279-.793-.991-.406-1.593.379-.595 1.176-.861 1.793-.601.622.263.82.972.442 1.592zm1.27-1.627c-.141.237-.449.353-.689.253-.236-.09-.313-.361-.177-.586.138-.227.436-.346.672-.24.239.09.315.36.194.573zm.176-2.719c-1.893-.493-4.033.45-4.857 2.118-.836 1.704-.026 3.591 1.886 4.21 1.983.64 4.318-.341 5.132-2.179.8-1.793-.201-3.642-2.161-4.149zm7.563-1.224c-.346-.105-.578-.172-.4-.618.386-.981.426-1.828.001-2.431-.801-1.135-2.987-1.075-5.524-.031l.001-.001c0-.001-.744.321-.553-.262.369-1.163.314-2.138-.262-2.699-1.304-1.269-4.784.039-7.772 2.929-2.233 2.157-3.531 4.449-3.531 6.399 0 3.725 4.784 5.994 9.465 5.994 6.135 0 10.218-3.565 10.218-6.392 0-1.71-1.453-2.684-1.643-2.888zm1.094-8.9c-.66-.772-1.627-1.152-2.563-1.152-.801 0-1.571.281-2.122.82-.661.645-.86 1.58-.529 2.51.143.399-.002.845-.364 1.04-.367.197-.831.116-1.104-.191-.727-.816-.885-1.984-.436-3.054.521-1.238 1.632-2.119 2.976-2.358 1.344-.239 2.722.18 3.696 1.122.978.944 1.439 2.255 1.232 3.521-.207 1.266-.981 2.351-2.072 2.909-.4.204-.883.09-1.141-.268-.258-.358-.19-.859.161-1.142.725-.586 1.058-1.52.866-2.39-.191-.869-.83-1.583-1.6-1.867z"/>
                </svg>
              </button>
              <button
                className={clsx(styles.socialButton, styles.instagram)}
                onClick={() => onSocialClick?.('instagram')}
                aria-label="Instagram"
              >
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
                </svg>
              </button>
              <button
                className={clsx(styles.socialButton, styles.facebook)}
                onClick={() => onSocialClick?.('facebook')}
                aria-label="Facebook"
              >
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
              </button>
            </div>

            {/* QR Code Placeholder */}
            <div className={styles.qrCode}>
              <div className={styles.qrCodePlaceholder}>
                <span>{t('footer.qrCodeLabel', 'WeChat')}</span>
              </div>
              <p className={styles.qrCodeText}>{t('footer.qrCodeHint', 'Scan for latest deals')}</p>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className={styles.bottom}>
          <p className={styles.copyright}>
            © {t('footer.copyright')}
          </p>
          {icp && <p className={styles.icp}>{icp}</p>}
        </div>
      </div>
    </footer>
  );
};

export default Footer;
