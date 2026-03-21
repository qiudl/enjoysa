import { BrowserRouter, Routes, Route, useNavigate, useParams, useSearchParams, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { GoogleOAuthProvider } from '@react-oauth/google';
import {
  HomePage,
  LoginPage,
  ForgotPasswordPage,
  ResetPasswordPage,
  ProductListPage,
  ProductDetailPage,
  CheckoutPage,
  MyOrdersPage,
  OrderDetailPage,
  UserProfilePage,
  DestinationsPage,
  CategoriesPage,
  AboutPage,
  ContactPage,
  CartPage,
  FavoritesPage,
  FaqPage,
  TermsPage,
  PrivacyPage,
  // B端供应商页面
  SupplierDashboardPage,
  SupplierProductListPage,
  SupplierProductFormPage,
  SupplierSchedulePage,
  SupplierOrderListPage,
  SupplierSettlementPage,
  SupplierAuditLogPage,
  SupplierLoginPage,
  SupplierRegisterPage,
  RegionPage,
  AttractionDetailPage,
  // 平台管理端页面
  AdminLoginPage,
  DashboardPage,
  SupplierList,
  ProductReviewList,
  AdminProductFormPage,
  OrderList,
  UserList,
  FinanceList,
  AdminList,
  SettingsPage,
} from './pages';
import { CartProvider, useCart, UserAuthProvider, useUserAuth, SupplierAuthProvider, useSupplierAuth, AdminAuthProvider, useAdminAuth } from './contexts';
import { SupplierAuthGuard } from './components/Common/SupplierAuthGuard';
import { AdminAuthGuard } from './components/Common/AdminAuthGuard';
import { AdminLayout } from './components/Admin';
import './App.css';

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
  const { login, googleLogin } = useUserAuth();

  return (
    <LoginPage
      initialMode="login"
      onLogin={login}
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
  const { register } = useUserAuth();

  return (
    <LoginPage
      initialMode="register"
      onRegister={register}
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
      onBookNow={() => navigate('/checkout')}
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

  return (
    <CheckoutPage
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

  return (
    <UserProfilePage
      cartCount={getCartCount()}
      onLogout={() => navigate('/')}
      onLoginClick={() => navigate('/login')}
      onRegisterClick={() => navigate('/register')}
      onNavClick={(path) => navigate(path)}
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
    <SupplierDashboardPage
      supplierName={supplier?.supplier?.name || supplier?.name || '供应商'}
      supplierType={(supplier?.supplier?.type || 'travel_agency') as 'travel_agency' | 'hotel' | 'attraction' | 'restaurant' | 'car_rental'}
      onNavigate={(path) => navigate(path)}
    />
  );
}

// 包装组件：SupplierProductListPage
function SupplierProductListPageWrapper() {
  const { supplier } = useSupplierAuth();
  const navigate = useNavigate();

  return (
    <SupplierProductListPage
      supplierName={supplier?.name || '供应商'}
      onNavigate={(path) => navigate(path)}
    />
  );
}

// 包装组件：SupplierProductFormPage (新建产品)
function SupplierProductNewPageWrapper() {
  const { supplier } = useSupplierAuth();
  const navigate = useNavigate();

  return (
    <SupplierProductFormPage
      supplierName={supplier?.name || '供应商'}
      onNavigate={(path) => navigate(path)}
    />
  );
}

// 包装组件：SupplierProductFormPage (编辑产品)
function SupplierProductEditPageWrapper() {
  const { supplier } = useSupplierAuth();
  const navigate = useNavigate();
  const { id } = useParams();

  return (
    <SupplierProductFormPage
      supplierName={supplier?.name || '供应商'}
      productId={id}
      onNavigate={(path) => navigate(path)}
    />
  );
}

// 包装组件：SupplierSchedulePage
function SupplierSchedulePageWrapper() {
  const { supplier } = useSupplierAuth();
  const navigate = useNavigate();
  const { id } = useParams();

  return (
    <SupplierSchedulePage
      productId={id}
      supplierName={supplier?.name || ''}
      onNavigate={(path) => navigate(path)}
    />
  );
}

// 包装组件：SupplierOrderListPage
function SupplierOrderListPageWrapper() {
  const { supplier } = useSupplierAuth();
  const navigate = useNavigate();

  return (
    <SupplierOrderListPage
      supplierName={supplier?.name || '供应商'}
      onNavigate={(path) => navigate(path)}
    />
  );
}

// 包装组件：SupplierSettlementPage
function SupplierSettlementPageWrapper() {
  const { supplier } = useSupplierAuth();
  const navigate = useNavigate();

  return (
    <SupplierSettlementPage
      supplierName={supplier?.name || '供应商'}
      onNavigate={(path) => navigate(path)}
    />
  );
}

// 包装组件：SupplierAuditLogPage
function SupplierAuditLogPageWrapper() {
  const { supplier } = useSupplierAuth();

  return (
    <SupplierAuditLogPage
      supplierName={supplier?.name || '供应商'}
    />
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
      <SupplierAuthProvider>
      <AdminAuthProvider>
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
        <Route path="/supplier/settlement" element={<SupplierAuthGuard><SupplierSettlementPageWrapper /></SupplierAuthGuard>} />
        <Route path="/supplier/audit-logs" element={<SupplierAuthGuard><SupplierAuditLogPageWrapper /></SupplierAuthGuard>} />

        {/* 平台管理端 - 登录页无需保护 */}
        <Route path="/admin/login" element={<AdminLoginPageWrapper />} />

        {/* 平台管理端 - 需要登录保护 */}
        <Route path="/admin" element={<AdminAuthGuard><AdminDashboardWrapper /></AdminAuthGuard>} />
        <Route path="/admin/dashboard" element={<AdminAuthGuard><AdminDashboardWrapper /></AdminAuthGuard>} />
        <Route path="/admin/suppliers" element={<AdminAuthGuard><AdminSuppliersWrapper /></AdminAuthGuard>} />
        <Route path="/admin/products" element={<AdminAuthGuard><AdminProductsWrapper /></AdminAuthGuard>} />
        <Route path="/admin/products/new" element={<AdminAuthGuard><AdminProductNewWrapper /></AdminAuthGuard>} />
        <Route path="/admin/products/:id/edit" element={<AdminAuthGuard><AdminProductEditWrapper /></AdminAuthGuard>} />
        <Route path="/admin/orders" element={<AdminAuthGuard><AdminOrdersWrapper /></AdminAuthGuard>} />
        <Route path="/admin/users" element={<AdminAuthGuard><AdminUsersWrapper /></AdminAuthGuard>} />
        <Route path="/admin/finance" element={<AdminAuthGuard><AdminFinanceWrapper /></AdminAuthGuard>} />
        <Route path="/admin/admins" element={<AdminAuthGuard><AdminAdminsWrapper /></AdminAuthGuard>} />
        <Route path="/admin/settings" element={<AdminAuthGuard><AdminSettingsWrapper /></AdminAuthGuard>} />

        {/* 404 */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      </AdminAuthProvider>
      </SupplierAuthProvider>
      </UserAuthProvider>
      </CartProvider>
    </BrowserRouter>
    </GoogleOAuthProvider>
  );
}

export default App;
