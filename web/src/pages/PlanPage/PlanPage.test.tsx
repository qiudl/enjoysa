import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import PlanPage from './PlanPage';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, fallback: string) => fallback, i18n: { language: 'zh-CN' } }),
}));

vi.mock('../../components/Common', () => ({
  Header: () => null,
  Footer: () => null,
}));

describe('PlanPage regional itineraries', () => {
  it('shows the South Australian regions and opens a dedicated itinerary', () => {
    const onNavClick = vi.fn();
    render(<PlanPage onNavClick={onNavClick} />);

    expect(screen.getByRole('heading', { name: '按区域探索南澳行程' })).toBeInTheDocument();
    expect(screen.getByTestId('itinerary-region-adelaide')).toBeInTheDocument();
    expect(screen.getByTestId('itinerary-region-kangaroo-island')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('itinerary-region-barossa'));
    expect(onNavClick).toHaveBeenCalledWith('/plan/barossa');
  });

  it('renders the selected region with travel note and daily sections', () => {
    render(<PlanPage regionSlug="barossa" />);

    expect(screen.getByRole('heading', { name: '芭罗莎谷四日慢享之旅' })).toBeInTheDocument();
    expect(screen.getByText('旅行提示')).toBeInTheDocument();
    expect(screen.getAllByText('住在哪里').length).toBeGreaterThan(0);
    expect(screen.getAllByText('看什么、玩什么').length).toBeGreaterThan(0);
    expect(screen.getAllByText('吃什么、喝什么').length).toBeGreaterThan(0);
  });
});
