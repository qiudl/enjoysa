import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SupplierProductListPage } from '../SupplierProductListPage';

// Mock supplier product service
vi.mock('../../../../services/supplierProductService', () => ({
  supplierProductService: {
    list: vi.fn().mockResolvedValue({
      items: [
        {
          id: 1,
          name_zh: '袋鼠岛一日游',
          name_en: 'Kangaroo Island Day Tour',
          images: [{ url: 'https://example.com/ki.jpg', is_cover: true }],
          price_from: 199,
          status: 'approved',
          created_at: '2026-03-10T00:00:00Z',
        },
        {
          id: 2,
          name_zh: '巴罗萨谷品酒之旅',
          name_en: 'Barossa Valley Wine Tour',
          images: [{ url: 'https://example.com/bv.jpg', is_cover: true }],
          price_from: 178,
          status: 'offline',
          created_at: '2026-03-08T00:00:00Z',
        },
        {
          id: 3,
          name_zh: '阿德莱德城市观光',
          name_en: 'Adelaide City Tour',
          images: [],
          price_from: 89,
          status: 'pending',
          created_at: '2026-03-05T00:00:00Z',
        },
      ],
    }),
    remove: vi.fn().mockResolvedValue({}),
    online: vi.fn().mockResolvedValue({}),
    offline: vi.fn().mockResolvedValue({}),
    batchAction: vi.fn().mockResolvedValue({}),
  },
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

// Mock productService type import
vi.mock('../../../../services/productService', () => ({}));

describe('SupplierProductListPage', () => {
  it('renders the page title', () => {
    render(<SupplierProductListPage />);
    expect(screen.getByText('supplier.products.title')).toBeInTheDocument();
  });

  it('shows the add product button', () => {
    render(<SupplierProductListPage />);
    expect(screen.getByText(/supplier\.products\.addProduct/)).toBeInTheDocument();
  });

  it('shows products after loading', async () => {
    render(<SupplierProductListPage />);
    await waitFor(() => {
      expect(screen.getByText('袋鼠岛一日游')).toBeInTheDocument();
    });
    expect(screen.getByText('巴罗萨谷品酒之旅')).toBeInTheDocument();
    expect(screen.getByText('阿德莱德城市观光')).toBeInTheDocument();
  });

  it('displays product prices', async () => {
    render(<SupplierProductListPage />);
    await waitFor(() => {
      expect(screen.getByText('A$199')).toBeInTheDocument();
    });
    expect(screen.getByText('A$178')).toBeInTheDocument();
    expect(screen.getByText('A$89')).toBeInTheDocument();
  });

  it('renders status filter buttons', () => {
    render(<SupplierProductListPage />);
    expect(screen.getByText('supplier.products.all')).toBeInTheDocument();
    expect(screen.getByText('supplier.products.active')).toBeInTheDocument();
    expect(screen.getByText('supplier.products.inactive')).toBeInTheDocument();
    expect(screen.getByText('supplier.products.pending')).toBeInTheDocument();
  });

  it('filters by active status', async () => {
    render(<SupplierProductListPage />);
    await waitFor(() => {
      expect(screen.getByText('袋鼠岛一日游')).toBeInTheDocument();
    });

    const activeBtns = screen.getAllByText('supplier.products.active');
    const filterBtn = activeBtns.find((el) => el.tagName === 'BUTTON');
    fireEvent.click(filterBtn!);

    expect(screen.getByText('袋鼠岛一日游')).toBeInTheDocument();
    expect(screen.queryByText('巴罗萨谷品酒之旅')).not.toBeInTheDocument();
    expect(screen.queryByText('阿德莱德城市观光')).not.toBeInTheDocument();
  });

  it('filters by inactive status', async () => {
    render(<SupplierProductListPage />);
    await waitFor(() => {
      expect(screen.getByText('巴罗萨谷品酒之旅')).toBeInTheDocument();
    });

    const inactiveBtns = screen.getAllByText('supplier.products.inactive');
    const filterBtn = inactiveBtns.find((el) => el.tagName === 'BUTTON');
    fireEvent.click(filterBtn!);

    expect(screen.getByText('巴罗萨谷品酒之旅')).toBeInTheDocument();
    expect(screen.queryByText('袋鼠岛一日游')).not.toBeInTheDocument();
  });

  it('searches by product name', async () => {
    render(<SupplierProductListPage />);
    await waitFor(() => {
      expect(screen.getByText('袋鼠岛一日游')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('supplier.products.search');
    fireEvent.change(searchInput, { target: { value: '巴罗萨' } });

    expect(screen.queryByText('袋鼠岛一日游')).not.toBeInTheDocument();
    expect(screen.getByText('巴罗萨谷品酒之旅')).toBeInTheDocument();
  });

  it('calls onNavigate for add product button', () => {
    const onNavigate = vi.fn();
    render(<SupplierProductListPage onNavigate={onNavigate} />);

    const addBtn = screen.getByText(/supplier\.products\.addProduct/);
    fireEvent.click(addBtn);
    expect(onNavigate).toHaveBeenCalledWith('/supplier/products/new');
  });

  it('calls onNavigate for edit button', async () => {
    const onNavigate = vi.fn();
    render(<SupplierProductListPage onNavigate={onNavigate} />);
    await waitFor(() => {
      expect(screen.getByText('袋鼠岛一日游')).toBeInTheDocument();
    });

    const editBtns = screen.getAllByText('supplier.products.edit');
    fireEvent.click(editBtns[0]);
    expect(onNavigate).toHaveBeenCalledWith('/supplier/products/1/edit');
  });

  it('calls onNavigate for preview button', async () => {
    const onNavigate = vi.fn();
    render(<SupplierProductListPage onNavigate={onNavigate} />);
    await waitFor(() => {
      expect(screen.getByText('袋鼠岛一日游')).toBeInTheDocument();
    });

    const previewBtns = screen.getAllByText('supplier.preview.title');
    fireEvent.click(previewBtns[0]);
    expect(onNavigate).toHaveBeenCalledWith('/supplier/products/1/preview');
  });

  it('toggles select all checkbox', async () => {
    render(<SupplierProductListPage />);
    await waitFor(() => {
      expect(screen.getByText('袋鼠岛一日游')).toBeInTheDocument();
    });

    const checkboxes = screen.getAllByRole('checkbox');
    // First checkbox is "select all"
    fireEvent.click(checkboxes[0]);

    // Batch bar should appear
    expect(screen.getByText(/supplier\.products\.selected/)).toBeInTheDocument();
  });
});
