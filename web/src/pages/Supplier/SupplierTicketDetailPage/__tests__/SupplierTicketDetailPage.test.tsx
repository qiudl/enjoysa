import { render, screen, fireEvent } from '@testing-library/react';
import { SupplierTicketDetailPage } from '../SupplierTicketDetailPage';

// jsdom does not implement scrollIntoView
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

describe('SupplierTicketDetailPage', () => {
  it('renders without crashing', () => {
    render(<SupplierTicketDetailPage />);
    expect(screen.getByText('AS-20260320-001')).toBeInTheDocument();
  });

  it('displays the ticket number as h1', () => {
    render(<SupplierTicketDetailPage />);
    const title = screen.getByText('AS-20260320-001');
    expect(title.tagName).toBe('H1');
  });

  it('shows ticket info card with customer and email', () => {
    render(<SupplierTicketDetailPage />);
    expect(screen.getByText('supplier.ticket.ticketInfo')).toBeInTheDocument();
    // 'Alice Wang' appears twice: once as message author, once in info card
    expect(screen.getAllByText('Alice Wang').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('alice.wang@example.com')).toBeInTheDocument();
  });

  it('displays Chinese product name when i18n.language is zh', () => {
    render(<SupplierTicketDetailPage />);
    // i18n.language mock returns 'zh', so the Chinese name should appear
    expect(screen.getByText('\u888b\u9f20\u5c9b\u4e00\u65e5\u6e38')).toBeInTheDocument();
  });

  it('renders refund amount and SLA hours', () => {
    render(<SupplierTicketDetailPage />);
    // AUD $398.00 appears in both ticket info and refund approval cards
    expect(screen.getAllByText('AUD $398.00').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('18h')).toBeInTheDocument();
  });

  it('shows timeline messages from mock data', () => {
    render(<SupplierTicketDetailPage />);
    expect(screen.getByText('supplier.ticket.timeline')).toBeInTheDocument();
    // Customer message
    expect(
      screen.getByText(/I booked the Kangaroo Island Day Tour/)
    ).toBeInTheDocument();
    // Staff reply
    expect(
      screen.getByText(/Hello Alice, thank you for reaching out/)
    ).toBeInTheDocument();
    // System event content
    expect(
      screen.getByText(/Ticket created. Status changed to Pending./)
    ).toBeInTheDocument();
  });

  it('shows internal note with internal badge', () => {
    render(<SupplierTicketDetailPage />);
    expect(
      screen.getByText(/Verified BOM severe weather warning/)
    ).toBeInTheDocument();
    expect(screen.getByText('supplier.ticket.internal')).toBeInTheDocument();
  });

  it('displays message authors', () => {
    render(<SupplierTicketDetailPage />);
    // 'Alice Wang' appears as both message author and customer info
    const aliceElements = screen.getAllByText('Alice Wang');
    expect(aliceElements.length).toBeGreaterThanOrEqual(2);
    // Sarah (Support) appears in multiple messages
    const sarahElements = screen.getAllByText('Sarah (Support)');
    expect(sarahElements.length).toBeGreaterThanOrEqual(2);
  });

  it('lists all attachments in the attachments card', () => {
    render(<SupplierTicketDetailPage />);
    // 3 attachments across all messages: booking_confirmation.pdf, weather_alert.png, refund_receipt.pdf
    expect(screen.getByText('supplier.ticket.attachments (3)')).toBeInTheDocument();
    expect(screen.getAllByText('booking_confirmation.pdf').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('weather_alert.png').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('refund_receipt.pdf').length).toBeGreaterThanOrEqual(1);
  });

  it('sends a reply when text is typed and send button clicked', () => {
    render(<SupplierTicketDetailPage />);
    const textarea = screen.getByPlaceholderText('supplier.ticket.replyPlaceholder');
    fireEvent.change(textarea, { target: { value: 'Test reply message' } });

    const sendBtn = screen.getByText('supplier.ticket.send');
    fireEvent.click(sendBtn);

    // The new message should appear in the timeline
    expect(screen.getByText('Test reply message')).toBeInTheDocument();
    expect(screen.getByText('You (Staff)')).toBeInTheDocument();
  });

  it('approves a refund when approve button is clicked', () => {
    render(<SupplierTicketDetailPage />);
    // Initially the refund approval status is 'pending'
    expect(screen.getByText('supplier.ticket.statusPending')).toBeInTheDocument();

    const approveBtn = screen.getByText('supplier.ticket.approve');
    fireEvent.click(approveBtn);

    // After approving, the status should change to 'approved'
    expect(screen.getByText('supplier.ticket.statusApproved')).toBeInTheDocument();
    // Approve/reject buttons should no longer be visible
    expect(screen.queryByText('supplier.ticket.approve')).not.toBeInTheDocument();
    // Approver name should be shown
    expect(screen.getByText('You (Staff)')).toBeInTheDocument();
  });

  it('rejects a refund with a reason', () => {
    render(<SupplierTicketDetailPage />);

    // Click reject to show the rejection reason input
    const rejectBtn = screen.getByText('supplier.ticket.reject');
    fireEvent.click(rejectBtn);

    // The reject reason textarea should appear
    const reasonInput = screen.getByPlaceholderText(
      'supplier.ticket.rejectReasonPlaceholder'
    );
    expect(reasonInput).toBeInTheDocument();

    // Type a reason and confirm rejection
    fireEvent.change(reasonInput, { target: { value: 'Insufficient evidence' } });

    // There are two elements with reject text: the confirm button and possibly the label
    const rejectBtns = screen.getAllByText('supplier.ticket.reject');
    const confirmBtn = rejectBtns.find(
      (el) => el.tagName === 'BUTTON' && !(el as HTMLButtonElement).disabled
    );
    fireEvent.click(confirmBtn!);

    // After rejection, the status should change
    expect(screen.getByText('supplier.ticket.statusRejected')).toBeInTheDocument();
    expect(screen.getByText('Insufficient evidence')).toBeInTheDocument();
  });
});
