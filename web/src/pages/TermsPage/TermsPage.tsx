import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Header,
  Footer,
} from '../../components/Common';
import styles from './TermsPage.module.css';

export interface TermsPageProps {
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
    title: '服务条款',
    lastUpdated: '最后更新：2024年1月',
    sections: [
      {
        title: '1. 服务协议的接受',
        content: `欢迎使用畅游南澳（EnjoySA）提供的服务。通过访问或使用我们的网站和服务，您同意受本服务条款的约束。如果您不同意这些条款，请勿使用我们的服务。

我们保留随时修改这些条款的权利。修改后的条款将在网站上公布后立即生效。继续使用我们的服务即表示您接受修改后的条款。`,
      },
      {
        title: '2. 服务描述',
        content: `畅游南澳是一个旅游预订平台，为用户提供南澳大利亚地区的旅游产品预订服务，包括但不限于：一日游、多日游、门票、接送服务等。

我们作为中介平台，连接用户与旅游服务提供商。实际的旅游服务由第三方服务提供商提供，我们不直接参与服务的执行。`,
      },
      {
        title: '3. 用户账户',
        content: `使用某些服务可能需要注册账户。您同意：
• 提供准确、完整的注册信息
• 保护账户安全，不与他人共享登录凭据
• 对账户下的所有活动负责
• 发现未授权使用时立即通知我们

我们有权在发现违规行为时暂停或终止账户。`,
      },
      {
        title: '4. 预订与支付',
        content: `4.1 预订确认
提交预订并完成支付后，您将收到确认邮件。只有收到确认邮件才表示预订成功。

4.2 价格与费用
所有价格均以澳元（AUD）显示。价格可能会变动，以预订时显示的价格为准。

4.3 支付安全
我们使用安全的第三方支付处理服务。我们不存储您的完整支付信息。`,
      },
      {
        title: '5. 取消与退款',
        content: `5.1 用户取消
取消政策因产品而异，请参阅具体产品的取消政策。一般规则：
• 出发前7天以上：全额退款
• 出发前3-7天：50%退款
• 出发前72小时内：不予退款

5.2 服务商取消
如服务商因故取消行程，您可选择改期或申请全额退款。

5.3 不可抗力
因天气、自然灾害等不可抗力导致的取消，我们将协助安排改期或退款。`,
      },
      {
        title: '6. 用户行为准则',
        content: `使用我们的服务时，您同意：
• 遵守所有适用的法律法规
• 尊重其他用户和服务提供商
• 不发布虚假、误导或有害信息
• 不进行任何可能损害平台运营的行为
• 不滥用优惠、促销或奖励机制

违反这些准则可能导致账户被暂停或终止。`,
      },
      {
        title: '7. 知识产权',
        content: `网站上的所有内容，包括但不限于文字、图片、图标、界面设计等，均受知识产权法保护。

未经我们书面许可，您不得复制、修改、分发或以其他方式使用这些内容。用户提交的评价和内容，授予我们非独占性的使用许可。`,
      },
      {
        title: '8. 免责声明',
        content: `8.1 服务"按现状"提供
我们尽力确保服务的可用性和准确性，但不保证服务不会中断或无错误。

8.2 第三方服务
对于第三方服务提供商的服务质量，我们不承担直接责任。如有纠纷，我们将尽力协助调解。

8.3 责任限制
在法律允许的范围内，我们的责任以您支付的预订费用为限。`,
      },
      {
        title: '9. 争议解决',
        content: `如发生争议，双方应首先通过友好协商解决。如协商不成，应提交至澳大利亚南澳州有管辖权的法院解决。

本条款受澳大利亚南澳州法律管辖并据其解释。`,
      },
      {
        title: '10. 联系我们',
        content: `如对本服务条款有任何疑问，请联系我们：

邮箱：legal@enjoysa.com.au
地址：Adelaide, South Australia, Australia
电话：+61 8 XXXX XXXX`,
      },
    ],
  },
  en: {
    title: 'Terms of Service',
    lastUpdated: 'Last Updated: January 2024',
    sections: [
      {
        title: '1. Acceptance of Terms',
        content: `Welcome to EnjoySA. By accessing or using our website and services, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our services.

We reserve the right to modify these terms at any time. Modified terms will be effective immediately upon posting on the website. Continued use of our services constitutes acceptance of the modified terms.`,
      },
      {
        title: '2. Service Description',
        content: `EnjoySA is a travel booking platform providing tourism product booking services in the South Australia region, including but not limited to: day tours, multi-day tours, tickets, and transfer services.

We act as an intermediary platform connecting users with tourism service providers. Actual travel services are provided by third-party service providers; we do not directly participate in service execution.`,
      },
      {
        title: '3. User Accounts',
        content: `Using certain services may require account registration. You agree to:
• Provide accurate and complete registration information
• Protect your account security and not share login credentials
• Be responsible for all activities under your account
• Notify us immediately upon discovering unauthorized use

We reserve the right to suspend or terminate accounts upon detecting violations.`,
      },
      {
        title: '4. Booking and Payment',
        content: `4.1 Booking Confirmation
After submitting a booking and completing payment, you will receive a confirmation email. Only receipt of a confirmation email indicates a successful booking.

4.2 Prices and Fees
All prices are displayed in Australian Dollars (AUD). Prices may change; the price at the time of booking applies.

4.3 Payment Security
We use secure third-party payment processing services. We do not store your complete payment information.`,
      },
      {
        title: '5. Cancellation and Refunds',
        content: `5.1 User Cancellation
Cancellation policies vary by product. Please refer to the specific product's cancellation policy. General rules:
• 7+ days before departure: Full refund
• 3-7 days before departure: 50% refund
• Within 72 hours of departure: No refund

5.2 Provider Cancellation
If a provider cancels, you may choose to reschedule or request a full refund.

5.3 Force Majeure
For cancellations due to weather, natural disasters, or other force majeure events, we will assist with rescheduling or refunds.`,
      },
      {
        title: '6. User Conduct',
        content: `When using our services, you agree to:
• Comply with all applicable laws and regulations
• Respect other users and service providers
• Not post false, misleading, or harmful information
• Not engage in any behavior that may harm platform operations
• Not abuse promotions, discounts, or reward mechanisms

Violation of these guidelines may result in account suspension or termination.`,
      },
      {
        title: '7. Intellectual Property',
        content: `All content on the website, including but not limited to text, images, icons, and interface designs, is protected by intellectual property laws.

Without our written permission, you may not copy, modify, distribute, or otherwise use this content. For user-submitted reviews and content, you grant us a non-exclusive license to use.`,
      },
      {
        title: '8. Disclaimer',
        content: `8.1 Service Provided "As Is"
We strive to ensure service availability and accuracy but do not guarantee uninterrupted or error-free service.

8.2 Third-Party Services
We are not directly responsible for the quality of third-party service providers' services. We will assist in mediating disputes.

8.3 Limitation of Liability
To the extent permitted by law, our liability is limited to the booking fees you paid.`,
      },
      {
        title: '9. Dispute Resolution',
        content: `In case of disputes, parties should first attempt amicable resolution. If unsuccessful, disputes should be submitted to a court of competent jurisdiction in South Australia, Australia.

These terms are governed by and construed in accordance with the laws of South Australia, Australia.`,
      },
      {
        title: '10. Contact Us',
        content: `If you have any questions about these Terms of Service, please contact us:

Email: legal@enjoysa.com.au
Address: Adelaide, South Australia, Australia
Phone: +61 8 XXXX XXXX`,
      },
    ],
  },
};

export const TermsPage: React.FC<TermsPageProps> = ({
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
          <h1 className={styles.title}>{t('terms.title')}</h1>
          <p className={styles.lastUpdated}>{t('terms.lastUpdated')}</p>

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

export default TermsPage;
