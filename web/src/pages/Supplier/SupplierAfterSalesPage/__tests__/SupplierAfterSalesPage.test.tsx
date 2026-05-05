import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SupplierAfterSalesPage } from '../SupplierAfterSalesPage';
import { listSupplierOrders, refundOrder } from '../../../../services/orderService';

// Mock order service
vi.mock('../../../../services/orderService', () => ({
  listSupplierOrders: vi.fn(),
  refundOrder: vi.fn(),
}));

// listSupplierOrders returns the standard PaginatedData envelope
// { items, total, page, page_size, total_pages }; older versions used
// { orders: [...] } and the page would render an empty list.
const mockCancelled = {
  items: [
    {
      id: 1, order_no: 'ORD-001', status: 'cancelled', product_name: 'Test Tour',
      contact_name: 'Alice', user_name: 'Alice Wang', total_price: 199,
      refund_amount: 0, cancel_reason: 'Weather', supplier_remark: '',
      cancelled_at: '2026-03-20T10:00:00Z', refunded_at: null,
      created_at: '2026-03-19T10:00:00Z', updated_at: '2026-03-20T10:00:00Z',
    },
  ],
  total: 1, page: 1, page_size: 20, total_pages: 1,
};

const mockRefunded = {
  items: [
    {
      id: 2, order_no: 'ORD-002', status: 'refunded', product_name: 'Wine Tour',
      contact_name: 'Bob', user_name: 'Bob Zhang', total_price: 299,
      refund_amount: 299, cancel_reason: '', supplier_remark: '',
      cancelled_at: null, refunded_at: '2026-03-21T10:00:00Z',
      created_at: '2026-03-18T10:00:00Z', updated_at: '2026-03-21T10:00:00Z',
    },
  ],
  total: 1, page: 1, page_size: 20, total_pages: 1,
};

/**
 * Helper: find a filter <button> when the same i18n key text also
 * appears as a status badge elsewhere in the DOM.
 */
function getFilterButton(text: string): HTMLButtonElement {
  const all = screen.getAllByText(text);
  const btn = all.find((el) => el.tagName === 'BUTTON');
  if (!btn) throw new Error(`No <button> found with text "${text}"`);
  return btn as HTMLButtonElement;
}

describe('SupplierAfterSalesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (listSupplierOrders as ReturnType<typeof vi.fn>)
      .mockImplementation((filter: { status: string }) => {
        if (filter.status === 'cancelled') return Promise.resolve(mockCancelled);
        if (filter.status === 'refunded') return Promise.resolve(mockRefunded);
        return Promise.resolve({ items: [], total: 0, page: 1, page_size: 20, total_pages: 0 });
      });
    (refundOrder as ReturnType<typeof vi.fn>).mockResolvedValue({});
  });

  it('renders without crashing and shows the page title', () => {
    render(<SupplierAfterSalesPage />);
    expect(screen.getByText('supplier.afterSales.title')).toBeInTheDocument();
  });

  it('shows loading state initially before data loads', () => {
    // Make the API never resolve so loading stays visible
    (listSupplierOrders as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));
    render(<SupplierAfterSalesPage />);

    // The loading spinner (Loader2 icon) should be rendered; no tickets visible yet
    expect(screen.queryByText('ORD-001')).not.toBeInTheDocument();
    expect(screen.queryByText('ORD-002')).not.toBeInTheDocument();
  });

  it('shows tickets from both cancelled and refunded orders after data loads', async () => {
    render(<SupplierAfterSalesPage />);
    await waitFor(() => {
      expect(screen.getByText('ORD-001')).toBeInTheDocument();
    });
    expect(screen.getByText('ORD-002')).toBeInTheDocument();

    // Customer names derived from contact_name
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();

    // Product names
    expect(screen.getByText('Test Tour')).toBeInTheDocument();
    expect(screen.getByText('Wine Tour')).toBeInTheDocument();
  });

  it('shows stat cards with correct counts', async () => {
    render(<SupplierAfterSalesPage />);
    await waitFor(() => {
      expect(screen.getByText('ORD-001')).toBeInTheDocument();
    });

    // Total tickets = 2 (1 cancelled + 1 refunded)
    expect(screen.getByText('supplier.afterSales.totalTickets')).toBeInTheDocument();

    // orderToTicket maps:
    //   cancelled (refund_amount=0) -> status='rejected'
    //   refunded -> status='resolved'
    // So: pending=0, resolved=1, rejected=1
    expect(screen.getByText('supplier.afterSales.pendingTickets')).toBeInTheDocument();

    // SLA rate = resolved/total = 1/2 = 50%
    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(screen.getByText('supplier.afterSales.slaRate')).toBeInTheDocument();
  });

  it('renders all filter buttons', async () => {
    render(<SupplierAfterSalesPage />);
    await waitFor(() => {
      expect(screen.getByText('ORD-001')).toBeInTheDocument();
    });

    expect(getFilterButton('supplier.afterSales.all')).toBeInTheDocument();
    expect(getFilterButton('supplier.afterSales.statusPending')).toBeInTheDocument();
    expect(getFilterButton('supplier.afterSales.statusProcessing')).toBeInTheDocument();
    expect(getFilterButton('supplier.afterSales.statusResolved')).toBeInTheDocument();
    expect(getFilterButton('supplier.afterSales.statusRejected')).toBeInTheDocument();
  });

  it('shows empty state when filtered to a status with no tickets', async () => {
    render(<SupplierAfterSalesPage />);
    await waitFor(() => {
      expect(screen.getByText('ORD-001')).toBeInTheDocument();
    });

    // No tickets have status 'pending', so filtering by pending should show empty state
    fireEvent.click(getFilterButton('supplier.afterSales.statusPending'));
    expect(screen.queryByText('ORD-001')).not.toBeInTheDocument();
    expect(screen.queryByText('ORD-002')).not.toBeInTheDocument();
    expect(screen.getByText('supplier.afterSales.noTickets')).toBeInTheDocument();
  });
});
