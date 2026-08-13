import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CategoriesPage } from './CategoriesPage';

vi.mock('../../components/Common', () => ({ Header: () => null, Footer: () => null }));

vi.mock('../../services/regionService', () => ({
  regionService: {
    getCategories: vi.fn().mockResolvedValue([
      { id: 'attractions', name: '景点体验', nameEn: 'Attractions & Experiences', icon: 'compass', productCount: 35 },
      { id: 'food-wine', name: '美食美酒', nameEn: 'Food & Wine', icon: 'wine', productCount: 33 },
      { id: 'accommodation', name: '特色住宿', nameEn: 'Unique Stays', icon: 'home', productCount: 31 },
    ]),
  },
}));

describe('CategoriesPage', () => {
  it('presents all three travel categories with imagery, copy, and category navigation', async () => {
    const onCategoryClick = vi.fn();
    render(<CategoriesPage onCategoryClick={onCategoryClick} />);

    await waitFor(() => expect(screen.getByTestId('category-card-attractions')).toBeInTheDocument());
    expect(screen.getByTestId('category-card-food-wine')).toBeInTheDocument();
    expect(screen.getByTestId('category-card-accommodation')).toBeInTheDocument();
    expect(screen.getAllByRole('img', { name: /景点体验|美食美酒|特色住宿/ })).toHaveLength(3);
    expect(screen.getByText('深入海岸、野生动物与城市文化，发现只属于南澳的精彩。')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('category-card-food-wine'));
    expect(onCategoryClick).toHaveBeenCalledWith(expect.objectContaining({ id: 'food-wine' }));
  });
});
