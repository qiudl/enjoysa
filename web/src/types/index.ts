// EnjoySA Type Definitions - 畅游南澳类型定义

// ===== 用户相关 - User Types =====
export interface User {
  id: string;
  email?: string;
  phone?: string;
  nickname: string;
  avatar?: string;
  language: 'zh' | 'en';
  createdAt: string;
  authProvider?: 'email' | 'phone' | 'wechat' | 'google';
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface LoginFormData {
  identifier: string; // email or phone
  verificationCode: string;
  loginType: 'email' | 'phone';
}

export interface RegisterFormData {
  email?: string;
  phone?: string;
  verificationCode: string;
  nickname: string;
  agreedToTerms: boolean;
}

// ===== 产品相关 - Product Types =====
export interface Product {
  id: string;
  title: string;
  titleEn?: string;
  description: string;
  descriptionEn?: string;
  images: string[];
  price: number;
  originalPrice?: number;
  currency: 'AUD' | 'CNY';
  rating: number;
  reviewCount: number;
  location: string;
  locationEn?: string;
  duration?: string;
  durationEn?: string;
  highlights: string[];
  highlightsEn?: string[];
  inclusions: string[];
  exclusions: string[];
  category: ProductCategory;
  destination: Destination;
  tags: ProductTag[];
  availability: 'available' | 'limited' | 'sold_out';
  instantConfirmation: boolean;
  freeCancellation: boolean;
  meetingPoint?: string;
  supplierId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProductCategory {
  id: string;
  name: string;
  nameEn: string;
  icon?: string;
  parentId?: string;
}

export interface Destination {
  id: string;
  name: string;
  nameEn: string;
  region: string;
  regionEn: string;
  image?: string;
  description?: string;
  descriptionEn?: string;
}

export type ProductTag =
  | 'hot'           // 热卖
  | 'new'           // 新品
  | 'discount'      // 特惠
  | 'recommended'   // 推荐
  | 'family'        // 亲子
  | 'couple'        // 情侣
  | 'adventure'     // 冒险
  | 'nature'        // 自然
  | 'food'          // 美食
  | 'culture';      // 文化

export interface ProductFilter {
  category?: string;
  destination?: string;
  priceMin?: number;
  priceMax?: number;
  rating?: number;
  tags?: ProductTag[];
  sortBy?: 'price_asc' | 'price_desc' | 'rating' | 'popularity' | 'newest';
  page?: number;
  pageSize?: number;
}

export interface ProductSearchResult {
  products: Product[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// ===== 购物车相关 - Cart Types =====
export interface CartItem {
  id: string;
  productId: string;
  product: Product;
  quantity: number;
  selectedDate?: string;
  selectedTime?: string;
  travelDate?: string;
  participants: Participant[];
  subtotal: number;
}

// Simple participant for cart (count-based)
export interface Participant {
  type: 'adult' | 'child' | 'infant';
  name?: string;
  count: number;
}

// Detailed participant for order forms
export interface ParticipantDetail {
  id: string;
  type: 'adult' | 'child' | 'infant';
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  dateOfBirth?: string;
  nationality?: string;
  passportNumber?: string;
  specialRequirements?: string;
}

export interface Cart {
  items: CartItem[];
  totalAmount: number;
  itemCount: number;
}

// ===== 订单相关 - Order Types =====
export interface Order {
  id: string;
  orderNumber: string;
  userId: string;
  items: OrderItem[];
  status: OrderStatus;
  totalAmount: number;
  currency: 'AUD' | 'CNY';
  paymentMethod?: PaymentMethod;
  paymentStatus: PaymentStatus;
  contactInfo: ContactInfo;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  paidAt?: string;
  confirmedAt?: string;
  completedAt?: string;
  cancelledAt?: string;
  refundedAt?: string;
}

export interface OrderItem {
  id: string;
  productId: string;
  productTitle: string;
  productTitleEn?: string;
  productImage: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  totalPrice?: number;
  travelDate: string;
  travelTime?: string;
  participants: Participant[];
  voucherCode?: string;
  voucherUrl?: string;
}

export type OrderStatus =
  | 'pending_payment'   // 待支付
  | 'paid'              // 已支付
  | 'confirmed'         // 已确认
  | 'in_progress'       // 进行中
  | 'completed'         // 已完成
  | 'cancelled'         // 已取消
  | 'refund_requested'  // 申请退款
  | 'refunded';         // 已退款

export type PaymentStatus =
  | 'unpaid'
  | 'paid'
  | 'refunding'
  | 'refunded'
  | 'failed';

export type PaymentMethod =
  | 'wechat'
  | 'alipay'
  | 'bank_transfer'
  | 'stripe'
  | 'paypal'
  | 'credit_card';

export interface ContactInfo {
  name: string;
  phone: string;
  email: string;
  wechat?: string;
}

// ===== 评论相关 - Review Types =====
export interface Review {
  id: string;
  userId: string;
  userNickname: string;
  userAvatar?: string;
  productId: string;
  orderId: string;
  rating: number;
  content: string;
  images?: string[];
  travelDate: string;
  createdAt: string;
  reply?: ReviewReply;
  helpful: number;
}

export interface ReviewReply {
  content: string;
  createdAt: string;
}

// ===== 收藏相关 - Favorite Types =====
export interface Favorite {
  id: string;
  userId: string;
  productId: string;
  product: Product;
  createdAt: string;
}

// ===== 通用类型 - Common Types =====
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface SelectOption {
  value: string;
  label: string;
  labelEn?: string;
}

// ===== i18n 类型 =====
export type Language = 'zh' | 'en';

export interface I18nConfig {
  language: Language;
  setLanguage: (lang: Language) => void;
}
