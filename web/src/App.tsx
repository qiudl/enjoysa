import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useParams, useSearchParams, useLocation, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { GoogleOAuthProvider } from '@react-oauth/google';
// 首页同步加载（首屏性能）
import { HomePage } from './pages/HomePage';
// 所有其他页面懒加载
const LoginPage = React.lazy(() => import('./pages/LoginPage/LoginPage'));
const ForgotPasswordPage = React.lazy(() => import('./pages/ForgotPasswordPage/ForgotPasswordPage'));
const ResetPasswordPage = React.lazy(() => import('./pages/ResetPasswordPage/ResetPasswordPage'));
const ProductListPage = React.lazy(() => import('./pages/ProductListPage/ProductListPage'));
const ProductDetailPage = React.lazy(() => import('./pages/ProductDetailPage/ProductDetailPage'));
const CheckoutPage = React.lazy(() => import('./pages/CheckoutPage/CheckoutPage'));
const MyOrdersPage = React.lazy(() => import('./pages/MyOrdersPage/MyOrdersPage'));
const OrderDetailPage = React.lazy(() => import('./pages/OrderDetailPage/OrderDetailPage'));
const UserProfilePage = React.lazy(() => import('./pages/UserProfilePage/UserProfilePage'));
const UserProfileEditPage = React.lazy(() => import('./pages/UserProfileEditPage/UserProfileEditPage'));
const DestinationsPage = React.lazy(() => import('./pages/DestinationsPage/DestinationsPage'));
const CategoriesPage = React.lazy(() => import('./pages/CategoriesPage/CategoriesPage'));
const AboutPage = React.lazy(() => import('./pages/AboutPage/AboutPage'));
const ContactPage = React.lazy(() => import('./pages/ContactPage/ContactPage'));
const CartPage = React.lazy(() => import('./pages/CartPage/CartPage'));
const FavoritesPage = React.lazy(() => import('./pages/FavoritesPage/FavoritesPage'));
const SupplierShopPage = React.lazy(() => import('./pages/SupplierShopPage/SupplierShopPage'));
const FaqPage = React.lazy(() => import('./pages/FaqPage/FaqPage'));
const TermsPage = React.lazy(() => import('./pages/TermsPage/TermsPage'));
const PrivacyPage = React.lazy(() => import('./pages/PrivacyPage/PrivacyPage'));
const RegionPage = React.lazy(() => import('./pages/RegionPage/RegionPage'));
const AttractionDetailPage = React.lazy(() => import('./pages/AttractionDetailPage/AttractionDetailPage'));
// B端供应商页面
const SupplierDashboardPage = React.lazy(() => import('./pages/Supplier/SupplierDashboardPage/SupplierDashboardPage'));
const SupplierProductListPage = React.lazy(() => import('./pages/Supplier/SupplierProductListPage/SupplierProductListPage'));
const SupplierProductFormPage = React.lazy(() => import('./pages/Supplier/SupplierProductFormPage/SupplierProductFormPage'));
const SupplierSchedulePage = React.lazy(() => import('./pages/Supplier/SupplierSchedulePage/SupplierSchedulePage'));
const SupplierOrderListPage = React.lazy(() => import('./pages/Supplier/SupplierOrderListPage/SupplierOrderListPage'));
const SupplierReviewsPage = React.lazy(() => import('./pages/Supplier/SupplierReviewsPage/SupplierReviewsPage'));
const SupplierSettlementPage = React.lazy(() => import('./pages/Supplier/SupplierSettlementPage/SupplierSettlementPage'));
const SupplierExportPage = React.lazy(() => import('./pages/Supplier/SupplierExportPage/SupplierExportPage'));
const SupplierTeamPage = React.lazy(() => import('./pages/Supplier/SupplierTeamPage/SupplierTeamPage'));
const SupplierAfterSalesPage = React.lazy(() => import('./pages/Supplier/SupplierAfterSalesPage/SupplierAfterSalesPage'));
const SupplierReportsPage = React.lazy(() => import('./pages/Supplier/SupplierReportsPage/SupplierReportsPage'));
const SupplierAuditLogPage = React.lazy(() => import('./pages/Supplier/SupplierAuditLogPage/SupplierAuditLogPage'));
const SupplierSettingsPage = React.lazy(() => import('./pages/Supplier/SupplierSettingsPage/SupplierSettingsPage'));
const SupplierLoginPage = React.lazy(() => import('./pages/Supplier/SupplierLoginPage/SupplierLoginPage'));
const SupplierRegisterPage = React.lazy(() => import('./pages/Supplier/SupplierRegisterPage/SupplierRegisterPage'));
// 用户中心
const ContactsPage = React.lazy(() => import('./pages/ContactsPage/ContactsPage'));
// 平台管理端页面
const AdminLoginPage = React.lazy(() => import('./pages/Admin/AdminLoginPage/AdminLoginPage'));
const DashboardPage = React.lazy(() => import('./pages/Admin/DashboardPage/DashboardPage'));
const SupplierList = React.lazy(() => import('./pages/Admin/SupplierList/SupplierList'));
const ProductReviewList = React.lazy(() => import('./pages/Admin/ProductReviewList/ProductReviewList'));
const AdminProductFormPage = React.lazy(() => import('./pages/Admin/AdminProductFormPage/AdminProductFormPage'));
const OrderList = React.lazy(() => import('./pages/Admin/OrderList/OrderList'));
const UserList = React.lazy(() => import('./pages/Admin/UserList/UserList'));
const FinanceList = React.lazy(() => import('./pages/Admin/FinanceList/FinanceList'));
const AdminList = React.lazy(() => import('./pages/Admin/AdminList/AdminList'));
const SettingsPage = React.lazy(() => import('./pages/Admin/SettingsPage/SettingsPage'));

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
    </div>
  );
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

// 包装组件：AttractionDetailPage
function AttractionDetailPageWrapper() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { getCartCount } = useCart();

  return (
    <AttractionDetailPage
      attractionId={id}
      cartCount={getCartCount()}
      onLoginClick={() => navigate('/login')}
      onRegisterClick={() => navigate('/register')}
      onNavClick={(path) => navigate(path)}
      onSearch={(keyword) => navigate(`/search?q=${encodeURIComponent(keyword)}`)}
      onBack={() => navigate(-1)}
      onRegionClick={(regionId) => navigate(`/regions/${regionId}`)}
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
  const { t } = useTranslation();

  return (
    <ProductDetailPage
      productId={id}
      cartCount={getCartCount()}
      onBookNow={() => navigate('/checkout', { state: { productId: id } })}
      onAddToCart={(product, selectedDate, selectedTime) => {
        addToCart(product, 1, selectedDate, selectedTime);
        // Show feedback (could be a toast notification)
        alert(t('cart.addedToCart'));
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
  const { getCartCount } = useCart();
  const location = useLocation();
  const state = location.state as { productId?: string } | null;

  return (
    <CheckoutPage
      productId={state?.productId}
      cartCount={getCartCount()}
      onOrderSuccess={(orderId) => navigate(`/orders?highlight=${orderId}`)}
      onLoginRequired={() => navigate('/login')}
      onNavClick={(path) => navigate(path)}
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

// 包装组件：MyOrdersPage
function MyOrdersPageWrapper() {
  const navigate = useNavigate();
  const { getCartCount } = useCart();

  return (
    <MyOrdersPage
      cartCount={getCartCount()}
      onOrderClick={(order) => console.log('Order clicked:', order.id)}
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

  return (
    <UserProfileEditPage
      userName={user?.name}
      userEmail={user?.email}
      userPhone={user?.phone}
      userAvatar={user?.avatar}
      userLanguage={user?.language || 'zh-CN'}
      cartCount={getCartCount()}
      onSave={updateProfile}
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

// 包装组件：SupplierAfterSalesPage
function SupplierAfterSalesPageWrapper() {
  return (
    <SupplierLayout>
      <SupplierAfterSalesPage />
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
function AdminProductEditWrapper() {
  const navigate = useNavigate();
  const { id } = useParams();
  return (
    <AdminLayout>
      <AdminProductFormPage productId={id} onNavigate={(path) => navigate(path)} />
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

function App() {
  return (
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

        {/* 认证页面 */}
        <Route path="/login" element={<LoginPageWrapper />} />
        <Route path="/register" element={<RegisterPageWrapper />} />
        <Route path="/forgot-password" element={<ForgotPasswordPageWrapper />} />
        <Route path="/reset-password" element={<ResetPasswordPageWrapper />} />

        {/* 区域与景点页面 */}
        <Route path="/regions/:id" element={<RegionPageWrapper />} />
        <Route path="/attractions/:id" element={<AttractionDetailPageWrapper />} />

        {/* 产品页面 */}
        <Route path="/products" element={<ProductListPageWrapper />} />
        <Route path="/product/:id" element={<ProductDetailPageWrapper />} />
        <Route path="/search" element={<ProductListPageWrapper />} />

        {/* 订单流程 */}
        <Route path="/checkout" element={<CheckoutPageWrapper />} />
        <Route path="/orders" element={<MyOrdersPageWrapper />} />
        <Route path="/orders/:id" element={<OrderDetailPageWrapper />} />

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
        <Route path="/supplier/after-sales" element={<SupplierAuthGuard><SupplierAfterSalesPageWrapper /></SupplierAuthGuard>} />
        <Route path="/supplier/reports" element={<SupplierAuthGuard><SupplierReportsPageWrapper /></SupplierAuthGuard>} />
        <Route path="/supplier/audit-logs" element={<SupplierAuthGuard><SupplierAuditLogPageWrapper /></SupplierAuthGuard>} />
        <Route path="/supplier/settings" element={<SupplierAuthGuard><SupplierSettingsPageWrapper /></SupplierAuthGuard>} />

        {/* 平台管理端 - 登录页无需保护 */}
        <Route path="/admin/login" element={<AdminLoginPageWrapper />} />

        {/* 平台管理端 - 需要登录保护 */}
        <Route path="/admin" element={<AdminAuthGuard requiredPermission="dashboard.view"><AdminDashboardWrapper /></AdminAuthGuard>} />
        <Route path="/admin/dashboard" element={<AdminAuthGuard requiredPermission="dashboard.view"><AdminDashboardWrapper /></AdminAuthGuard>} />
        <Route path="/admin/suppliers" element={<AdminAuthGuard requiredPermission="suppliers.view"><AdminSuppliersWrapper /></AdminAuthGuard>} />
        <Route path="/admin/products" element={<AdminAuthGuard requiredPermission="products.view"><AdminProductsWrapper /></AdminAuthGuard>} />
        <Route path="/admin/products/new" element={<AdminAuthGuard requiredPermission="products.manage"><AdminProductNewWrapper /></AdminAuthGuard>} />
        <Route path="/admin/products/:id/edit" element={<AdminAuthGuard requiredPermission="products.manage"><AdminProductEditWrapper /></AdminAuthGuard>} />
        <Route path="/admin/orders" element={<AdminAuthGuard requiredPermission="orders.view"><AdminOrdersWrapper /></AdminAuthGuard>} />
        <Route path="/admin/users" element={<AdminAuthGuard requiredPermission="users.view"><AdminUsersWrapper /></AdminAuthGuard>} />
        <Route path="/admin/finance" element={<AdminAuthGuard requiredPermission="finance.view"><AdminFinanceWrapper /></AdminAuthGuard>} />
        <Route path="/admin/admins" element={<AdminAuthGuard requiredPermission="admins.view"><AdminAdminsWrapper /></AdminAuthGuard>} />
        <Route path="/admin/settings" element={<AdminAuthGuard requiredPermission="settings.view"><AdminSettingsWrapper /></AdminAuthGuard>} />

        {/* 404 */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      </Suspense>
      <ChatWidget />
      </AdminAuthProvider>
      </SupplierAuthProvider>
      </ChatProvider>
      </UserAuthProvider>
      </CartProvider>
    </BrowserRouter>
    </GoogleOAuthProvider>
  );
}

export default App;
