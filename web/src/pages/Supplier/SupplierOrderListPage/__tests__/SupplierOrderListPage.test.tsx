import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SupplierOrderListPage } from '../SupplierOrderListPage';

// Mock order service
vi.mock('../../../../services/orderService', () => ({
  listSupplierOrders: vi.fn().mockResolvedValue({
    orders: [
      {
        id: 1,
        order_no: 'ORD-001',
        product_name: '袋鼠岛一日游',
        contact_name: 'Alice Wang',
        contact_phone: '0412345678',
        booking_date: '2026-04-01',
        quantity: 2,
        guest_count: 2,
        total_price: 398,
        status: 'pending',
        channel: 'direct',
        created_at: '2026-03-20T10:00:00Z',
      },
      {
        id: 2,
        order_no: 'ORD-002',
        product_name: '巴罗萨谷品酒之旅',
        contact_name: 'Bob Zhang',
        contact_phone: '0498765432',
        booking_date: '2026-04-05',
        quantity: 4,
        guest_count: 4,
        total_price: 712,
        status: 'accepted',
        channel: 'trip_com',
        created_at: '2026-03-19T14:30:00Z',
      },
      {
        id: 3,
        order_no: 'ORD-003',
        product_name: '阿德莱德城市观光',
        contact_name: 'Carol Li',
        contact_phone: '0411111111',
        booking_date: '2026-04-10',
        quantity: 1,
        guest_count: 1,
        total_price: 120,
        status: 'completed',
        channel: 'direct',
        created_at: '2026-03-18T09:00:00Z',
      },
    ],
  }),
  acceptOrder: vi.fn().mockResolvedValue({}),
  completeOrder: vi.fn().mockResolvedValue({}),
  refundOrder: vi.fn().mockResolvedValue({}),
  updateOrderRemark: vi.fn().mockResolvedValue({}),
}));

// Mock Common components
vi.mock('../../../../components/Common', () => ({
  Button: ({ children, onClick, disabled, ...rest }: Record<string, unknown>) => (
    <button onClick={onClick as () => void} disabled={disabled as boolean} {...rest}>
      {children as React.ReactNode}
    </button>
  ),
  Modal: ({
    open,
    title,
    children,
    onClose,
    onOk,
    footer,
  }: Record<string, unknown>) => {
    if (!open) return null;
    return (
      <div data-testid="modal">
        <h2>{title as React.ReactNode}</h2>
        {children as React.ReactNode}
        {footer ? (
          footer as React.ReactNode
        ) : (
          <div>
            <button onClick={onClose as () => void}>Close</button>
            {onOk && <button onClick={onOk as () => void}>OK</button>}
          </div>
        )}
      </div>
    );
  },
}));

describe('SupplierOrderListPage', () => {
  it('renders the page title', async () => {
    render(<SupplierOrderListPage />);
    expect(screen.getByText('supplier.orders.title')).toBeInTheDocument();
  });

  it('shows orders after loading', async () => {
    render(<SupplierOrderListPage />);
    await waitFor(() => {
      expect(screen.getByText('ORD-001')).toBeInTheDocument();
    });
    expect(screen.getByText('ORD-002')).toBeInTheDocument();
    expect(screen.getByText('ORD-003')).toBeInTheDocument();
  });

  it('displays customer names', async () => {
    render(<SupplierOrderListPage />);
    await waitFor(() => {
      expect(screen.getByText('Alice Wang')).toBeInTheDocument();
    });
    expect(screen.getByText('Bob Zhang')).toBeInTheDocument();
    expect(screen.getByText('Carol Li')).toBeInTheDocument();
  });

  it('shows Chinese product names (i18n.language is zh)', async () => {
    render(<SupplierOrderListPage />);
    await waitFor(() => {
      expect(screen.getByText('袋鼠岛一日游')).toBeInTheDocument();
    });
    expect(screen.getByText('巴罗萨谷品酒之旅')).toBeInTheDocument();
  });

  it('displays order amounts', async () => {
    render(<SupplierOrderListPage />);
    await waitFor(() => {
      expect(screen.getByText('AUD 398.00')).toBeInTheDocument();
    });
    expect(screen.getByText('AUD 712.00')).toBeInTheDocument();
    // AUD 120.00 appears in both channel stats and order card
    expect(screen.getAllByText('AUD 120.00').length).toBeGreaterThanOrEqual(1);
  });

  it('renders all status filter buttons', () => {
    render(<SupplierOrderListPage />);
    expect(screen.getByText('supplier.orders.all')).toBeInTheDocument();
    expect(screen.getByText('supplier.orders.pending')).toBeInTheDocument();
    expect(screen.getByText('supplier.orders.confirmed')).toBeInTheDocument();
    expect(screen.getByText('supplier.orders.completed')).toBeInTheDocument();
    expect(screen.getByText('supplier.orders.refunding')).toBeInTheDocument();
  });

  it('filters by pending status', async () => {
    render(<SupplierOrderListPage />);
    await waitFor(() => {
      expect(screen.getByText('ORD-001')).toBeInTheDocument();
    });

    // Find the filter button (not the status badge)
    const pendingBtns = screen.getAllByText('supplier.orders.pending');
    const filterBtn = pendingBtns.find((el) => el.tagName === 'BUTTON');
    fireEvent.click(filterBtn!);

    // Only ORD-001 is pending
    expect(screen.getByText('ORD-001')).toBeInTheDocument();
    expect(screen.queryByText('ORD-002')).not.toBeInTheDocument();
    expect(screen.queryByText('ORD-003')).not.toBeInTheDocument();
  });

  it('filters by completed status', async () => {
    render(<SupplierOrderListPage />);
    await waitFor(() => {
      expect(screen.getByText('ORD-003')).toBeInTheDocument();
    });

    const completedBtns = screen.getAllByText('supplier.orders.completed');
    const filterBtn = completedBtns.find((el) => el.tagName === 'BUTTON');
    fireEvent.click(filterBtn!);

    expect(screen.getByText('ORD-003')).toBeInTheDocument();
    expect(screen.queryByText('ORD-001')).not.toBeInTheDocument();
    expect(screen.queryByText('ORD-002')).not.toBeInTheDocument();
  });

  it('searches by order number', async () => {
    render(<SupplierOrderListPage />);
    await waitFor(() => {
      expect(screen.getByText('ORD-001')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('supplier.orders.search');
    fireEvent.change(searchInput, { target: { value: 'ORD-002' } });

    expect(screen.queryByText('ORD-001')).not.toBeInTheDocument();
    expect(screen.getByText('ORD-002')).toBeInTheDocument();
    expect(screen.queryByText('ORD-003')).not.toBeInTheDocument();
  });

  it('searches by customer name', async () => {
    render(<SupplierOrderListPage />);
    await waitFor(() => {
      expect(screen.getByText('Alice Wang')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('supplier.orders.search');
    fireEvent.change(searchInput, { target: { value: 'carol' } });

    expect(screen.queryByText('ORD-001')).not.toBeInTheDocument();
    expect(screen.getByText('ORD-003')).toBeInTheDocument();
  });

  it('shows Trip.com channel badge for trip_com orders', async () => {
    render(<SupplierOrderListPage />);
    await waitFor(() => {
      expect(screen.getByText('ORD-002')).toBeInTheDocument();
    });
    // Trip.com appears in both channel stats and order badge
    expect(screen.getAllByText('Trip.com').length).toBeGreaterThanOrEqual(1);
  });

  it('calls onNavigate when order card is clicked', async () => {
    const onNavigate = vi.fn();
    render(<SupplierOrderListPage onNavigate={onNavigate} />);
    await waitFor(() => {
      expect(screen.getByText('ORD-001')).toBeInTheDocument();
    });

    // Click the order card (not the action buttons)
    const card = screen.getByText('ORD-001').closest('[class*="orderCard"]');
    fireEvent.click(card!);
    expect(onNavigate).toHaveBeenCalledWith('/supplier/orders/1');
  });

  it('action buttons do not trigger card navigation (stopPropagation)', async () => {
    const onNavigate = vi.fn();
    render(<SupplierOrderListPage onNavigate={onNavigate} />);
    await waitFor(() => {
      expect(screen.getByText('ORD-001')).toBeInTheDocument();
    });

    // Click the orderActions div (which has stopPropagation)
    const actionsDiv = screen.getAllByText('supplier.orders.addRemark')[0].closest('[class*="orderActions"]');
    fireEvent.click(actionsDiv!);

    // onNavigate should NOT be called — stopPropagation prevents bubbling to card
    expect(onNavigate).not.toHaveBeenCalled();
  });
});
