import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RegionPage } from './RegionPage';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'zh' } }),
}));

vi.mock('../../components/Common', () => ({ Header: () => null, Footer: () => null }));

vi.mock('../../services/regionService', () => ({
  regionService: {
    getBySlug: vi.fn().mockResolvedValue({
      region: {
        id: 'adelaide', name: '阿德莱德', nameEn: 'Adelaide', image: '',
        tagline: '城市漫游', taglineEn: 'City escape', description: '区域介绍',
        descriptionEn: 'Region introduction', attractionCount: 8,
      },
      products: [
        { id: 1, category_id: 1 },
        { id: 2, category_id: 1 },
        { id: 3, category_id: 2 },
      ],
    }),
  },
}));

describe('RegionPage category navigation', () => {
  it('shows three categories and keeps both region and category in navigation', async () => {
    const onNavClick = vi.fn();
    render(<RegionPage regionId="adelaide" onNavClick={onNavClick} />);

    await waitFor(() => expect(screen.getByText('景点体验')).toBeInTheDocument());
    expect(screen.getByText('美食美酒')).toBeInTheDocument();
    expect(screen.getByText('特色住宿')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('region-category-food-wine'));
    expect(onNavClick).toHaveBeenCalledWith('/products?destination=adelaide&category=food-wine');
  });
});
