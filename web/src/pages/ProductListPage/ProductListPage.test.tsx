import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProductListPage } from './ProductListPage';
import { productService } from '../../services/productService';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'zh' } }),
}));

vi.mock('../../components/Common', () => ({
  Header: () => null,
  Footer: () => null,
  SearchBar: () => null,
  Pagination: () => null,
  CardSkeleton: () => null,
}));

vi.mock('../../components/Product', () => ({
  ProductCard: () => null,
  ProductFilter: () => null,
}));

vi.mock('../../components/AI/AiFilterBar/AiFilterBar', () => ({ default: () => null }));

vi.mock('../../services/productService', () => ({
  productService: { list: vi.fn() },
  transformApiProduct: vi.fn(),
}));

vi.mock('../../services/regionService', () => ({
  regionService: {
    getAllRaw: vi.fn().mockResolvedValue([
      { id: 1, slug: 'adelaide', name_zh: '阿德莱德', name_en: 'Adelaide' },
    ]),
    getCategoriesRaw: vi.fn().mockResolvedValue([
      { id: 1, slug: 'attractions', name_zh: '景点体验', name_en: 'Attractions' },
      { id: 2, slug: 'food-wine', name_zh: '美食美酒', name_en: 'Food & Wine' },
      { id: 3, slug: 'accommodation', name_zh: '住宿', name_en: 'Accommodation' },
    ]),
  },
}));

describe('ProductListPage category filtering', () => {
  beforeEach(() => {
    vi.mocked(productService.list).mockReset().mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      page_size: 12,
      total_pages: 0,
    });
  });

  it('resolves the category slug and requests only products in that category', async () => {
    render(<ProductListPage initialCategory="food-wine" />);

    await waitFor(() => {
      expect(productService.list).toHaveBeenCalledWith(expect.objectContaining({
        category_id: 2,
      }));
    });
  });

  it('uses four products per page for a category inside a region', async () => {
    vi.mocked(productService.list).mockResolvedValue({
      items: [], total: 0, page: 1, page_size: 4, total_pages: 0,
    });

    render(
      <ProductListPage
        initialCategory="attractions"
        initialDestination="adelaide"
        initialPageSize={4}
      />,
    );

    await waitFor(() => {
      expect(productService.list).toHaveBeenCalledWith(expect.objectContaining({
        page_size: 4,
        category_id: 1,
      }));
    });
  });
});
