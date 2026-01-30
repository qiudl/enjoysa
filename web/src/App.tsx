import { BrowserRouter, Routes, Route, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  HomePage,
  LoginPage,
  ProductListPage,
  ProductDetailPage,
  CheckoutPage,
  MyOrdersPage,
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
} from './pages';
import { CartProvider, useCart } from './contexts';
import './App.css';

// 包装组件：HomePage
function HomePageWrapper() {
  const navigate = useNavigate();
  const { getCartCount } = useCart();

  return (
    <HomePage
      cartCount={getCartCount()}
      onProductClick={(product) => navigate(`/product/${product.id}`)}
      onDestinationClick={(dest) => navigate(`/destinations/${dest.id}`)}
      onCategoryClick={(cat) => navigate(`/categories/${cat.id}`)}
      onLoginClick={() => navigate('/login')}
      onRegisterClick={() => navigate('/register')}
      onSearch={(keyword) => navigate(`/search?q=${encodeURIComponent(keyword)}`)}
      onNavClick={(path) => navigate(path)}
    />
  );
}

// 包装组件：LoginPage
function LoginPageWrapper() {
  const navigate = useNavigate();

  return (
    <LoginPage
      initialMode="login"
      onLoginSuccess={() => navigate('/')}
      onRegisterSuccess={() => navigate('/')}
      onNavigateHome={() => navigate('/')}
    />
  );
}

// 包装组件：RegisterPage
function RegisterPageWrapper() {
  const navigate = useNavigate();

  return (
    <LoginPage
      initialMode="register"
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
    <BrowserRouter>
      <CartProvider>
      <Routes>
        {/* 首页 */}
        <Route path="/" element={<HomePageWrapper />} />

        {/* 认证页面 */}
        <Route path="/login" element={<LoginPageWrapper />} />
        <Route path="/register" element={<RegisterPageWrapper />} />

        {/* 产品页面 */}
        <Route path="/products" element={<ProductListPageWrapper />} />
        <Route path="/product/:id" element={<ProductDetailPageWrapper />} />
        <Route path="/search" element={<ProductListPageWrapper />} />

        {/* 订单流程 */}
        <Route path="/checkout" element={<CheckoutPageWrapper />} />
        <Route path="/orders" element={<MyOrdersPageWrapper />} />

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

        {/* 404 */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      </CartProvider>
    </BrowserRouter>
  );
}

export default App;
