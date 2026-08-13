import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ContactPage } from './ContactPage';

vi.mock('../../components/Common', () => ({
  Header: () => null,
  Footer: () => null,
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button>,
}));

describe('ContactPage', () => {
  it('shows verified contact details, South Australian imagery and an accessible enquiry form', () => {
    render(<ContactPage />);

    expect(screen.getByRole('heading', { name: '让我们一起规划你的南澳之旅' })).toBeInTheDocument();
    expect(screen.getByText('+61 0406830901')).toBeInTheDocument();
    expect(screen.getByText('tonylai@enjoysau.com')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: '阿德莱德南澳城市风景' })).toBeInTheDocument();
    expect(screen.getByTestId('contact-input-name')).toBeRequired();
    expect(screen.getByTestId('contact-btn-submit')).toBeInTheDocument();
  });
});
