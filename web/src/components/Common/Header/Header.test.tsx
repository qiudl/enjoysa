import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Header } from './Header';

vi.mock('../LanguageSwitcher', () => ({
  LanguageSwitcher: () => null,
}));

vi.mock('../../../contexts/UserAuthContext', () => ({
  default: React.createContext(null),
}));

vi.mock('../../../contexts/CartContext', () => ({
  useCart: () => ({ lastAddedAt: 0 }),
}));

describe('Header product search navigation', () => {
  it('opens the Adelaide-filtered product search from the top navigation', () => {
    const onNavClick = vi.fn();
    render(<Header onNavClick={onNavClick} />);

    fireEvent.click(screen.getByRole('button', { name: 'nav.productSearch' }));

    expect(onNavClick).toHaveBeenCalledWith('/products?destination=adelaide');
    expect(screen.queryByRole('button', { name: 'nav.destinations' })).not.toBeInTheDocument();
  });
});
