import { render, screen } from '@testing-library/react';
import { ProductReviewTable, type ProductReview } from './ProductReviewTable';

vi.mock('../../AI/ProductPrecheck/ProductPrecheck', () => ({
  default: () => <span>precheck</span>,
}));

const draftProduct = {
  id: '47',
  name: "OZIN Chef's Selection Tasting Menu",
  supplierId: '36',
  supplierName: 'OZIN Restaurant',
  price: 80,
  status: 'draft',
  submittedAt: '2026-08-10T07:16:41Z',
} as ProductReview;

describe('ProductReviewTable', () => {
  it('shows the product ID in the first product column', () => {
    render(<ProductReviewTable products={[draftProduct]} />);

    expect(screen.getByText('ID: 47')).toBeInTheDocument();
  });

  it('shows a readable label for draft products', () => {
    render(<ProductReviewTable products={[draftProduct]} />);

    expect(screen.getByText('admin.products.status.draft')).toBeInTheDocument();
  });
});
