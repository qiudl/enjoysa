import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ProductDetailPage } from './ProductDetailPage';
import type { Product } from '../../types';

vi.mock('../../components/Common', () => ({
  Header: () => null,
  Footer: () => null,
  Button: ({ children }: { children?: React.ReactNode }) => <button>{children}</button>,
  Loading: () => <span>loading</span>,
  GoogleMap: () => null,
}));

const product = {
  id: '125',
  title: '旋翼机飞行',
  titleEn: 'Gyroplane Flight',
  description: '公开产品描述',
  descriptionEn: 'Public product description',
  bookingNotice: '请提前15分钟到达，并携带带照片的身份证件。',
  bookingNoticeEn: 'Arrive 15 minutes early and bring photo identification.',
  images: [],
  price: 220,
  currency: 'AUD',
  rating: 0,
  reviewCount: 0,
  location: '',
  locationEn: '',
  duration: '40 minutes',
  highlights: ['招牌体验 — 在教练陪同下完成40分钟旋翼机飞行。'],
  highlightsEn: ['Signature experience — Fly a gyroplane with an instructor for 40 minutes.'],
  inclusions: ['不应显示的费用包含'],
  exclusions: ['不应显示的费用不含'],
  faqs: [{
    question: '需要提前预订吗？',
    questionEn: 'Is advance booking required?',
    answer: '建议提前预订。',
    answerEn: 'Advance booking is recommended.',
  }],
  category: { id: 'attractions', name: '景点体验', nameEn: 'Attractions' },
  destination: { id: 'murray', name: '墨累河', nameEn: 'Murray River', region: '南澳大利亚', regionEn: 'South Australia' },
  tags: [],
  availability: 'available',
  instantConfirmation: true,
  freeCancellation: true,
  supplierId: '111',
  createdAt: '',
  updatedAt: '',
} as Product;

describe('ProductDetailPage', () => {
  it('shows persisted highlights and FAQs without placeholder inclusion sections', () => {
    render(<ProductDetailPage previewMode previewData={product} />);

    expect(screen.getByText(/在教练陪同下完成40分钟旋翼机飞行/)).toBeInTheDocument();
    expect(screen.getByText('需要提前预订吗？')).toBeInTheDocument();
    expect(screen.getByText('建议提前预订。')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '预订须知' })).toBeInTheDocument();
    expect(screen.getByText(/提前15分钟到达/)).toBeInTheDocument();
    expect(screen.queryByText('product.inclusions')).not.toBeInTheDocument();
    expect(screen.queryByText('product.exclusions')).not.toBeInTheDocument();
    expect(screen.queryByText('不应显示的费用包含')).not.toBeInTheDocument();
    expect(screen.queryByText('不应显示的费用不含')).not.toBeInTheDocument();
  });
});
