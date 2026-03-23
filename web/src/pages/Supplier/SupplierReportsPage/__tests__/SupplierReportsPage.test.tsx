import { render, screen, fireEvent } from '@testing-library/react';
import { SupplierReportsPage } from '../SupplierReportsPage';

describe('SupplierReportsPage', () => {
  it('renders without crashing', () => {
    render(<SupplierReportsPage />);
    expect(screen.getByText('supplier.reports.title')).toBeInTheDocument();
  });

  it('displays the page title as h1', () => {
    render(<SupplierReportsPage />);
    const title = screen.getByText('supplier.reports.title');
    expect(title.tagName).toBe('H1');
  });

  it('renders all date range selector buttons', () => {
    render(<SupplierReportsPage />);
    expect(screen.getByText('supplier.reports.range7d')).toBeInTheDocument();
    expect(screen.getByText('supplier.reports.range30d')).toBeInTheDocument();
    expect(screen.getByText('supplier.reports.range90d')).toBeInTheDocument();
  });

  it('renders stat cards with 7d data by default', () => {
    render(<SupplierReportsPage />);
    // 7d total revenue = 1240+890+1560+720+2100+1890+1350 = 9750
    expect(screen.getByText('AUD $9,750')).toBeInTheDocument();
    expect(screen.getByText('supplier.reports.totalRevenue')).toBeInTheDocument();
    // 7d total orders = 8+5+11+4+14+12+9 = 63
    expect(screen.getByText('63')).toBeInTheDocument();
    expect(screen.getByText('supplier.reports.totalOrders')).toBeInTheDocument();
    // Avg order value = 9750/63 ~ 155
    expect(screen.getByText('AUD $155')).toBeInTheDocument();
    expect(screen.getByText('supplier.reports.avgOrderValue')).toBeInTheDocument();
    // Conversion rate
    expect(screen.getByText('3.8%')).toBeInTheDocument();
    expect(screen.getByText('supplier.reports.conversionRate')).toBeInTheDocument();
  });

  it('renders chart section titles', () => {
    render(<SupplierReportsPage />);
    expect(screen.getByText('supplier.reports.revenueTrend')).toBeInTheDocument();
    expect(screen.getByText('supplier.reports.ordersChart')).toBeInTheDocument();
    expect(screen.getByText('supplier.reports.productRanking')).toBeInTheDocument();
  });

  it('renders 7d bar chart date labels by default', () => {
    render(<SupplierReportsPage />);
    // Each date label appears twice (once in revenue chart, once in orders chart)
    expect(screen.getAllByText('03/17')).toHaveLength(2);
    expect(screen.getAllByText('03/20')).toHaveLength(2);
    expect(screen.getAllByText('03/23')).toHaveLength(2);
  });

  it('switches to 30d data when 30d button is clicked', () => {
    render(<SupplierReportsPage />);
    fireEvent.click(screen.getByText('supplier.reports.range30d'));

    // 30d total revenue = 3200+2800+4100+3600+5200+4800+3900+4500 = 32100
    expect(screen.getByText('AUD $32,100')).toBeInTheDocument();
    // 30d total orders = 22+18+28+24+35+31+26+30 = 214
    expect(screen.getByText('214')).toBeInTheDocument();
    // 30d date labels
    expect(screen.getAllByText('02/22')).toHaveLength(2);
    expect(screen.getAllByText('03/10')).toHaveLength(2);
  });

  it('switches to 90d data when 90d button is clicked', () => {
    render(<SupplierReportsPage />);
    fireEvent.click(screen.getByText('supplier.reports.range90d'));

    // 90d total revenue = 28000+35000+42000 = 105000
    expect(screen.getByText('AUD $105,000')).toBeInTheDocument();
    // 90d total orders = 180+230+285 = 695
    expect(screen.getByText('695')).toBeInTheDocument();
  });

  it('shows Chinese product names in ranking by default (zh locale)', () => {
    render(<SupplierReportsPage />);
    // Default i18n.language is 'zh'
    expect(screen.getByText('袋鼠岛一日游')).toBeInTheDocument();
    expect(screen.getByText('巴罗萨谷品酒之旅')).toBeInTheDocument();
    expect(screen.getByText('阿德莱德城市观光')).toBeInTheDocument();
    expect(screen.getByText('维克多港企鹅观赏')).toBeInTheDocument();
    expect(screen.getByText('格雷内尔格日落之旅')).toBeInTheDocument();
  });

  it('renders product ranking order numbers', () => {
    render(<SupplierReportsPage />);
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('displays product order counts and revenue in ranking', () => {
    render(<SupplierReportsPage />);
    expect(screen.getByText('42 supplier.reports.orderUnit · AUD $12,600')).toBeInTheDocument();
    expect(screen.getByText('35 supplier.reports.orderUnit · AUD $9,800')).toBeInTheDocument();
    expect(screen.getByText('48 supplier.reports.orderUnit · AUD $7,200')).toBeInTheDocument();
  });

  it('updates avg order value correctly when switching ranges', () => {
    render(<SupplierReportsPage />);
    // 7d: 9750/63 ~ 155
    expect(screen.getByText('AUD $155')).toBeInTheDocument();

    fireEvent.click(screen.getByText('supplier.reports.range30d'));
    // 30d: 32100/214 ~ 150
    expect(screen.getByText('AUD $150')).toBeInTheDocument();

    fireEvent.click(screen.getByText('supplier.reports.range90d'));
    // 90d: 105000/695 ~ 151
    expect(screen.getByText('AUD $151')).toBeInTheDocument();
  });
});
