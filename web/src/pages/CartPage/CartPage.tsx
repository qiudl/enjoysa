import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Header,
  Footer,
  Button,
} from '../../components/Common';
import { useCart } from '../../contexts';
import styles from './CartPage.module.css';

export interface CartPageProps {
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
  /** 结算点击 */
  onCheckout?: () => void;
  /** 继续购物 */
  onContinueShopping?: () => void;
}

export const CartPage: React.FC<CartPageProps> = ({
  isLoggedIn = false,
  userName,
  userAvatar,
  cartCount = 0,
  onLoginClick,
  onRegisterClick,
  onNavClick,
  onSearch,
  onCheckout,
  onContinueShopping,
}) => {
  const { t, i18n } = useTranslation();
  const currentLang = (i18n.language?.startsWith('zh') ? 'zh' : 'en') as 'zh' | 'en';

  // 从 CartContext 获取真实购物车数据
  const { items, removeFromCart, updateQuantity, getCartTotal } = useCart();

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
          <h1 className={styles.title}>{t('cart.title')}</h1>

          {items.length === 0 ? (
            <div className={styles.emptyState}>
              <span className={styles.emptyIcon}>🛒</span>
              <h2>{t('cart.empty')}</h2>
              <p>{t('cart.emptyHint')}</p>
              <Button variant="primary" onClick={onContinueShopping}>
                {t('cart.goShopping')}
              </Button>
            </div>
          ) : (
            <div className={styles.cartContent}>
              {/* 购物车商品列表 */}
              <div className={styles.cartItems}>
                {items.map((item) => {
                  const title = currentLang === 'en' && item.product.titleEn
                    ? item.product.titleEn
                    : item.product.title;
                  const subtotal = item.product.price * item.quantity;

                  return (
                    <div key={item.product.id} className={styles.cartItem}>
                      <div className={styles.itemImage}>
                        <img
                          src={item.product.images[0]}
                          alt={title}
                        />
                      </div>
                      <div className={styles.itemInfo}>
                        <h3 className={styles.itemTitle}>{title}</h3>
                        {item.selectedDate && (
                          <p className={styles.itemDate}>
                            {t('cart.travelDate')}: {item.selectedDate}
                            {item.selectedTime && ` · ${item.selectedTime}`}
                          </p>
                        )}
                        <div className={styles.itemActions}>
                          <div className={styles.quantityControl}>
                            <button
                              className={styles.quantityBtn}
                              onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                              disabled={item.quantity <= 1}
                            >
                              −
                            </button>
                            <span className={styles.quantityValue}>{item.quantity}</span>
                            <button
                              className={styles.quantityBtn}
                              onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                              disabled={item.quantity >= 10}
                            >
                              +
                            </button>
                          </div>
                          <button
                            className={styles.removeBtn}
                            onClick={() => removeFromCart(item.product.id)}
                          >
                            {t('cart.remove')}
                          </button>
                        </div>
                      </div>
                      <div className={styles.itemPrice}>
                        <span className={styles.unitPrice}>¥{item.product.price}{t('product.perPerson')}</span>
                        <span className={styles.subtotal}>¥{subtotal}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* 结算区域 */}
              <div className={styles.summary}>
                <div className={styles.summaryRow}>
                  <span>{items.length} {t('cart.items')}</span>
                </div>
                <div className={styles.total}>
                  <span>{t('cart.totalAmount')}</span>
                  <span className={styles.totalPrice}>¥{getCartTotal()}</span>
                </div>
                <Button variant="primary" size="lg" fullWidth onClick={onCheckout}>
                  {t('cart.checkout')}
                </Button>
                <Button
                  variant="outline"
                  size="md"
                  fullWidth
                  onClick={onContinueShopping}
                  style={{ marginTop: '0.75rem' }}
                >
                  {t('cart.goShopping')}
                </Button>
              </div>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default CartPage;
