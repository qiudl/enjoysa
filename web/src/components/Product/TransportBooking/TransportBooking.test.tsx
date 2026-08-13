import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TransportBooking } from './TransportBooking';

describe('TransportBooking', () => {
  it('builds a Ghan enquiry preview then asks the guest to contact support', () => {
    render(<TransportBooking productType="ghan" isZh />);
    fireEvent.change(screen.getByTestId('transport-travel-date'), { target: { value: '2026-09-10' } });
    fireEvent.click(screen.getByTestId('transport-preview-button'));
    expect(screen.getByTestId('transport-booking-preview')).toHaveTextContent('Adelaide → Darwin');
    expect(screen.getByTestId('transport-booking-preview')).toHaveTextContent('参考总价');
    fireEvent.click(screen.getByTestId('transport-confirm-button'));
    expect(screen.getByRole('dialog')).toHaveTextContent('请联系客服预订');
  });

  it('captures both dates and passenger mix for a return SeaLink ferry enquiry', () => {
    render(<TransportBooking productType="sealink" isZh />);
    fireEvent.change(screen.getByTestId('transport-travel-date'), { target: { value: '2026-09-10' } });
    fireEvent.change(screen.getByTestId('transport-return-date'), { target: { value: '2026-09-13' } });
    fireEvent.click(screen.getByTestId('transport-preview-button'));
    expect(screen.getByTestId('transport-booking-preview')).toHaveTextContent('Cape Jervis ⇄ Penneshaw');
    expect(screen.getByTestId('transport-booking-preview')).toHaveTextContent('2026-09-13');
    expect(screen.getByTestId('transport-booking-preview')).toHaveTextContent('A$136');
  });

  it.each([
    ['indian-pacific', 'Adelaide → Perth'],
    ['great-southern', 'Adelaide → Brisbane'],
    ['overland', 'Adelaide → Melbourne'],
  ] as const)('builds a specialist preview for %s', (productType, route) => {
    render(<TransportBooking productType={productType} isZh />);
    fireEvent.change(screen.getByTestId('transport-travel-date'), { target: { value: '2026-12-10' } });
    fireEvent.click(screen.getByTestId('transport-preview-button'));
    expect(screen.getByTestId('transport-booking-preview')).toHaveTextContent(route);
  });
});
