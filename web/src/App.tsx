import React, { Suspense, useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useParams, useSearchParams, useLocation, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { RegionProvider } from './contexts/RegionContext';
import { lazyWithSelfHeal } from './chunkSelfHeal';
// 首页同步加载（首屏性能）
import { HomePage } from './pages/HomePage';
// 所有其他页面懒加载
const LoginPage = lazyWithSelfHeal(() => import('./pages/LoginPage/LoginPage'));
const ForgotPasswordPage = lazyWithSelfHeal(() => import('./pages/ForgotPasswordPage/ForgotPasswordPage'));
const ResetPasswordPage = lazyWithSelfHeal(() => import('./pages/ResetPasswordPage/ResetPasswordPage'));
const ProductListPage = lazyWithSelfHeal(() => import('./pages/ProductListPage/ProductListPage'));
const ProductDetailPage = lazyWithSelfHeal(() => import('./pages/ProductDetailPage/ProductDetailPage'));
const PlanPage = lazyWithSelfHeal(() => import('./pages/PlanPage/PlanPage'));
const CheckoutPage = lazyWithSelfHeal(() => import('./pages/CheckoutPage/CheckoutPage'));
const MyOrdersPage = lazyWithSelfHeal(() => import('./pages/MyOrdersPage/MyOrdersPage'));
const OrderDetailPage = lazyWithSelfHeal(() => import('./pages/OrderDetailPage/OrderDetailPage'));
const OrderConfirmationPage = lazyWithSelfHeal(() => import('./pages/OrderConfirmationPage/OrderConfirmationPage'));
const UserProfilePage = lazyWithSelfHeal(() => import('./pages/UserProfilePage/UserProfilePage'));
const UserProfileEditPage = lazyWithSelfHeal(() => import('./pages/UserProfileEditPage/UserProfileEditPage'));
const DestinationsPage = lazyWithSelfHeal(() => import('./pages/DestinationsPage/DestinationsPage'));
const CategoriesPage = lazyWithSelfHeal(() => import('./pages/CategoriesPage/CategoriesPage'));
const AboutPage = lazyWithSelfHeal(() => import('./pages/AboutPage/AboutPage'));
const ContactPage = lazyWithSelfHeal(() => import('./pages/ContactPage/ContactPage'));
const CartPage = lazyWithSelfHeal(() => import('./pages/CartPage/CartPage'));
const FavoritesPage = lazyWithSelfHeal(() => import('./pages/FavoritesPage/FavoritesPage'));
const SupplierShopPage = lazyWithSelfHeal(() => import('./pages/SupplierShopPage/SupplierShopPage'));
const FaqPage = lazyWithSelfHeal(() => import('./pages/FaqPage/FaqPage'));
const TermsPage = lazyWithSelfHeal(() => import('./pages/TermsPage/TermsPage'));
const PrivacyPage = lazyWithSelfHeal(() => import('./pages/PrivacyPage/PrivacyPage'));
const HotelSearchPage = lazyWithSelfHeal(() => import('./pages/HotelSearchPage/HotelSearchPage'));
const RegionPage = lazyWithSelfHeal(() => import('./pages/RegionPage/RegionPage'));
// B端供应商页面
const SupplierDashboardPage = lazyWithSelfHeal(() => import('./pages/Supplier/SupplierDashboardPage/SupplierDashboardPage'));
const SupplierProductListPage = lazyWithSelfHeal(() => import('./pages/Supplier/SupplierProductListPage/SupplierProductListPage'));
const SupplierProductFormPage = lazyWithSelfHeal(() => import('./pages/Supplier/SupplierProductFormPage/SupplierProductFormPage'));
const SupplierSchedulePage = lazyWithSelfHeal(() => import('./pages/Supplier/SupplierSchedulePage/SupplierSchedulePage'));
const SupplierOrderListPage = lazyWithSelfHeal(() => import('./pages/Supplier/SupplierOrderListPage/SupplierOrderListPage'));
const SupplierReviewsPage = lazyWithSelfHeal(() => import('./pages/Supplier/SupplierReviewsPage/SupplierReviewsPage'));
const SupplierSettlementPage = lazyWithSelfHeal(() => import('./pages/Supplier/SupplierSettlementPage/SupplierSettlementPage'));
const SupplierExportPage = lazyWithSelfHeal(() => import('./pages/Supplier/SupplierExportPage/SupplierExportPage'));
const SupplierTeamPage = lazyWithSelfHeal(() => import('./pages/Supplier/SupplierTeamPage/SupplierTeamPage'));
const SupplierNotificationsPage = lazyWithSelfHeal(() => import('./pages/Supplier/SupplierNotificationsPage/SupplierNotificationsPage'));
const SupplierAfterSalesPage = lazyWithSelfHeal(() => import('./pages/Supplier/SupplierAfterSalesPage/SupplierAfterSalesPage'));
const SupplierCreateTicketPage = lazyWithSelfHeal(() => import('./pages/Supplier/SupplierCreateTicketPage/SupplierCreateTicketPage'));
const SupplierReportsPage = lazyWithSelfHeal(() => import('./pages/Supplier/SupplierReportsPage/SupplierReportsPage'));
const SupplierAuditLogPage = lazyWithSelfHeal(() => import('./pages/Supplier/SupplierAuditLogPage/SupplierAuditLogPage'));
const SupplierSettingsPage = lazyWithSelfHeal(() => import('./pages/Supplier/SupplierSettingsPage/SupplierSettingsPage'));
const SupplierTicketDetailPage = lazyWithSelfHeal(() => import('./pages/Supplier/SupplierTicketDetailPage/SupplierTicketDetailPage'));
const SupplierOrderDetailPage = lazyWithSelfHeal(() => import('./pages/Supplier/SupplierOrderDetailPage/SupplierOrderDetailPage'));
const SupplierProductPreviewPage = lazyWithSelfHeal(() => import('./pages/Supplier/SupplierProductPreviewPage/SupplierProductPreviewPage'));
// REQ-20260510-0001 F2: 双语 C 端预览（区别于 SupplierProductPreviewPage 的单语预览）
const SupplierProductPreviewBilingualPage = lazyWithSelfHeal(() => import('./pages/Supplier/SupplierProductPreviewBilingualPage/SupplierProductPreviewBilingualPage'));
const SupplierLoginPage = lazyWithSelfHeal(() => import('./pages/Supplier/SupplierLoginPage/SupplierLoginPage'));
const SupplierRegisterPage = lazyWithSelfHeal(() => import('./pages/Supplier/SupplierRegisterPage/SupplierRegisterPage'));
const AIChatPage = lazyWithSelfHeal(() => import('./pages/Supplier/SupplierAIChatPage/SupplierAIChatPage'));
// REQ-20260509-0037 dev-8: new 3-col group chat (workspace + channels + threads).
// Coexists with the legacy /supplier/ai-chat until dev-9/10 land thread panel + create modal.
const SupplierGroupChatPage = lazyWithSelfHeal(() => import('./pages/Supplier/SupplierGroupChatPage/SupplierGroupChatPage'));

// Wrapper that pulls the :id route param and forwards it to AIChatPage so
// Feishu share-card links like /admin/ai-chat/sessions/9 auto-load that
// session on mount instead of 404.
function AIChatPageWithRouteSession({ role, backPath }: { role: 'supplier' | 'admin'; backPath: string }) {
  const { id } = useParams();
  const sessionId = id ? Number(id) : undefined;
  return <AIChatPage role={role} backPath={backPath} sessionIdFromRoute={sessionId} />;
}
// 用户中心
const ContactsPage = lazyWithSelfHeal(() => import('./pages/ContactsPage/ContactsPage'));
// 平台管理端页面
const AdminLoginPage = lazyWithSelfHeal(() => import('./pages/Admin/AdminLoginPage/AdminLoginPage'));
const DashboardPage = lazyWithSelfHeal(() => import('./pages/Admin/DashboardPage/DashboardPage'));
const SupplierList = lazyWithSelfHeal(() => import('./pages/Admin/SupplierList/SupplierList'));
const SupplierDetailPage = lazyWithSelfHeal(() => import('./pages/Admin/SupplierDetailPage/SupplierDetailPage'));
const ProductReviewList = lazyWithSelfHeal(() => import('./pages/Admin/ProductReviewList/ProductReviewList'));
const AdminProductFormPage = lazyWithSelfHeal(() => import('./pages/Admin/AdminProductFormPage/AdminProductFormPage'));
const OrderList = lazyWithSelfHeal(() => import('./pages/Admin/OrderList/OrderList'));
const UserList = lazyWithSelfHeal(() => import('./pages/Admin/UserList/UserList'));
const FinanceList = lazyWithSelfHeal(() => import('./pages/Admin/FinanceList/FinanceList'));
const AdminList = lazyWithSelfHeal(() => import('./pages/Admin/AdminList/AdminList'));
const SettingsPage = lazyWithSelfHeal(() => import('./pages/Admin/SettingsPage/SettingsPage'));
const BannerList = lazyWithSelfHeal(() => import('./pages/Admin/BannerList/BannerList'));
const RegionList = lazyWithSelfHeal(() => import('./pages/Admin/RegionList/RegionList'));
const CategoryList = lazyWithSelfHeal(() => import('./pages/Admin/CategoryList/CategoryList'));
const HomepageCMS = lazyWithSelfHeal(() => import('./pages/Admin/HomepageCMS/HomepageCMS'));
const AIChatTestPage = lazyWithSelfHeal(() => import('./pages/Admin/AIChatTestPage/AIChatTestPage'));
const TourismKnowledge = lazyWithSelfHeal(() => import('./pages/Admin/TourismKnowledge'));

import { CartProvider, useCart, UserAuthProvider, useUserAuth, SupplierAuthProvider, useSupplierAuth, AdminAuthProvider, useAdminAuth } from './contexts';
import { ChatProvider } from './contexts/ChatContext';
import { ChatWidget } from './components/Common/ChatWidget';
import { SupplierAuthGuard } from './components/Common/SupplierAuthGuard';
import { AdminAuthGuard } from './components/Common/AdminAuthGuard';
import { AdminLayout } from './components/Admin';
import { SupplierLayout } from './components/Supplier/SupplierLayout';
import './App.css';

function PageLoading() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
      <div style={{ width: 32, height: 32, border: '3px solid #e5e7eb', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// Error Boundary for debugging blank pages
class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[AppErrorBoundary]', error, info.componentStack);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem', fontFamily: 'monospace' }}>
          <h1 style={{ color: 'red' }}>Page Crashed</h1>
          <pre style={{ whiteSpace: 'pre-wrap', background: '#f5f5f5', padding: '1rem', borderRadius: '8px' }}>
            {this.state.error?.message}
            {'\n\n'}
            {this.state.error?.stack}
          </pre>
          <button onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
            style={{ marginTop: '1rem', padding: '0.5rem 1rem', cursor: 'pointer' }}>
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// 包装组件：HomePage
function HomePageWrapper() {
  const navigate = useNavigate();
  const { getCartCount } = useCart();
  const { user, isAuthenticated } = useUserAuth();

  return (
    <HomePage
      isLoggedIn={isAuthenticated}
      userName={user?.name}
      cartCount={getCartCount()}
      onProductClick={(product) => navigate(`/product/${product.id}`)}
      onRegionClick={(region) => navigate(`/regions/${region.id}`)}
      onAttractionClick={(attractionId) => navigate(`/attractions/${attractionId}`)}
      onCategoryClick={(cat) => navigate(`/categories/${cat.id}`)}
      onLoginClick={() => navigate('/login')}
      onRegisterClick={() => navigate('/register')}
      onSearch={(keyword) => navigate(`/search?q=${encodeURIComponent(keyword)}`)}
      onHotelSearch={(params) => {
        const qs = new URLSearchParams();
        if (params.keyword) qs.set('keyword', params.keyword);
        if (params.regionId) qs.set('region', String(params.regionId));
        navigate(`/hotels?${qs.toString()}`);
      }}
      onNavClick={(path) => navigate(path)}
    />
  );
}

// 包装组件：PlanPage (AI 行程规划)
function PlanPageWrapper() {
  const navigate = useNavigate();
  return (
    <PlanPage
      onLoginClick={() => navigate('/login')}
      onRegisterClick={() => navigate('/register')}
      onNavClick={(path) => navigate(path)}
    />
  );
}

// 包装组件：HotelSearchPage
function HotelSearchPageWrapper() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { getCartCount } = useCart();

  return (
    <HotelSearchPage
      cartCount={getCartCount()}
      initialKeyword={searchParams.get('keyword') || ''}
      initialRegionId={searchParams.get('region') ? Number(searchParams.get('region')) : undefined}
      onHotelClick={(hotelId) => navigate(`/product/${hotelId}`)}
      onLoginClick={() => navigate('/login')}
      onRegisterClick={() => navigate('/register')}
      onNavClick={(path) => navigate(path)}
    />
  );
}

// 包装组件：RegionPage
function RegionPageWrapper() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { getCartCount } = useCart();

  return (
    <RegionPage
      regionId={id}
      cartCount={getCartCount()}
      onAttractionClick={(attractionId) => navigate(`/attractions/${attractionId}`)}
      onLoginClick={() => navigate('/login')}
      onRegisterClick={() => navigate('/register')}
      onNavClick={(path) => navigate(path)}
      onSearch={(keyword) => navigate(`/search?q=${encodeURIComponent(keyword)}`)}
      onBack={() => navigate(-1)}
    />
  );
}

// 包装组件：LoginPage
function LoginPageWrapper() {
  const navigate = useNavigate();
  const { login, register, googleLogin } = useUserAuth();

  return (
    <LoginPage
      initialMode="login"
      onLogin={login}
      onRegister={register}
      onGoogleLogin={async (idToken) => {
        const success = await googleLogin(idToken);
        if (success) navigate('/');
        return success;
      }}
      onLoginSuccess={() => navigate('/')}
      onRegisterSuccess={() => navigate('/')}
      onNavigateHome={() => navigate('/')}
      onForgotPassword={() => navigate('/forgot-password')}
    />
  );
}

// 包装组件：ForgotPasswordPage
function ForgotPasswordPageWrapper() {
  const navigate = useNavigate();

  return (
    <ForgotPasswordPage
      onNavigateHome={() => navigate('/')}
      onBackToLogin={() => navigate('/login')}
    />
  );
}

// 包装组件：ResetPasswordPage
function ResetPasswordPageWrapper() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || undefined;

  return (
    <ResetPasswordPage
      token={token}
      onNavigateHome={() => navigate('/')}
      onGoToLogin={() => navigate('/login')}
      onRequestNewLink={() => navigate('/forgot-password')}
    />
  );
}

// 包装组件：RegisterPage
function RegisterPageWrapper() {
  const navigate = useNavigate();
  const { login, register, googleLogin } = useUserAuth();

  return (
    <LoginPage
      initialMode="register"
      onLogin={login}
      onRegister={register}
      onGoogleLogin={async (idToken) => {
        const success = await googleLogin(idToken);
        if (success) navigate('/');
        return success;
      }}
      onLoginSuccess={() => navigate('/')}
      onRegisterSuccess={() => navigate('/')}
      onNavigateHome={() => navigate('/')}
    />
  );
}

// 包装组件：ProductListPage
function ProductListPageWrapper() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const keyword = searchParams.get('q') || '';
  const { getCartCount } = useCart();

  return (
    <ProductListPage
      initialKeyword={keyword}
      cartCount={getCartCount()}
      onProductClick={(product) => navigate(`/product/${product.id}`)}
      onLoginClick={() => navigate('/login')}
      onRegisterClick={() => navigate('/register')}
      onNavClick={(path) => navigate(path)}
    />
  );
}

// 包装组件：ProductDetailPage
function ProductDetailPageWrapper() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { addToCart, getCartCount } = useCart();

  return (
    <ProductDetailPage
      productId={id}
      cartCount={getCartCount()}
      onBookNow={(data) => navigate('/checkout', {
        state: {
          productId: id,
          quantity: data.quantity,
          travelDate: data.selectedDate,
          packageId: data.packageId,
          scheduleId: data.scheduleId,
          selectedTime: data.timeSlot,
          unitPrice: data.unitPrice,
        }
      })}
      onAddToCart={(product, selectedDate, selectedTime, pkgId, schId) => {
        addToCart(product, 1, selectedDate, selectedTime, pkgId, schId);
      }}
      onLoginClick={() => navigate('/login')}
      onRegisterClick={() => navigate('/register')}
      onNavClick={(path) => navigate(path)}
    />
  );
}

// 包装组件：CheckoutPage
function CheckoutPageWrapper() {
  const navigate = useNavigate();
  const { items, getCartCount, clearCart } = useCart();
  const { isAuthenticated } = useUserAuth();
  const location = useLocation();
  const state = location.state as {
    productId?: string;
    quantity?: number;
    travelDate?: string;
    packageId?: number;
    scheduleId?: number;
    selectedTime?: string;
    unitPrice?: number;
  } | null;

  return (
    <CheckoutPage
      productId={state?.productId}
      adultCount={state?.quantity}
      travelDate={state?.travelDate}
      packageId={state?.packageId}
      scheduleId={state?.scheduleId}
      selectedTime={state?.selectedTime}
      unitPrice={state?.unitPrice}
      isLoggedIn={isAuthenticated}
      cartCount={getCartCount()}
      cartItems={!state?.productId ? items : undefined}
      onClearCart={clearCart}
      onOrderSuccess={(orderId) => navigate(`/orders?highlight=${orderId}`)}
      onLoginRequired={() => navigate('/login')}
      onNavClick={(path) => navigate(path)}
      onBack={() => navigate(-1)}
    />
  );
}

// 包装组件：OrderDetailPage
function OrderDetailPageWrapper() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { getCartCount } = useCart();
  const paymentStatus = searchParams.get('status');

  const handleClearPaymentStatus = () => {
    searchParams.delete('status');
    setSearchParams(searchParams, { replace: true });
  };

  return (
    <OrderDetailPage
      orderId={id}
      cartCount={getCartCount()}
      paymentStatus={paymentStatus}
      onClearPaymentStatus={handleClearPaymentStatus}
      onLoginClick={() => navigate('/login')}
      onRegisterClick={() => navigate('/register')}
      onNavClick={(path) => navigate(path)}
    />
  );
}

// 包装组件：OrderConfirmationPage
function OrderConfirmationPageWrapper() {
  const { id } = useParams();
  return <OrderConfirmationPage orderId={id} />;
}

// 包装组件：MyOrdersPage
function MyOrdersPageWrapper() {
  const navigate = useNavigate();
  const { getCartCount } = useCart();
  const { user, isAuthenticated } = useUserAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <MyOrdersPage
      userName={user?.name}
      cartCount={getCartCount()}
      onOrderClick={(order) => navigate(`/orders/${order.numericId}`)}
      onLoginClick={() => navigate('/login')}
      onRegisterClick={() => navigate('/register')}
      onNavClick={(path) => navigate(path)}
    />
  );
}

// 包装组件：UserProfilePage
function UserProfilePageWrapper() {
  const navigate = useNavigate();
  const { getCartCount } = useCart();
  const { user, isAuthenticated, logout } = useUserAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <UserProfilePage
      userName={user?.name}
      userEmail={user?.email}
      userPhone={user?.phone}
      userAvatar={user?.avatar}
      googleBound={user?.google_bound ?? false}
      cartCount={getCartCount()}
      onLogout={() => { logout(); navigate('/'); }}
      onEditProfile={() => navigate('/profile/edit')}
      onLoginClick={() => navigate('/login')}
      onRegisterClick={() => navigate('/register')}
      onNavClick={(path) => navigate(path)}
    />
  );
}

// 包装组件：UserProfileEditPage
function UserProfileEditPageWrapper() {
  const navigate = useNavigate();
  const { getCartCount } = useCart();
  const { user, isAuthenticated, updateProfile, logout } = useUserAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const handleGoogleBoundChange = (_bound: boolean) => {
    // The component manages its own local state; context will refresh on next profile fetch
  };

  return (
    <UserProfileEditPage
      userName={user?.name}
      userEmail={user?.email}
      userPhone={user?.phone}
      userAvatar={user?.avatar}
      userLanguage={user?.language || 'zh-CN'}
      googleBound={user?.google_bound ?? false}
      cartCount={getCartCount()}
      onSave={updateProfile}
      onGoogleBoundChange={handleGoogleBoundChange}
      onBack={() => navigate('/profile')}
      onLogout={() => { logout(); navigate('/'); }}
      onLoginClick={() => navigate('/login')}
      onRegisterClick={() => navigate('/register')}
      onNavClick={(path) => navigate(path)}
    />
  );
}

// 包装组件：ContactsPage
function ContactsPageWrapper() {
  const navigate = useNavigate();
  const { getCartCount } = useCart();
  const { isAuthenticated } = useUserAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <ContactsPage
      cartCount={getCartCount()}
      onLoginClick={() => navigate('/login')}
      onRegisterClick={() => navigate('/register')}
      onNavClick={(path) => navigate(path)}
      onBack={() => navigate('/profile')}
    />
  );
}

// 包装组件：DestinationsPage
function DestinationsPageWrapper() {
  const navigate = useNavigate();
  const { getCartCount } = useCart();

  return (
    <DestinationsPage
      cartCount={getCartCount()}
      onDestinationClick={(dest) => navigate(`/products?destination=${dest.id}`)}
      onLoginClick={() => navigate('/login')}
      onRegisterClick={() => navigate('/register')}
      onNavClick={(path) => navigate(path)}
      onSearch={(keyword) => navigate(`/search?q=${encodeURIComponent(keyword)}`)}
    />
  );
}

// 包装组件：CategoriesPage
function CategoriesPageWrapper() {
  const navigate = useNavigate();
  const { getCartCount } = useCart();

  return (
    <CategoriesPage
      cartCount={getCartCount()}
      onCategoryClick={(cat) => navigate(`/products?category=${cat.id}`)}
      onLoginClick={() => navigate('/login')}
      onRegisterClick={() => navigate('/register')}
      onNavClick={(path) => navigate(path)}
      onSearch={(keyword) => navigate(`/search?q=${encodeURIComponent(keyword)}`)}
    />
  );
}

// 包装组件：AboutPage
function AboutPageWrapper() {
  const navigate = useNavigate();
  const { getCartCount } = useCart();

  return (
    <AboutPage
      cartCount={getCartCount()}
      onLoginClick={() => navigate('/login')}
      onRegisterClick={() => navigate('/register')}
      onNavClick={(path) => navigate(path)}
      onSearch={(keyword) => navigate(`/search?q=${encodeURIComponent(keyword)}`)}
    />
  );
}

// 包装组件：ContactPage
function ContactPageWrapper() {
  const navigate = useNavigate();
  const { getCartCount } = useCart();

  return (
    <ContactPage
      cartCount={getCartCount()}
      onLoginClick={() => navigate('/login')}
      onRegisterClick={() => navigate('/register')}
      onNavClick={(path) => navigate(path)}
      onSearch={(keyword) => navigate(`/search?q=${encodeURIComponent(keyword)}`)}
    />
  );
}

// 包装组件：CartPage
function CartPageWrapper() {
  const navigate = useNavigate();
  const { getCartCount } = useCart();

  return (
    <CartPage
      cartCount={getCartCount()}
      onLoginClick={() => navigate('/login')}
      onRegisterClick={() => navigate('/register')}
      onNavClick={(path) => navigate(path)}
      onSearch={(keyword) => navigate(`/search?q=${encodeURIComponent(keyword)}`)}
      onCheckout={() => navigate('/checkout')}
      onContinueShopping={() => navigate('/products')}
    />
  );
}

// 包装组件：SupplierShopPage
function SupplierShopPageWrapper() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { getCartCount } = useCart();

  return (
    <SupplierShopPage
      supplierId={id}
      cartCount={getCartCount()}
      onProductClick={(product) => navigate(`/product/${product.id}`)}
      onLoginClick={() => navigate('/login')}
      onRegisterClick={() => navigate('/register')}
      onNavClick={(path) => navigate(path)}
      onSearch={(keyword) => navigate(`/search?q=${encodeURIComponent(keyword)}`)}
    />
  );
}

// 包装组件：FavoritesPage
function FavoritesPageWrapper() {
  const navigate = useNavigate();
  const { getCartCount } = useCart();

  return (
    <FavoritesPage
      cartCount={getCartCount()}
      onLoginClick={() => navigate('/login')}
      onRegisterClick={() => navigate('/register')}
      onNavClick={(path) => navigate(path)}
      onSearch={(keyword) => navigate(`/search?q=${encodeURIComponent(keyword)}`)}
      onExplore={() => navigate('/products')}
    />
  );
}

// 包装组件：FaqPage
function FaqPageWrapper() {
  const navigate = useNavigate();
  const { getCartCount } = useCart();

  return (
    <FaqPage
      cartCount={getCartCount()}
      onLoginClick={() => navigate('/login')}
      onRegisterClick={() => navigate('/register')}
      onNavClick={(path) => navigate(path)}
      onSearch={(keyword) => navigate(`/search?q=${encodeURIComponent(keyword)}`)}
    />
  );
}

// 包装组件：TermsPage
function TermsPageWrapper() {
  const navigate = useNavigate();
  const { getCartCount } = useCart();

  return (
    <TermsPage
      cartCount={getCartCount()}
      onLoginClick={() => navigate('/login')}
      onRegisterClick={() => navigate('/register')}
      onNavClick={(path) => navigate(path)}
      onSearch={(keyword) => navigate(`/search?q=${encodeURIComponent(keyword)}`)}
    />
  );
}

// 包装组件：PrivacyPage
function PrivacyPageWrapper() {
  const navigate = useNavigate();
  const { getCartCount } = useCart();

  return (
    <PrivacyPage
      cartCount={getCartCount()}
      onLoginClick={() => navigate('/login')}
      onRegisterClick={() => navigate('/register')}
      onNavClick={(path) => navigate(path)}
      onSearch={(keyword) => navigate(`/search?q=${encodeURIComponent(keyword)}`)}
    />
  );
}

// =====================
// B端供应商页面包装组件
// =====================

// 包装组件：SupplierLoginPage
function SupplierLoginPageWrapper() {
  const navigate = useNavigate();
  const { login, isAuthenticated } = useSupplierAuth();

  // If already logged in, redirect to dashboard
  if (isAuthenticated) {
    return <Navigate to="/supplier" replace />;
  }

  const handleLoginSuccess = async (email: string, password: string) => {
    const success = await login(email, password);
    if (success) {
      navigate('/supplier');
    }
    return success;
  };

  return (
    <SupplierLoginPage
      onLoginSuccess={() => navigate('/supplier')}
      onApplyClick={() => navigate('/supplier/register')}
      onNavigateHome={() => navigate('/')}
      onLogin={handleLoginSuccess}
    />
  );
}

// 包装组件：SupplierRegisterPage
function SupplierRegisterPageWrapper() {
  const navigate = useNavigate();

  return (
    <SupplierRegisterPage
      onRegisterSuccess={() => {
        // Show success message and redirect to login
        navigate('/supplier/login');
      }}
      onBackToLogin={() => navigate('/supplier/login')}
      onNavigateHome={() => navigate('/')}
    />
  );
}

// 包装组件：SupplierDashboardPage
function SupplierDashboardPageWrapper() {
  const { supplier } = useSupplierAuth();
  const navigate = useNavigate();

  return (
    <SupplierLayout>
      <SupplierDashboardPage
        supplierName={supplier?.supplier?.name || supplier?.name || '供应商'}
        supplierType={(supplier?.supplier?.type || 'travel_agency') as 'travel_agency' | 'hotel' | 'attraction' | 'restaurant' | 'car_rental'}
        onNavigate={(path) => navigate(path)}
      />
    </SupplierLayout>
  );
}

// 包装组件：SupplierProductListPage
function SupplierProductListPageWrapper() {
  const navigate = useNavigate();

  return (
    <SupplierLayout>
      <SupplierProductListPage
        onNavigate={(path) => navigate(path)}
      />
    </SupplierLayout>
  );
}

// 包装组件：SupplierProductFormPage (新建产品)
function SupplierProductNewPageWrapper() {
  const navigate = useNavigate();

  return (
    <SupplierLayout>
      <SupplierProductFormPage
        onNavigate={(path) => navigate(path)}
      />
    </SupplierLayout>
  );
}

// 包装组件：SupplierProductFormPage (编辑产品)
function SupplierProductEditPageWrapper() {
  const navigate = useNavigate();
  const { id } = useParams();

  return (
    <SupplierLayout>
      <SupplierProductFormPage
        productId={id}
        onNavigate={(path) => navigate(path)}
      />
    </SupplierLayout>
  );
}

// 包装组件：SupplierSchedulePage
function SupplierSchedulePageWrapper() {
  const navigate = useNavigate();
  const { id } = useParams();

  return (
    <SupplierLayout>
      <SupplierSchedulePage
        productId={id}
        onNavigate={(path) => navigate(path)}
      />
    </SupplierLayout>
  );
}

// 包装组件：SupplierOrderListPage
function SupplierOrderListPageWrapper() {
  const navigate = useNavigate();

  return (
    <SupplierLayout>
      <SupplierOrderListPage
        onNavigate={(path) => navigate(path)}
      />
    </SupplierLayout>
  );
}

// 包装组件：SupplierReviewsPage
function SupplierReviewsPageWrapper() {
  const navigate = useNavigate();

  return (
    <SupplierLayout>
      <SupplierReviewsPage
        onNavigate={(path) => navigate(path)}
      />
    </SupplierLayout>
  );
}

// 包装组件：SupplierSettlementPage
function SupplierSettlementPageWrapper() {
  const navigate = useNavigate();

  return (
    <SupplierLayout>
      <SupplierSettlementPage
        onNavigate={(path) => navigate(path)}
      />
    </SupplierLayout>
  );
}

// 包装组件：SupplierExportPage
function SupplierExportPageWrapper() {
  const navigate = useNavigate();

  return (
    <SupplierLayout>
      <SupplierExportPage
        onNavigate={(path) => navigate(path)}
      />
    </SupplierLayout>
  );
}

// 包装组件：SupplierTeamPage
function SupplierTeamPageWrapper() {
  const navigate = useNavigate();

  return (
    <SupplierLayout>
      <SupplierTeamPage
        onNavigate={(path) => navigate(path)}
      />
    </SupplierLayout>
  );
}

// 包装组件：SupplierNotificationsPage
function SupplierNotificationsPageWrapper() {
  const navigate = useNavigate();

  return (
    <SupplierLayout>
      <SupplierNotificationsPage
        onNavigate={(path) => navigate(path)}
      />
    </SupplierLayout>
  );
}

// 包装组件：SupplierAfterSalesPage
function SupplierAfterSalesPageWrapper() {
  const navigate = useNavigate();

  return (
    <SupplierLayout>
      <SupplierAfterSalesPage
        onNavigate={(path) => navigate(path)}
      />
    </SupplierLayout>
  );
}

// 包装组件：SupplierCreateTicketPage
function SupplierCreateTicketPageWrapper() {
  const navigate = useNavigate();

  return (
    <SupplierLayout>
      <SupplierCreateTicketPage
        onNavigate={(path) => navigate(path)}
      />
    </SupplierLayout>
  );
}

// 包装组件：SupplierReportsPage
function SupplierReportsPageWrapper() {
  return (
    <SupplierLayout>
      <SupplierReportsPage />
    </SupplierLayout>
  );
}

// 包装组件：SupplierAuditLogPage
function SupplierAuditLogPageWrapper() {
  return (
    <SupplierLayout>
      <SupplierAuditLogPage />
    </SupplierLayout>
  );
}

// 包装组件：SupplierSettingsPage
function SupplierSettingsPageWrapper() {
  return (
    <SupplierLayout>
      <SupplierSettingsPage />
    </SupplierLayout>
  );
}

// 包装组件：SupplierTicketDetailPage
function SupplierTicketDetailPageWrapper() {
  const navigate = useNavigate();
  const { id } = useParams();

  return (
    <SupplierLayout>
      <SupplierTicketDetailPage
        ticketId={id}
        onNavigate={(path) => navigate(path)}
      />
    </SupplierLayout>
  );
}

// 包装组件：SupplierOrderDetailPage
function SupplierOrderDetailPageWrapper() {
  const navigate = useNavigate();
  const { id } = useParams();

  return (
    <SupplierLayout>
      <SupplierOrderDetailPage
        orderId={id}
        onNavigate={(path) => navigate(path)}
      />
    </SupplierLayout>
  );
}

// 包装组件：SupplierProductPreviewPage
function SupplierProductPreviewPageWrapper() {
  const navigate = useNavigate();
  const { id } = useParams();

  return (
    <SupplierLayout>
      <SupplierProductPreviewPage
        productId={id}
        onNavigate={(path) => navigate(path)}
      />
    </SupplierLayout>
  );
}

// REQ-20260510-0001 F2: 包装组件 — Supplier 双语 C 端预览
function SupplierProductPreviewBilingualPageWrapper() {
  const navigate = useNavigate();
  const { id } = useParams();

  return (
    <SupplierLayout>
      <SupplierProductPreviewBilingualPage
        productId={id}
        onNavigate={(path) => navigate(path)}
      />
    </SupplierLayout>
  );
}

// =====================
// 平台管理端页面包装组件
// =====================

// 包装组件：AdminLoginPage
function AdminLoginPageWrapper() {
  const navigate = useNavigate();
  const { login, isAuthenticated } = useAdminAuth();

  // If already logged in, redirect to dashboard
  if (isAuthenticated) {
    return <Navigate to="/admin" replace />;
  }

  const handleLoginSuccess = async (email: string, password: string) => {
    const success = await login(email, password);
    if (success) {
      navigate('/admin');
    }
    return success;
  };

  return (
    <AdminLoginPage
      onLoginSuccess={() => navigate('/admin')}
      onLogin={handleLoginSuccess}
    />
  );
}

// 包装组件：AdminDashboardWrapper（使用 AdminLayout）
function AdminDashboardWrapper() {
  return (
    <AdminLayout>
      <DashboardPage />
    </AdminLayout>
  );
}

// 包装组件：AdminSuppliersWrapper
function AdminSuppliersWrapper() {
  return (
    <AdminLayout>
      <SupplierList />
    </AdminLayout>
  );
}

// 包装组件：AdminSupplierDetailWrapper
function AdminSupplierDetailWrapper() {
  return (
    <AdminLayout>
      <SupplierDetailPage />
    </AdminLayout>
  );
}

// 包装组件：AdminProductsWrapper
function AdminProductsWrapper() {
  const navigate = useNavigate();
  return (
    <AdminLayout>
      <ProductReviewList onNavigate={(path) => navigate(path)} />
    </AdminLayout>
  );
}

// 包装组件：AdminProductNewWrapper
function AdminProductNewWrapper() {
  const navigate = useNavigate();
  return (
    <AdminLayout>
      <AdminProductFormPage onNavigate={(path) => navigate(path)} />
    </AdminLayout>
  );
}

// 包装组件：AdminProductEditWrapper
// REQ-20260510-0001 dev-3: ?mode=preview 切到双语 Preview Tab；mode=form 走表单视图。
function AdminProductEditWrapper() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const mode = searchParams.get('mode') === 'preview' ? 'preview' : 'form';
  const setMode = (next: 'form' | 'preview') => {
    const sp = new URLSearchParams(searchParams);
    if (next === 'preview') sp.set('mode', 'preview');
    else sp.delete('mode');
    setSearchParams(sp, { replace: false });
  };
  return (
    <AdminLayout>
      <AdminProductFormPage
        productId={id}
        onNavigate={(path) => navigate(path)}
        mode={mode}
        onModeChange={setMode}
      />
    </AdminLayout>
  );
}

// 包装组件：AdminOrdersWrapper
function AdminOrdersWrapper() {
  return (
    <AdminLayout>
      <OrderList />
    </AdminLayout>
  );
}

// 包装组件：AdminUsersWrapper
function AdminUsersWrapper() {
  return (
    <AdminLayout>
      <UserList />
    </AdminLayout>
  );
}

// 包装组件：AdminFinanceWrapper
function AdminFinanceWrapper() {
  return (
    <AdminLayout>
      <FinanceList />
    </AdminLayout>
  );
}

// 包装组件：AdminAdminsWrapper
function AdminAdminsWrapper() {
  return (
    <AdminLayout>
      <AdminList />
    </AdminLayout>
  );
}

// 包装组件：AdminSettingsWrapper
function AdminSettingsWrapper() {
  return (
    <AdminLayout>
      <SettingsPage />
    </AdminLayout>
  );
}

// 包装组件：AdminAIChatTestWrapper (REQ-20260506-0026)
function AdminAIChatTestWrapper() {
  return (
    <AdminLayout>
      <AIChatTestPage />
    </AdminLayout>
  );
}

// 包装组件：AdminBannersWrapper
function AdminBannersWrapper() {
  const navigate = useNavigate();
  return (
    <AdminLayout>
      <BannerList onNavigate={(path) => navigate(path)} />
    </AdminLayout>
  );
}

// 包装组件：AdminRegionsWrapper
function AdminRegionsWrapper() {
  return (
    <AdminLayout>
      <RegionList />
    </AdminLayout>
  );
}

// 包装组件：AdminCategoriesWrapper
function AdminCategoriesWrapper() {
  return (
    <AdminLayout>
      <CategoryList />
    </AdminLayout>
  );
}

// 包装组件：AdminHomepageCMSWrapper
function AdminHomepageCMSWrapper() {
  return (
    <AdminLayout>
      <HomepageCMS />
    </AdminLayout>
  );
}

// 包装组件：AdminTourismKnowledgeWrapper (REQ-20260510-0002 Phase 1 · 1D)
function AdminTourismKnowledgeWrapper() {
  return (
    <AdminLayout>
      <TourismKnowledge />
    </AdminLayout>
  );
}

// 404 Page
function NotFoundPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      gap: '1rem',
    }}>
      <h1>404</h1>
      <p style={{ color: '#666' }}>{t('error.notFound')}</p>
      <button
        onClick={() => navigate('/')}
        style={{
          padding: '0.5rem 1rem',
          backgroundColor: '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
        }}
      >
        {t('nav.home')}
      </button>
    </div>
  );
}

// 加购反馈 Toast（全局，自动响应 addToCart 调用）
function CartFeedbackToast() {
  const { lastAddedAt } = useCart();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (lastAddedAt > 0) {
      setVisible(true);
      setLeaving(false);
      const timer = setTimeout(() => {
        setLeaving(true);
        setTimeout(() => setVisible(false), 300);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [lastAddedAt]);

  if (!visible) return null;

  return (
    <div style={{
      position: 'fixed', bottom: 24, left: '50%', transform: `translateX(-50%) ${leaving ? 'translateY(20px)' : 'translateY(0)'}`,
      background: '#065f46', color: 'white', padding: '12px 20px', borderRadius: 12,
      display: 'flex', alignItems: 'center', gap: 12, zIndex: 9999,
      boxShadow: '0 8px 32px rgba(0,0,0,0.2)', fontSize: 14, fontWeight: 500,
      opacity: leaving ? 0 : 1, transition: 'opacity 0.3s, transform 0.3s',
    }}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
      {t('cart.addedToCart')}
      <button
        onClick={() => { setVisible(false); navigate('/cart'); }}
        style={{
          background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white',
          padding: '4px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 13,
          fontWeight: 500, marginLeft: 4,
        }}
      >
        {t('cart.viewCart')}
      </button>
    </div>
  );
}

function App() {
  return (
    <AppErrorBoundary>
    <RegionProvider>
    <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID || ''}>
    <BrowserRouter>
      <CartProvider>
      <UserAuthProvider>
      <ChatProvider>
      <SupplierAuthProvider>
      <AdminAuthProvider>
      <Suspense fallback={<PageLoading />}>
      <Routes>
        {/* 首页 */}
        <Route path="/" element={<HomePageWrapper />} />
        <Route path="/plan" element={<PlanPageWrapper />} />

        {/* 认证页面 */}
        <Route path="/login" element={<LoginPageWrapper />} />
        <Route path="/register" element={<RegisterPageWrapper />} />
        <Route path="/forgot-password" element={<ForgotPasswordPageWrapper />} />
        <Route path="/reset-password" element={<ResetPasswordPageWrapper />} />

        {/* 区域与景点页面 */}
        <Route path="/regions/:id" element={<RegionPageWrapper />} />
        {/* REQ-20260510-0013: /attractions/:id 复用 ProductDetailPageWrapper（共享 products 表 +
            完整下单流程）；旧 AttractionDetailPage 已删除（半成品，无套餐选择 / 无 Book Now onClick） */}
        <Route path="/attractions/:id" element={<ProductDetailPageWrapper />} />

        {/* 酒店搜索 */}
        <Route path="/hotels" element={<HotelSearchPageWrapper />} />

        {/* 产品页面 */}
        <Route path="/products" element={<ProductListPageWrapper />} />
        <Route path="/product/:id" element={<ProductDetailPageWrapper />} />
        <Route path="/search" element={<ProductListPageWrapper />} />

        {/* 订单流程 */}
        <Route path="/checkout" element={<CheckoutPageWrapper />} />
        <Route path="/orders" element={<MyOrdersPageWrapper />} />
        <Route path="/orders/:id" element={<OrderDetailPageWrapper />} />
        <Route path="/orders/:id/confirmation" element={<OrderConfirmationPageWrapper />} />

        {/* 用户中心 */}
        <Route path="/profile" element={<UserProfilePageWrapper />} />
        <Route path="/profile/edit" element={<UserProfileEditPageWrapper />} />
        <Route path="/profile/contacts" element={<ContactsPageWrapper />} />

        {/* 目的地页面 */}
        <Route path="/destinations" element={<DestinationsPageWrapper />} />
        <Route path="/destinations/:id" element={<ProductListPageWrapper />} />

        {/* 分类页面 */}
        <Route path="/categories" element={<CategoriesPageWrapper />} />
        <Route path="/categories/:id" element={<ProductListPageWrapper />} />

        {/* 静态页面 */}
        <Route path="/about" element={<AboutPageWrapper />} />
        <Route path="/contact" element={<ContactPageWrapper />} />
        <Route path="/faq" element={<FaqPageWrapper />} />
        <Route path="/terms" element={<TermsPageWrapper />} />
        <Route path="/privacy" element={<PrivacyPageWrapper />} />

        {/* 购物车和收藏 */}
        <Route path="/cart" element={<CartPageWrapper />} />
        <Route path="/favorites" element={<FavoritesPageWrapper />} />

        {/* 供应商店铺页 */}
        <Route path="/shop/:id" element={<SupplierShopPageWrapper />} />

        {/* B端供应商后台 - 登录/注册页无需保护 */}
        <Route path="/supplier/login" element={<SupplierLoginPageWrapper />} />
        <Route path="/supplier/register" element={<SupplierRegisterPageWrapper />} />

        {/* B端供应商后台 - 需要登录保护 */}
        <Route path="/supplier" element={<SupplierAuthGuard><SupplierDashboardPageWrapper /></SupplierAuthGuard>} />
        <Route path="/supplier/dashboard" element={<SupplierAuthGuard><SupplierDashboardPageWrapper /></SupplierAuthGuard>} />
        <Route path="/supplier/products" element={<SupplierAuthGuard><SupplierProductListPageWrapper /></SupplierAuthGuard>} />
        <Route path="/supplier/products/new" element={<SupplierAuthGuard><SupplierProductNewPageWrapper /></SupplierAuthGuard>} />
        <Route path="/supplier/products/:id/edit" element={<SupplierAuthGuard><SupplierProductEditPageWrapper /></SupplierAuthGuard>} />
        <Route path="/supplier/products/:id/schedules" element={<SupplierAuthGuard><SupplierSchedulePageWrapper /></SupplierAuthGuard>} />
        <Route path="/supplier/orders" element={<SupplierAuthGuard><SupplierOrderListPageWrapper /></SupplierAuthGuard>} />
        <Route path="/supplier/reviews" element={<SupplierAuthGuard><SupplierReviewsPageWrapper /></SupplierAuthGuard>} />
        <Route path="/supplier/settlement" element={<SupplierAuthGuard><SupplierSettlementPageWrapper /></SupplierAuthGuard>} />
        <Route path="/supplier/exports" element={<SupplierAuthGuard><SupplierExportPageWrapper /></SupplierAuthGuard>} />
        <Route path="/supplier/team" element={<SupplierAuthGuard><SupplierTeamPageWrapper /></SupplierAuthGuard>} />
        <Route path="/supplier/notifications" element={<SupplierAuthGuard><SupplierNotificationsPageWrapper /></SupplierAuthGuard>} />
        <Route path="/supplier/after-sales" element={<SupplierAuthGuard><SupplierAfterSalesPageWrapper /></SupplierAuthGuard>} />
        <Route path="/supplier/after-sales/new" element={<SupplierAuthGuard><SupplierCreateTicketPageWrapper /></SupplierAuthGuard>} />
        <Route path="/supplier/reports" element={<SupplierAuthGuard><SupplierReportsPageWrapper /></SupplierAuthGuard>} />
        <Route path="/supplier/audit-logs" element={<SupplierAuthGuard><SupplierAuditLogPageWrapper /></SupplierAuthGuard>} />
        <Route path="/supplier/settings" element={<SupplierAuthGuard><SupplierSettingsPageWrapper /></SupplierAuthGuard>} />
        <Route path="/supplier/after-sales/:id" element={<SupplierAuthGuard><SupplierTicketDetailPageWrapper /></SupplierAuthGuard>} />
        <Route path="/supplier/orders/:id" element={<SupplierAuthGuard><SupplierOrderDetailPageWrapper /></SupplierAuthGuard>} />
        <Route path="/supplier/products/:id/preview" element={<SupplierAuthGuard><SupplierProductPreviewPageWrapper /></SupplierAuthGuard>} />
        {/* REQ-20260510-0001 F2: 双语 C 端预览（提交评审前的所见即所得 gate）*/}
        <Route path="/supplier/products/:id/preview-bilingual" element={<SupplierAuthGuard><SupplierProductPreviewBilingualPageWrapper /></SupplierAuthGuard>} />
        <Route path="/supplier/ai-chat" element={<SupplierAuthGuard><AIChatPage role="supplier" backPath="/supplier" /></SupplierAuthGuard>} />
        <Route path="/supplier/ai-chat/sessions/:id" element={<SupplierAuthGuard><AIChatPageWithRouteSession role="supplier" backPath="/supplier" /></SupplierAuthGuard>} />
        {/* REQ-20260509-0037 dev-8: new group-chat (workspace + channels). */}
        <Route path="/supplier/chat" element={<SupplierAuthGuard><SupplierGroupChatPage /></SupplierAuthGuard>} />
        <Route path="/supplier/chat/:slug" element={<SupplierAuthGuard><SupplierGroupChatPage /></SupplierAuthGuard>} />

        {/* 平台管理端 - 登录页无需保护 */}
        <Route path="/admin/login" element={<AdminLoginPageWrapper />} />

        {/* 平台管理端 - 需要登录保护 */}
        <Route path="/admin" element={<AdminAuthGuard requiredPermission="dashboard.view"><AdminDashboardWrapper /></AdminAuthGuard>} />
        <Route path="/admin/dashboard" element={<AdminAuthGuard requiredPermission="dashboard.view"><AdminDashboardWrapper /></AdminAuthGuard>} />
        <Route path="/admin/suppliers" element={<AdminAuthGuard requiredPermission="suppliers.view"><AdminSuppliersWrapper /></AdminAuthGuard>} />
        <Route path="/admin/suppliers/:id" element={<AdminAuthGuard requiredPermission="suppliers.view"><AdminSupplierDetailWrapper /></AdminAuthGuard>} />
        <Route path="/admin/products" element={<AdminAuthGuard requiredPermission="products.view"><AdminProductsWrapper /></AdminAuthGuard>} />
        <Route path="/admin/products/new" element={<AdminAuthGuard requiredPermission="products.manage"><AdminProductNewWrapper /></AdminAuthGuard>} />
        <Route path="/admin/products/:id/edit" element={<AdminAuthGuard requiredPermission="products.manage"><AdminProductEditWrapper /></AdminAuthGuard>} />
        <Route path="/admin/orders" element={<AdminAuthGuard requiredPermission="orders.view"><AdminOrdersWrapper /></AdminAuthGuard>} />
        <Route path="/admin/users" element={<AdminAuthGuard requiredPermission="users.view"><AdminUsersWrapper /></AdminAuthGuard>} />
        <Route path="/admin/finance" element={<AdminAuthGuard requiredPermission="finance.view"><AdminFinanceWrapper /></AdminAuthGuard>} />
        <Route path="/admin/admins" element={<AdminAuthGuard requiredPermission="admins.view"><AdminAdminsWrapper /></AdminAuthGuard>} />
        <Route path="/admin/settings" element={<AdminAuthGuard requiredPermission="settings.view"><AdminSettingsWrapper /></AdminAuthGuard>} />
        <Route path="/admin/ai-chat-test" element={<AdminAuthGuard requiredPermission="admins.view"><AdminAIChatTestWrapper /></AdminAuthGuard>} />
        <Route path="/admin/banners" element={<AdminAuthGuard><AdminBannersWrapper /></AdminAuthGuard>} />
        <Route path="/admin/regions" element={<AdminAuthGuard><AdminRegionsWrapper /></AdminAuthGuard>} />
        <Route path="/admin/categories" element={<AdminAuthGuard><AdminCategoriesWrapper /></AdminAuthGuard>} />
        <Route path="/admin/homepage" element={<AdminAuthGuard><AdminHomepageCMSWrapper /></AdminAuthGuard>} />
        <Route path="/admin/tourism" element={<AdminAuthGuard><AdminTourismKnowledgeWrapper /></AdminAuthGuard>} />
        <Route path="/admin/ai-chat" element={<AdminAuthGuard><AIChatPage role="admin" backPath="/admin" /></AdminAuthGuard>} />
        <Route path="/admin/ai-chat/sessions/:id" element={<AdminAuthGuard><AIChatPageWithRouteSession role="admin" backPath="/admin" /></AdminAuthGuard>} />

        {/* 404 */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      </Suspense>
      <ChatWidget />
      <CartFeedbackToast />
      </AdminAuthProvider>
      </SupplierAuthProvider>
      </ChatProvider>
      </UserAuthProvider>
      </CartProvider>
    </BrowserRouter>
    </GoogleOAuthProvider>
    </RegionProvider>
    </AppErrorBoundary>
  );
}

export default App;
