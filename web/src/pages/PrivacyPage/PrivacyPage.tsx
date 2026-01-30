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

const texts = {
  zh: {
    title: '隐私政策',
    lastUpdated: '最后更新：2024年1月',
    sections: [
      {
        title: '概述',
        content: `畅游南澳（EnjoySA）深知个人隐私的重要性。本隐私政策说明我们如何收集、使用、存储和保护您的个人信息。

使用我们的服务即表示您同意本隐私政策中描述的数据处理方式。我们鼓励您仔细阅读本政策，如有疑问，请随时联系我们。`,
      },
      {
        title: '1. 我们收集的信息',
        content: `我们可能收集以下类型的个人信息：

1.1 您主动提供的信息
• 账户注册信息：姓名、邮箱、手机号码
• 预订信息：出行日期、参与人数、特殊需求
• 支付信息：支付方式、交易记录（我们不存储完整的银行卡信息）
• 通信内容：您与客服的对话、评价和反馈

1.2 自动收集的信息
• 设备信息：设备类型、操作系统、浏览器类型
• 日志信息：访问时间、页面浏览记录、IP地址
• Cookie和类似技术收集的信息`,
      },
      {
        title: '2. 信息使用目的',
        content: `我们使用您的信息用于：

• 处理您的预订和提供服务
• 发送预订确认、行程提醒和重要通知
• 改善我们的产品和服务
• 提供客户支持
• 发送营销信息（可选择退订）
• 防止欺诈和确保安全
• 遵守法律义务`,
      },
      {
        title: '3. 信息共享',
        content: `我们可能在以下情况下共享您的信息：

3.1 服务提供商
为完成您的预订，我们会将必要信息提供给旅游服务商（如接送时间、人数等）。

3.2 支付处理商
处理支付需要将相关信息提供给第三方支付服务商。

3.3 法律要求
在法律要求或政府机关合法请求时，我们可能披露您的信息。

3.4 业务转让
如发生合并、收购等情况，您的信息可能作为业务资产转移。

我们不会向第三方出售您的个人信息。`,
      },
      {
        title: '4. Cookie 和追踪技术',
        content: `我们使用 Cookie 和类似技术来：

• 记住您的偏好和设置
• 分析网站流量和使用情况
• 提供个性化内容和广告
• 改善用户体验

您可以通过浏览器设置管理 Cookie 偏好。禁用 Cookie 可能影响某些功能的正常使用。`,
      },
      {
        title: '5. 数据安全',
        content: `我们采取多种安全措施保护您的信息：

• 使用 SSL/TLS 加密传输数据
• 敏感数据加密存储
• 定期安全审计和更新
• 员工培训和访问控制
• 安全的数据中心托管

尽管我们努力保护您的信息，但互联网传输不能保证100%安全。`,
      },
      {
        title: '6. 数据保留',
        content: `我们仅在必要的时间内保留您的个人信息：

• 账户信息：账户存续期间及注销后的合理期限
• 交易记录：根据财务和法律要求保留
• 日志数据：通常保留不超过12个月

您可以随时要求删除您的个人信息，但某些信息可能因法律原因需要保留。`,
      },
      {
        title: '7. 您的权利',
        content: `根据适用的隐私法律，您可能拥有以下权利：

• 访问权：请求获取我们持有的您的个人信息
• 更正权：要求更正不准确的信息
• 删除权：要求删除您的个人信息
• 限制处理权：要求限制对您信息的处理
• 数据可携权：请求以可机读格式获取您的数据
• 反对权：反对某些数据处理活动

如需行使这些权利，请通过下方联系方式与我们联系。`,
      },
      {
        title: '8. 儿童隐私',
        content: `我们的服务不面向16岁以下的儿童。我们不会故意收集儿童的个人信息。如果您发现我们无意中收集了儿童信息，请立即联系我们，我们将及时删除。`,
      },
      {
        title: '9. 政策变更',
        content: `我们可能会不时更新本隐私政策。重大变更将通过网站通知或邮件通知您。建议您定期查看本页面了解最新的隐私保护措施。`,
      },
      {
        title: '10. 联系我们',
        content: `如对本隐私政策有任何疑问或需要行使您的权利，请联系我们：

邮箱：privacy@enjoysa.com.au
地址：Adelaide, South Australia, Australia
电话：+61 8 XXXX XXXX

我们将在收到请求后30天内回复。`,
      },
    ],
  },
  en: {
    title: 'Privacy Policy',
    lastUpdated: 'Last Updated: January 2024',
    sections: [
      {
        title: 'Overview',
        content: `EnjoySA understands the importance of personal privacy. This Privacy Policy explains how we collect, use, store, and protect your personal information.

By using our services, you agree to the data processing practices described in this Privacy Policy. We encourage you to read this policy carefully. If you have any questions, please contact us.`,
      },
      {
        title: '1. Information We Collect',
        content: `We may collect the following types of personal information:

1.1 Information You Provide
• Registration information: name, email, phone number
• Booking information: travel dates, number of participants, special requirements
• Payment information: payment method, transaction records (we do not store complete card details)
• Communications: conversations with customer service, reviews and feedback

1.2 Automatically Collected Information
• Device information: device type, operating system, browser type
• Log information: access time, page views, IP address
• Information collected through cookies and similar technologies`,
      },
      {
        title: '2. How We Use Information',
        content: `We use your information to:

• Process your bookings and provide services
• Send booking confirmations, trip reminders, and important notifications
• Improve our products and services
• Provide customer support
• Send marketing communications (opt-out available)
• Prevent fraud and ensure security
• Comply with legal obligations`,
      },
      {
        title: '3. Information Sharing',
        content: `We may share your information in the following circumstances:

3.1 Service Providers
To complete your booking, we share necessary information with tourism service providers (pickup times, group size, etc.).

3.2 Payment Processors
Processing payments requires sharing relevant information with third-party payment service providers.

3.3 Legal Requirements
We may disclose your information when required by law or upon lawful government requests.

3.4 Business Transfers
In the event of a merger or acquisition, your information may be transferred as a business asset.

We do not sell your personal information to third parties.`,
      },
      {
        title: '4. Cookies and Tracking Technologies',
        content: `We use cookies and similar technologies to:

• Remember your preferences and settings
• Analyze website traffic and usage
• Provide personalized content and advertising
• Improve user experience

You can manage cookie preferences through your browser settings. Disabling cookies may affect certain features.`,
      },
      {
        title: '5. Data Security',
        content: `We implement various security measures to protect your information:

• SSL/TLS encryption for data transmission
• Encrypted storage of sensitive data
• Regular security audits and updates
• Employee training and access controls
• Secure data center hosting

While we strive to protect your information, internet transmission cannot be guaranteed to be 100% secure.`,
      },
      {
        title: '6. Data Retention',
        content: `We retain your personal information only for as long as necessary:

• Account information: during account existence and a reasonable period after closure
• Transaction records: as required by financial and legal requirements
• Log data: typically no longer than 12 months

You may request deletion of your personal information at any time, though some information may need to be retained for legal reasons.`,
      },
      {
        title: '7. Your Rights',
        content: `Under applicable privacy laws, you may have the following rights:

• Access: request access to your personal information we hold
• Rectification: request correction of inaccurate information
• Deletion: request deletion of your personal information
• Restriction: request restriction of processing
• Data Portability: request your data in a machine-readable format
• Objection: object to certain data processing activities

To exercise these rights, please contact us using the information below.`,
      },
      {
        title: '8. Children\'s Privacy',
        content: `Our services are not directed at children under 16. We do not knowingly collect personal information from children. If you discover that we have inadvertently collected children's information, please contact us immediately and we will promptly delete it.`,
      },
      {
        title: '9. Policy Changes',
        content: `We may update this Privacy Policy from time to time. Significant changes will be notified through website notices or email. We recommend regularly reviewing this page for the latest privacy practices.`,
      },
      {
        title: '10. Contact Us',
        content: `If you have any questions about this Privacy Policy or need to exercise your rights, please contact us:

Email: privacy@enjoysa.com.au
Address: Adelaide, South Australia, Australia
Phone: +61 8 XXXX XXXX

We will respond within 30 days of receiving your request.`,
      },
    ],
  },
};

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
  const { t, i18n } = useTranslation();
  const currentLang = (i18n.language?.startsWith('zh') ? 'zh' : 'en') as 'zh' | 'en';
  const sections = texts[currentLang].sections;

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
            {sections.map((section, index) => (
              <section key={index} className={styles.section}>
                <h2>{section.title}</h2>
                <div className={styles.text}>
                  {section.content.split('\n').map((paragraph, pIndex) => (
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
