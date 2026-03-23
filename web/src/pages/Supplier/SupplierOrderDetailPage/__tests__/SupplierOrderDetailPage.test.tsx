import { render, screen, fireEvent } from '@testing-library/react';
import { SupplierOrderDetailPage } from '../SupplierOrderDetailPage';

describe('SupplierOrderDetailPage', () => {
  it('renders without crashing', () => {
    render(<SupplierOrderDetailPage />);
    expect(screen.getByText('ORD-20260320-001')).toBeInTheDocument();
  });

  it('displays the order number as h1', () => {
    render(<SupplierOrderDetailPage />);
    const title = screen.getByText('ORD-20260320-001');
    expect(title.tagName).toBe('H1');
  });

  it('shows Chinese product name when i18n.language is zh', () => {
    render(<SupplierOrderDetailPage />);
    expect(screen.getByText('\u888b\u9f20\u5c9b\u4e00\u65e5\u6e38')).toBeInTheDocument();
  });

  it('displays order info card with correct details', () => {
    render(<SupplierOrderDetailPage />);
    expect(screen.getByText('supplier.orderDetail.orderInfo')).toBeInTheDocument();
    // Status badge should show confirmed status
    expect(screen.getByText('supplier.orderDetail.statusConfirmed')).toBeInTheDocument();
    // Travel date
    expect(screen.getByText('2026-03-25')).toBeInTheDocument();
    // Quantity
    expect(screen.getByText('2')).toBeInTheDocument();
    // Unit price
    expect(screen.getByText('AUD 398.00')).toBeInTheDocument();
    // Total amount
    expect(screen.getByText('AUD 796.00')).toBeInTheDocument();
    // Payment method
    expect(screen.getByText('Credit Card')).toBeInTheDocument();
  });

  it('renders timeline section with completed steps', () => {
    render(<SupplierOrderDetailPage />);
    expect(screen.getByText('supplier.orderDetail.timeline')).toBeInTheDocument();
    // All 5 timeline steps should be rendered
    expect(screen.getByText('supplier.orderDetail.eventCreated')).toBeInTheDocument();
    expect(screen.getByText('supplier.orderDetail.eventPaid')).toBeInTheDocument();
    expect(screen.getByText('supplier.orderDetail.eventConfirmed')).toBeInTheDocument();
    expect(screen.getByText('supplier.orderDetail.eventVerified')).toBeInTheDocument();
    expect(screen.getByText('supplier.orderDetail.eventCompleted')).toBeInTheDocument();
  });

  it('shows timeline details for completed events', () => {
    render(<SupplierOrderDetailPage />);
    expect(screen.getByText('Order placed by customer')).toBeInTheDocument();
    expect(screen.getByText('Payment received via Credit Card')).toBeInTheDocument();
    expect(screen.getByText('Supplier confirmed the order')).toBeInTheDocument();
  });

  it('displays traveler information', () => {
    render(<SupplierOrderDetailPage />);
    expect(screen.getByText('supplier.orderDetail.travelers')).toBeInTheDocument();
    expect(screen.getByText('Alice Wang')).toBeInTheDocument();
    expect(screen.getByText('Tom Wang')).toBeInTheDocument();
    expect(screen.getByText('supplier.orderDetail.travelerAdult')).toBeInTheDocument();
    expect(screen.getByText('supplier.orderDetail.travelerChild')).toBeInTheDocument();
  });

  it('shows verification card with code and not-verified status', () => {
    render(<SupplierOrderDetailPage />);
    expect(screen.getByText('supplier.orderDetail.verification')).toBeInTheDocument();
    expect(screen.getByText('VRF-8A3F2D')).toBeInTheDocument();
    expect(screen.getByText('supplier.orderDetail.notVerified')).toBeInTheDocument();
  });

  it('displays the verify button when order status is confirmed', () => {
    render(<SupplierOrderDetailPage />);
    // Two verify buttons: one in header, one in verification card
    const verifyBtns = screen.getAllByText('supplier.orderDetail.verify');
    expect(verifyBtns.length).toBe(2);
  });

  it('opens confirmation modal when verify button is clicked', () => {
    render(<SupplierOrderDetailPage />);
    const verifyBtns = screen.getAllByText('supplier.orderDetail.verify');
    fireEvent.click(verifyBtns[0]);

    // Modal should appear with confirm title and verification code
    expect(screen.getByText('supplier.orderDetail.verifyConfirm')).toBeInTheDocument();
    expect(screen.getByText('supplier.orderDetail.verifyCode:')).toBeInTheDocument();
  });

  it('completes verification flow when confirming in modal', () => {
    render(<SupplierOrderDetailPage />);
    // Click verify to open modal
    const verifyBtns = screen.getAllByText('supplier.orderDetail.verify');
    fireEvent.click(verifyBtns[0]);

    // Confirm verification in the modal — the modal has a confirm button with verify text
    const modalBtns = screen.getAllByText('supplier.orderDetail.verify');
    const confirmBtn = modalBtns[modalBtns.length - 1];
    fireEvent.click(confirmBtn);

    // After verification, status should change to verified
    expect(screen.getByText('supplier.orderDetail.statusVerified')).toBeInTheDocument();
    // Verify buttons should no longer appear (status is no longer 'confirmed')
    expect(screen.queryByText('supplier.orderDetail.verify')).not.toBeInTheDocument();
    // Verified status text should appear
    expect(screen.getByText(/supplier.orderDetail.verified/)).toBeInTheDocument();
  });

  it('displays the order remark', () => {
    render(<SupplierOrderDetailPage />);
    expect(screen.getByText('supplier.orderDetail.remark')).toBeInTheDocument();
    expect(screen.getByText('Customer requests window seat on the bus.')).toBeInTheDocument();
  });
});
