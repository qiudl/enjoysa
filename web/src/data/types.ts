// ===== 区域与景点类型 - Region & Attraction Types =====

export interface Region {
  id: string;
  name: string;
  nameEn: string;
  description: string;
  descriptionEn: string;
  tagline: string;
  taglineEn: string;
  image: string;
  attractionCount: number;
}

export interface Attraction {
  id: string;
  regionId: string;
  name: string;
  nameEn: string;
  supplierName: string;
  subtitle: string;
  subtitleEn: string;
  images: string[];
  tags: AttractionTag[];
  rating: number;
  reviewCount: number;
  priceFrom: number;
  currency: 'AUD';

  // 沉浸式亮点
  highlights: Highlight[];

  // 行程参数
  duration: string;
  durationEn: string;
  departureTime: string;
  departureTimeEn: string;
  meetingPoint: string;
  meetingPointEn: string;
  meetingPointMapUrl?: string;
  inclusions: string[];
  inclusionsEn: string[];

  // 预订方案
  packages: Package[];

  // 中文贴心服务
  voucherInfo: string;
  voucherInfoEn: string;
  directions: string;
  directionsEn: string;
  faqs: FAQ[];

  // 用户必读
  whatToBring: string[];
  whatToBringEn: string[];
  healthRestrictions: string;
  healthRestrictionsEn: string;
  cancellationPolicy: string;
  cancellationPolicyEn: string;
}

export interface Highlight {
  title: string;
  titleEn: string;
  description: string;
  descriptionEn: string;
}

export interface Package {
  id: string;
  name: string;
  nameEn: string;
  description: string;
  descriptionEn: string;
  price: number;
  currency: 'AUD';
}

export interface FAQ {
  question: string;
  questionEn: string;
  answer: string;
  answerEn: string;
}

export type AttractionTag =
  | 'instant_confirmation'
  | 'free_cancellation'
  | 'wechat_pay'
  | 'chinese_guide'
  | 'family_friendly'
  | 'photo_spot'
  | 'seasonal'
  | 'bestseller';
