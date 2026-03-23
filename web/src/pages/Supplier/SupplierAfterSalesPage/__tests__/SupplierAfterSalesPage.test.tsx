import { render, screen, fireEvent } from '@testing-library/react';
import { SupplierAfterSalesPage } from '../SupplierAfterSalesPage';

/**
 * Helper: the filter toolbar buttons and ticket status badges share the same
 * i18n key text (e.g. "supplier.afterSales.statusPending"). This helper finds
 * the filter button specifically by looking for a <button> element among all
 * matches.
 */
function getFilterButton(text: string): HTMLButtonElement {
  const all = screen.getAllByText(text);
  const btn = all.find((el) => el.tagName === 'BUTTON');
  if (!btn) throw new Error(`No <button> found with text "${text}"`);
  return btn as HTMLButtonElement;
}

describe('SupplierAfterSalesPage', () => {
  it('renders without crashing', () => {
    render(<SupplierAfterSalesPage />);
    expect(screen.getByText('supplier.afterSales.title')).toBeInTheDocument();
  });

  it('displays the page title as h1', () => {
    render(<SupplierAfterSalesPage />);
    const title = screen.getByText('supplier.afterSales.title');
    expect(title.tagName).toBe('H1');
  });

  it('renders stat cards with correct values', () => {
    render(<SupplierAfterSalesPage />);
    // Total tickets = 6
    expect(screen.getByText('6')).toBeInTheDocument();
    expect(screen.getByText('supplier.afterSales.totalTickets')).toBeInTheDocument();
    // Pending tickets = 2
    expect(screen.getByText('supplier.afterSales.pendingTickets')).toBeInTheDocument();
    // Avg response
    expect(screen.getByText('4.2h')).toBeInTheDocument();
    expect(screen.getByText('supplier.afterSales.avgResponse')).toBeInTheDocument();
    // SLA rate
    expect(screen.getByText('87%')).toBeInTheDocument();
    expect(screen.getByText('supplier.afterSales.slaRate')).toBeInTheDocument();
  });

  it('renders all filter buttons', () => {
    render(<SupplierAfterSalesPage />);
    expect(getFilterButton('supplier.afterSales.all')).toBeInTheDocument();
    expect(getFilterButton('supplier.afterSales.statusPending')).toBeInTheDocument();
    expect(getFilterButton('supplier.afterSales.statusProcessing')).toBeInTheDocument();
    expect(getFilterButton('supplier.afterSales.statusResolved')).toBeInTheDocument();
    expect(getFilterButton('supplier.afterSales.statusRejected')).toBeInTheDocument();
  });

  it('renders all tickets by default (all filter)', () => {
    render(<SupplierAfterSalesPage />);
    expect(screen.getByText('AS-20260320-001')).toBeInTheDocument();
    expect(screen.getByText('AS-20260319-002')).toBeInTheDocument();
    expect(screen.getByText('AS-20260318-003')).toBeInTheDocument();
    expect(screen.getByText('AS-20260317-004')).toBeInTheDocument();
    expect(screen.getByText('AS-20260315-005')).toBeInTheDocument();
    expect(screen.getByText('AS-20260314-006')).toBeInTheDocument();
  });

  it('displays ticket descriptions and customer names', () => {
    render(<SupplierAfterSalesPage />);
    expect(screen.getByText('Alice Wang')).toBeInTheDocument();
    expect(screen.getByText('Weather cancellation, requesting full refund')).toBeInTheDocument();
    expect(screen.getByText('Bob Zhang')).toBeInTheDocument();
  });

  it('shows Chinese product names when i18n.language is zh', () => {
    render(<SupplierAfterSalesPage />);
    // Default mock i18n.language is 'zh'
    expect(screen.getByText('袋鼠岛一日游')).toBeInTheDocument();
    expect(screen.getByText('巴罗萨谷品酒之旅')).toBeInTheDocument();
  });

  it('filters tickets by pending status', () => {
    render(<SupplierAfterSalesPage />);
    fireEvent.click(getFilterButton('supplier.afterSales.statusPending'));

    // Only 2 pending tickets (t1, t3)
    expect(screen.getByText('AS-20260320-001')).toBeInTheDocument();
    expect(screen.getByText('AS-20260318-003')).toBeInTheDocument();
    // Should not show resolved/rejected tickets
    expect(screen.queryByText('AS-20260317-004')).not.toBeInTheDocument();
    expect(screen.queryByText('AS-20260315-005')).not.toBeInTheDocument();
  });

  it('filters tickets by resolved status', () => {
    render(<SupplierAfterSalesPage />);
    fireEvent.click(getFilterButton('supplier.afterSales.statusResolved'));

    // 2 resolved tickets (t4, t6)
    expect(screen.getByText('AS-20260317-004')).toBeInTheDocument();
    expect(screen.getByText('AS-20260314-006')).toBeInTheDocument();
    expect(screen.queryByText('AS-20260320-001')).not.toBeInTheDocument();
  });

  it('shows only rejected tickets when rejected filter is active', () => {
    render(<SupplierAfterSalesPage />);
    fireEvent.click(getFilterButton('supplier.afterSales.statusRejected'));

    // Only 1 rejected ticket (t5)
    expect(screen.getByText('AS-20260315-005')).toBeInTheDocument();
    expect(screen.queryByText('AS-20260320-001')).not.toBeInTheDocument();
    expect(screen.queryByText('AS-20260319-002')).not.toBeInTheDocument();
  });

  it('processes a pending ticket via the process action button', () => {
    render(<SupplierAfterSalesPage />);

    // Filter to pending to easily find action buttons
    fireEvent.click(getFilterButton('supplier.afterSales.statusPending'));

    // Click the first "Process" button
    const processBtns = screen.getAllByText('supplier.afterSales.actionProcess');
    fireEvent.click(processBtns[0]);

    // After processing, that ticket leaves the pending filter
    // Now only 1 pending ticket remains (t3)
    expect(screen.queryByText('AS-20260320-001')).not.toBeInTheDocument();
    expect(screen.getByText('AS-20260318-003')).toBeInTheDocument();
  });

  it('resolves a ticket via the resolve action button', () => {
    render(<SupplierAfterSalesPage />);

    // Filter to pending
    fireEvent.click(getFilterButton('supplier.afterSales.statusPending'));

    // Click the first "Resolve" button
    const resolveBtns = screen.getAllByText('supplier.afterSales.actionResolve');
    fireEvent.click(resolveBtns[0]);

    // That ticket is now resolved and no longer in pending filter
    expect(screen.queryByText('AS-20260320-001')).not.toBeInTheDocument();
  });

  it('shows SLA hours remaining for active tickets', () => {
    render(<SupplierAfterSalesPage />);
    // t1 has 18h left, t2 has 6h left, t3 has 2h left
    expect(screen.getByText('18h supplier.afterSales.slaLeft')).toBeInTheDocument();
    expect(screen.getByText('6h supplier.afterSales.slaLeft')).toBeInTheDocument();
    expect(screen.getByText('2h supplier.afterSales.slaLeft')).toBeInTheDocument();
  });

  it('displays refund amounts for refund tickets', () => {
    render(<SupplierAfterSalesPage />);
    expect(screen.getByText('AUD $398.00')).toBeInTheDocument();
    expect(screen.getByText('AUD $178.00')).toBeInTheDocument();
    expect(screen.getByText('AUD $89.00')).toBeInTheDocument();
  });
});
