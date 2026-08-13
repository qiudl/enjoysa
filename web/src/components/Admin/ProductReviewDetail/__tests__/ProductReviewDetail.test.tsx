import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProductReviewDetail } from '../ProductReviewDetail';
import { adminService } from '../../../../services/adminService';
import { productService } from '../../../../services/productService';

vi.mock('../../../../services/adminService', () => ({
  adminService: { getProduct: vi.fn() },
}));

vi.mock('../../../../services/productService', () => ({
  productService: { getById: vi.fn() },
}));

const review = {
  id: '125',
  name: '旋翼机飞行',
  nameEn: 'Gyroplane Flight',
  supplierId: '111',
  supplierName: 'Rotor-Sport Australia',
  price: 195,
  status: 'pending' as const,
  submittedAt: '2026-08-13T14:11:00Z',
};

const draftProduct = {
  id: 125,
  name_zh: '旋翼机飞行',
  name_en: 'Gyroplane Flight',
  supplier_id: 111,
  region_id: 1,
  category_id: 1,
  status: 'draft',
  price_from: 195,
  currency: 'AUD',
  summary_zh: '',
  summary_en: '',
  description_zh: '产品详情',
  description_en: 'Product details',
  address_zh: '',
  address_en: '',
  duration: '30分钟',
  group_size: '1',
  tags: '[]',
  is_featured: false,
  rating: 0,
  review_count: 0,
  highlights: [{
    id: 1, product_id: 125, title_zh: '空中俯瞰阿德莱德', title_en: 'Adelaide from above',
    desc_zh: '30分钟私人飞行', desc_en: 'A private 30-minute flight',
  }],
  faqs: [{
    id: 1, product_id: 125, question_zh: '体验时长多久？', question_en: 'How long is the flight?',
    answer_zh: '飞行时间约30分钟。', answer_en: 'Flight time is approximately 30 minutes.',
  }],
  created_at: '2026-08-13T14:11:00Z',
  updated_at: '2026-08-13T14:11:00Z',
};

describe('ProductReviewDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(adminService.getProduct).mockResolvedValue(draftProduct);
    vi.mocked(productService.getById).mockRejectedValue(new Error('draft is not public'));
  });

  it('loads draft details through the authenticated admin endpoint', async () => {
    render(<ProductReviewDetail product={review} open onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('空中俯瞰阿德莱德')).toBeInTheDocument();
      expect(screen.getByText(/体验时长多久？/)).toBeInTheDocument();
    });

    expect(adminService.getProduct).toHaveBeenCalledWith(125);
    expect(productService.getById).not.toHaveBeenCalled();
  });
});
