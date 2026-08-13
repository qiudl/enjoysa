import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AboutPage } from './AboutPage';

vi.mock('../../components/Common', () => ({ Header: () => null, Footer: () => null }));

describe('AboutPage', () => {
  it('presents a professional brand story with travel imagery and contact action', () => {
    const onNavClick = vi.fn();
    render(<AboutPage onNavClick={onNavClick} />);

    expect(screen.getByRole('heading', { name: '更懂南澳，也更懂你的旅行' })).toBeInTheDocument();
    expect(screen.getByText('精选，而不是堆砌')).toBeInTheDocument();
    expect(screen.getByText('景点体验')).toBeInTheDocument();
    expect(screen.getAllByRole('img', { name: /南澳/ })).toHaveLength(4);

    fireEvent.click(screen.getByTestId('about-btn-contact'));
    expect(onNavClick).toHaveBeenCalledWith('/contact');
  });
});
