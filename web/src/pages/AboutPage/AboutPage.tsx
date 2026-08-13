import React from 'react';
import { ArrowRight, BadgeCheck, Compass, Handshake, Headphones, MapPinned, ShieldCheck, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Footer, Header } from '../../components/Common';
import styles from './AboutPage.module.css';

export interface AboutPageProps {
  isLoggedIn?: boolean;
  userName?: string;
  userAvatar?: string;
  cartCount?: number;
  onLoginClick?: () => void;
  onRegisterClick?: () => void;
  onNavClick?: (path: string) => void;
  onSearch?: (keyword: string) => void;
}

export const AboutPage: React.FC<AboutPageProps> = ({
  isLoggedIn = false,
  userName,
  userAvatar,
  cartCount = 0,
  onLoginClick,
  onRegisterClick,
  onNavClick,
  onSearch,
}) => {
  const { i18n } = useTranslation();
  const isZh = i18n.language?.startsWith('zh');

  const values = [
    {
      Icon: Sparkles,
      title: isZh ? '精选，而不是堆砌' : 'Curated, never crowded',
      text: isZh ? '我们从大量本地产品中筛选有特色、有品质、值得专程前往的真实体验。' : 'We select distinctive, high-quality local experiences that are genuinely worth travelling for.',
    },
    {
      Icon: MapPinned,
      title: isZh ? '本地深度，不只是打卡' : 'Local depth, beyond the checklist',
      text: isZh ? '从阿德莱德的街区到巴罗萨的酒庄，我们把交通、节奏和在地细节一起考虑。' : 'From Adelaide laneways to Barossa cellar doors, we plan with local rhythm and practical detail in mind.',
    },
    {
      Icon: Handshake,
      title: isZh ? '可信赖的本地合作' : 'Trusted local partnerships',
      text: isZh ? '与经过审核的供应商和旅游品牌合作，让信息、价格和服务更清晰。' : 'We work with reviewed operators and tourism brands so information, pricing and service remain clear.',
    },
  ];

  const services = [
    { label: isZh ? '景点体验' : 'Experiences', image: 'https://assets.atdw-online.com.au/images/0cdf1ff0d642973b3f8942d8cf0e88d9.jpeg?fit=crop&h=900&w=1200' },
    { label: isZh ? '美食美酒' : 'Food & Wine', image: 'https://assets.atdw-online.com.au/images/f41b1d4d4a4b58b9cc9909c6df142509.jpeg?fit=crop&w=1200&h=900&sharp=10&rot=360' },
    { label: isZh ? '特色住宿' : 'Unique Stays', image: 'https://demo.enjoysau.com/uploads/luxury-accommodation/luxury-14-1.jpg' },
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
          <span className={styles.eyebrow}>{isZh ? '关于 ENJOYSA' : 'ABOUT ENJOYSA'}</span>
          <h1>{isZh ? '更懂南澳，也更懂你的旅行' : 'South Australia, thoughtfully experienced'}</h1>
          <p>{isZh ? '一个专注南澳的中英双语旅行平台，连接值得信赖的本地供应商，让每一段行程更好选、更安心。' : 'A bilingual travel platform dedicated to South Australia, connecting travellers with trusted local operators and better-planned journeys.'}</p>
        </div>
        <div className={styles.heroMark}>SA</div>
      </section>

      <main>
        <section className={styles.story}>
          <div className={styles.storyImage}>
            <img src="https://assets.atdw-online.com.au/images/ad5498e704591af223b1f1d4c78202ef.jpeg?fit=crop&w=1400&h=1100&sharp=10&rot=360" alt={isZh ? '南澳大利亚菲尔半岛风景' : 'Fleurieu Peninsula, South Australia'} />
            <span>{isZh ? '深耕南澳' : 'ROOTED IN SOUTH AUSTRALIA'}</span>
          </div>
          <div className={styles.storyCopy}>
            <span className={styles.sectionNumber}>01 / {isZh ? '我们是谁' : 'WHO WE ARE'}</span>
            <h2>{isZh ? '把真正的南澳，交给每一位旅行者' : 'Sharing the South Australia we know and love'}</h2>
            <p>{isZh ? 'EnjoySA 畅游南澳专注于南澳大利亚的旅行产品与在地体验。我们希望解决的，不只是“去哪里”，而是“如何把这趟旅行过得更好”。' : 'EnjoySA focuses exclusively on travel and local experiences across South Australia. We help answer not only where to go, but how to make every day of the journey more rewarding.'}</p>
            <p>{isZh ? '我们将景点体验、美食美酒和特色住宿放在同一个清晰的平台上，提供中英双语信息与本地支持，帮助旅行者更高效地做出选择。' : 'Experiences, food and wine, and distinctive stays come together in one clear bilingual platform, backed by local support and useful detail.'}</p>
            <div className={styles.trustRow}>
              <span><BadgeCheck size={19} />{isZh ? '精选供应商' : 'Curated operators'}</span>
              <span><Headphones size={19} />{isZh ? '双语服务' : 'Bilingual support'}</span>
              <span><ShieldCheck size={19} />{isZh ? '透明信息' : 'Clear information'}</span>
            </div>
          </div>
        </section>

        <section className={styles.services}>
          <div className={styles.sectionHeading}>
            <span className={styles.sectionNumber}>02 / {isZh ? '我们专注' : 'OUR FOCUS'}</span>
            <h2>{isZh ? '一站找到南澳的好体验' : 'The best of South Australia, in one place'}</h2>
          </div>
          <div className={styles.serviceGrid}>
            {services.map((service, index) => (
              <article key={service.label} className={styles.serviceCard}>
                <img src={service.image} alt={`${service.label} - ${isZh ? '南澳' : 'South Australia'}`} loading="lazy" />
                <div className={styles.serviceShade} />
                <span>0{index + 1}</span>
                <h3>{service.label}</h3>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.values}>
          <div className={styles.sectionHeading}>
            <span className={styles.sectionNumber}>03 / {isZh ? '我们的原则' : 'OUR APPROACH'}</span>
            <h2>{isZh ? '专业，体现在每一个细节里' : 'Professional service, visible in every detail'}</h2>
          </div>
          <div className={styles.valueGrid}>
            {values.map(({ Icon, title, text }) => (
              <article key={title} className={styles.valueCard}>
                <Icon size={28} strokeWidth={1.55} />
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.vision}>
          <Compass size={34} strokeWidth={1.4} />
          <span className={styles.eyebrow}>{isZh ? '我们的愿景' : 'OUR VISION'}</span>
          <blockquote>{isZh ? '成为旅行者探索南澳时，值得信赖的第一站。' : 'To be the trusted first stop for every journey through South Australia.'}</blockquote>
          <p>{isZh ? '无论是第一次到访，还是重新发现家门口的风景，我们都希望让南澳之旅更深入、更从容、更难忘。' : 'Whether it is your first visit or a new look at somewhere familiar, we want every South Australian journey to feel richer, easier and more memorable.'}</p>
          <button type="button" data-testid="about-btn-contact" onClick={() => onNavClick?.('/contact')}>
            {isZh ? '联系我们' : 'Talk to our team'} <ArrowRight size={18} />
          </button>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default AboutPage;
