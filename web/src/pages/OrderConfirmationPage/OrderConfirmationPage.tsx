import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Printer, CheckCircle } from 'lucide-react';
import { getOrder, type Order } from '../../services/orderService';
import { formatPrice } from '../../utils/formatPrice';
import styles from './OrderConfirmationPage.module.css';

export interface OrderConfirmationPageProps {
  orderId?: string;
}

export const OrderConfirmationPage: React.FC<OrderConfirmationPageProps> = ({ orderId }) => {
  const { t, i18n } = useTranslation();
  const isZh = i18n.language?.startsWith('zh');
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orderId) return;
    getOrder(orderId).then(setOrder).catch(() => {}).finally(() => setLoading(false));
  }, [orderId]);

  if (loading) {
    return <div className={styles.loading}>{t('common.loading', 'Loading...')}</div>;
  }

  if (!order) {
    return <div className={styles.error}>{t('order.notFound', 'Order not found')}</div>;
  }

  const isConfirmed = ['accepted', 'processing', 'completed'].includes(order.status);
  if (!isConfirmed) {
    return <div className={styles.error}>{t('order.notConfirmed', 'This order has not been confirmed yet.')}</div>;
  }

  return (
    <div className={styles.page}>
      {/* Print button - hidden when printing */}
      <div className={styles.toolbar}>
        <button className={styles.printBtn} onClick={() => window.print()}>
          <Printer size={18} />
          {t('order.confirmation.downloadPdf', isZh ? '打印 / 保存 PDF' : 'Print / Save as PDF')}
        </button>
      </div>

      {/* Confirmation content */}
      <div className={styles.confirmation}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.logo}>
            <img src="/logo.svg" alt="EnjoySA" className={styles.logoImg} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
            <h1 className={styles.brandName}>EnjoySA 畅游南澳</h1>
          </div>
          <div className={styles.badge}>
            <CheckCircle size={20} />
            <span>{t('order.confirmation.title', isZh ? '预订确认单' : 'Booking Confirmation')}</span>
          </div>
        </div>

        {/* Order Info */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{t('order.confirmation.orderInfo', isZh ? '订单信息' : 'Order Information')}</h2>
          <table className={styles.table}>
            <tbody>
              <tr>
                <td className={styles.label}>{t('order.confirmation.orderNo', isZh ? '订单号' : 'Order No.')}</td>
                <td className={styles.value}>{order.order_no}</td>
              </tr>
              <tr>
                <td className={styles.label}>{t('order.confirmation.status', isZh ? '状态' : 'Status')}</td>
                <td className={styles.value}>{t(`order.status.${order.status}`, order.status)}</td>
              </tr>
              <tr>
                <td className={styles.label}>{t('order.confirmation.createdAt', isZh ? '下单时间' : 'Order Date')}</td>
                <td className={styles.value}>{new Date(order.created_at).toLocaleString()}</td>
              </tr>
              {order.accepted_at && (
                <tr>
                  <td className={styles.label}>{t('order.confirmation.confirmedAt', isZh ? '确认时间' : 'Confirmed At')}</td>
                  <td className={styles.value}>{new Date(order.accepted_at).toLocaleString()}</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        {/* Product Info */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{t('order.confirmation.productInfo', isZh ? '产品信息' : 'Product Details')}</h2>
          <table className={styles.table}>
            <tbody>
              <tr>
                <td className={styles.label}>{t('order.confirmation.product', isZh ? '产品' : 'Product')}</td>
                <td className={styles.value}>{order.product_name}</td>
              </tr>
              {order.package_name && (
                <tr>
                  <td className={styles.label}>{t('order.confirmation.package', isZh ? '套餐' : 'Package')}</td>
                  <td className={styles.value}>{order.package_name}</td>
                </tr>
              )}
              <tr>
                <td className={styles.label}>{t('order.confirmation.date', isZh ? '出行日期' : 'Travel Date')}</td>
                <td className={styles.value}>{order.booking_date}</td>
              </tr>
              <tr>
                <td className={styles.label}>{t('order.confirmation.guests', isZh ? '人数' : 'Guests')}</td>
                <td className={styles.value}>{order.guest_count || order.quantity}</td>
              </tr>
              <tr>
                <td className={styles.label}>{t('order.confirmation.supplier', isZh ? '供应商' : 'Supplier')}</td>
                <td className={styles.value}>{order.supplier_name}</td>
              </tr>
            </tbody>
          </table>
        </section>

        {/* Contact Info */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{t('order.confirmation.contactInfo', isZh ? '联系人信息' : 'Contact Information')}</h2>
          <table className={styles.table}>
            <tbody>
              <tr>
                <td className={styles.label}>{t('order.confirmation.contactName', isZh ? '姓名' : 'Name')}</td>
                <td className={styles.value}>{order.contact_name}</td>
              </tr>
              <tr>
                <td className={styles.label}>{t('order.confirmation.contactPhone', isZh ? '电话' : 'Phone')}</td>
                <td className={styles.value}>{order.contact_phone}</td>
              </tr>
              <tr>
                <td className={styles.label}>{t('order.confirmation.contactEmail', isZh ? '邮箱' : 'Email')}</td>
                <td className={styles.value}>{order.contact_email}</td>
              </tr>
            </tbody>
          </table>
        </section>

        {/* Payment Info */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{t('order.confirmation.paymentInfo', isZh ? '付款信息' : 'Payment')}</h2>
          <table className={styles.table}>
            <tbody>
              <tr>
                <td className={styles.label}>{t('order.confirmation.totalAmount', isZh ? '总金额' : 'Total Amount')}</td>
                <td className={`${styles.value} ${styles.amount}`}>
                  {formatPrice(order.total_price, order.currency)}
                </td>
              </tr>
              {order.payment_method && (
                <tr>
                  <td className={styles.label}>{t('order.confirmation.paymentMethod', isZh ? '支付方式' : 'Payment Method')}</td>
                  <td className={styles.value}>{order.payment_method}</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        {/* Footer */}
        <div className={styles.footer}>
          <p>{t('order.confirmation.footerNote', isZh
            ? '感谢您选择畅游南澳！如有问题请联系我们：tonylai@enjoysau.com.au'
            : 'Thank you for choosing EnjoySA! Contact us: tonylai@enjoysau.com.au'
          )}</p>
          <p className={styles.printDate}>
            {t('order.confirmation.printDate', isZh ? '打印时间' : 'Printed')}: {new Date().toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
};

export default OrderConfirmationPage;
