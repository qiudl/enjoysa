import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { SupplierReportsPage } from '../SupplierReportsPage';

// Mock the service module
vi.mock('../../../../services/supplierDashboardService', () => ({
  getRevenueTrend: vi.fn(),
  getTopProducts: vi.fn(),
}));

import { getRevenueTrend, getTopProducts } from '../../../../services/supplierDashboardService';

const mockTrend = [
  { date: '2026-03-20', revenue: 1000, order_count: 5 },
  { date: '2026-03-21', revenue: 2000, order_count: 10 },
];

const mockProducts = [
  { product_id: 1, product_name: '测试产品', order_count: 15, revenue: 3000, guest_count: 30 },
];

function setupMocks() {
  (getRevenueTrend as ReturnType<typeof vi.fn>).mockResolvedValue(mockTrend);
  (getTopProducts as ReturnType<typeof vi.fn>).mockResolvedValue(mockProducts);
}

describe('SupplierReportsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMocks();
  });

  it('renders without crashing and shows the page title', async () => {
    render(<SupplierReportsPage />);
    expect(screen.getByText('supplier.reports.title')).toBeInTheDocument();
  });

  it('shows loading state initially (Loader2 spinner)', () => {
    // Use a never-resolving promise to keep loading state
    (getRevenueTrend as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));
    (getTopProducts as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));

    render(<SupplierReportsPage />);

    // Loader2 renders as an <svg> element; check it is present via its CSS animation style
    const spinner = document.querySelector('svg');
    expect(spinner).toBeInTheDocument();
  });

  it('shows stat cards with computed values after data loads', async () => {
    render(<SupplierReportsPage />);

    await waitFor(() => {
      // totalRevenue = 1000 + 2000 = 3000
      expect(screen.getByText('AUD $3,000')).toBeInTheDocument();
    });

    // totalOrders = 5 + 10 = 15
    expect(screen.getByText('15')).toBeInTheDocument();
    expect(screen.getByText('supplier.reports.totalOrders')).toBeInTheDocument();

    // avgOrderValue = 3000 / 15 = 200
    expect(screen.getByText('AUD $200')).toBeInTheDocument();
    expect(screen.getByText('supplier.reports.avgOrderValue')).toBeInTheDocument();

    // activeDays = data.length = 2
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('supplier.reports.activeDays')).toBeInTheDocument();
  });

  it('shows date range buttons (7d, 30d, 90d)', () => {
    render(<SupplierReportsPage />);
    expect(screen.getByText('supplier.reports.range7d')).toBeInTheDocument();
    expect(screen.getByText('supplier.reports.range30d')).toBeInTheDocument();
    expect(screen.getByText('supplier.reports.range90d')).toBeInTheDocument();
  });

  it('renders chart sections after data loads', async () => {
    render(<SupplierReportsPage />);

    await waitFor(() => {
      expect(screen.getByText('supplier.reports.revenueTrend')).toBeInTheDocument();
    });
    expect(screen.getByText('supplier.reports.ordersChart')).toBeInTheDocument();
  });

  it('shows product ranking with mock data', async () => {
    render(<SupplierReportsPage />);

    await waitFor(() => {
      expect(screen.getByText('supplier.reports.productRanking')).toBeInTheDocument();
    });

    expect(screen.getByText('测试产品')).toBeInTheDocument();
    expect(screen.getByText('15 supplier.reports.orderUnit · AUD $3,000')).toBeInTheDocument();
  });

  it('calls getRevenueTrend with correct days when switching ranges', async () => {
    render(<SupplierReportsPage />);

    // Default is 7d
    await waitFor(() => {
      expect(getRevenueTrend).toHaveBeenCalledWith(7);
    });

    fireEvent.click(screen.getByText('supplier.reports.range30d'));
    await waitFor(() => {
      expect(getRevenueTrend).toHaveBeenCalledWith(30);
    });

    fireEvent.click(screen.getByText('supplier.reports.range90d'));
    await waitFor(() => {
      expect(getRevenueTrend).toHaveBeenCalledWith(90);
    });
  });

  it('renders bar chart date labels from trend data', async () => {
    render(<SupplierReportsPage />);

    await waitFor(() => {
      // date '2026-03-20' is formatted as '03/20'
      expect(screen.getAllByText('03/20').length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.getAllByText('03/21').length).toBeGreaterThanOrEqual(1);
  });
});
