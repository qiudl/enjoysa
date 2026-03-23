import { render, screen, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { SupplierProductPreviewPage } from '../SupplierProductPreviewPage';
import { supplierProductService } from '../../../../services/supplierProductService';
import { productService } from '../../../../services/productService';

vi.mock('../../../../services/supplierProductService', () => ({
  supplierProductService: {
    getById: vi.fn(),
  },
}));

vi.mock('../../../../services/productService', () => ({
  productService: {
    getSchedules: vi.fn(),
  },
}));

const mockProduct = {
  id: 1,
  name_zh: '测试产品',
  name_en: 'Test Product',
  price_from: 199,
  rating: 4.5,
  review_count: 50,
  duration: '8小时',
  summary_zh: '测试摘要',
  summary_en: 'Test summary',
  description_zh: '测试描述',
  description_en: 'Test description',
  images: [
    { id: 1, url: 'https://example.com/1.jpg', sort_order: 0, is_cover: true, product_id: 1 },
    { id: 2, url: 'https://example.com/2.jpg', sort_order: 1, is_cover: false, product_id: 1 },
  ],
  packages: [
    {
      id: 1,
      product_id: 1,
      name_zh: '标准套餐',
      name_en: 'Standard',
      desc_zh: '含接送',
      desc_en: 'With pickup',
      price: 199,
    },
  ],
  highlights: [
    {
      id: 1,
      product_id: 1,
      title_zh: '亮点1',
      title_en: 'Highlight 1',
      desc_zh: '亮点描述',
      desc_en: 'Highlight desc',
    },
  ],
  faqs: [
    {
      id: 1,
      product_id: 1,
      question_zh: '问题1',
      question_en: 'Q1',
      answer_zh: '回答1',
      answer_en: 'A1',
    },
  ],
  status: 'approved',
  supplier_id: 1,
  region_id: 1,
  category_id: 1,
  currency: 'AUD',
  group_size: '12',
  tags: '',
  is_featured: false,
  address_zh: '',
  address_en: '',
  created_at: '',
  updated_at: '',
};

const mockSchedules = [
  {
    id: 1,
    product_id: 1,
    package_id: 1,
    date: '2026-03-25',
    time_slot: '09:00',
    total_slots: 10,
    booked_slots: 3,
    price: 199,
    status: 'available',
  },
];

describe('SupplierProductPreviewPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (supplierProductService.getById as ReturnType<typeof vi.fn>).mockResolvedValue(mockProduct);
    (productService.getSchedules as ReturnType<typeof vi.fn>).mockResolvedValue(mockSchedules);
  });

  it('renders without crashing and shows loading first then content', async () => {
    render(<SupplierProductPreviewPage productId="1" />);

    // After loading resolves, content should appear
    await waitFor(() => {
      expect(screen.getByText('测试产品')).toBeInTheDocument();
    });
  });

  it('shows product name after loading', async () => {
    render(<SupplierProductPreviewPage productId="1" />);

    await waitFor(() => {
      expect(screen.getByText('测试产品')).toBeInTheDocument();
    });
  });

  it('shows price', async () => {
    render(<SupplierProductPreviewPage productId="1" />);

    await waitFor(() => {
      expect(screen.getByText('AUD $199')).toBeInTheDocument();
    });
  });

  it('shows image carousel with thumbnails', async () => {
    render(<SupplierProductPreviewPage productId="1" />);

    await waitFor(() => {
      expect(screen.getByText('测试产品')).toBeInTheDocument();
    });

    // Two images means carousel arrows and thumbnails should be present
    expect(screen.getByLabelText('Previous image')).toBeInTheDocument();
    expect(screen.getByLabelText('Next image')).toBeInTheDocument();
    expect(screen.getByLabelText('Image 1')).toBeInTheDocument();
    expect(screen.getByLabelText('Image 2')).toBeInTheDocument();
  });

  it('shows package info', async () => {
    render(<SupplierProductPreviewPage productId="1" />);

    await waitFor(() => {
      // i18n.language is 'zh', so Chinese package name is displayed
      // Format: "标准套餐 — AUD $199 (含接送)"
      expect(screen.getByText(/标准套餐/)).toBeInTheDocument();
    });
  });

  it('shows highlight info', async () => {
    render(<SupplierProductPreviewPage productId="1" />);

    await waitFor(() => {
      expect(screen.getByText('亮点1')).toBeInTheDocument();
    });
  });
});
