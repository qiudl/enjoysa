import { render, screen, fireEvent } from '@testing-library/react';
import { SupplierProductPreviewPage } from '../SupplierProductPreviewPage';

describe('SupplierProductPreviewPage', () => {
  it('renders without crashing', () => {
    render(<SupplierProductPreviewPage />);
    // The banner text is "supplier.preview.title (supplier.preview.customerView)" in a single span
    expect(screen.getByText(/supplier\.preview\.title/)).toBeInTheDocument();
  });

  it('displays Chinese product name when i18n.language is zh', () => {
    render(<SupplierProductPreviewPage />);
    // i18n.language mock returns 'zh', so the Chinese name should appear
    expect(screen.getByText('\u888b\u9f20\u5c9b\u4e00\u65e5\u6e38')).toBeInTheDocument();
  });

  it('shows the preview banner with customer view label', () => {
    render(<SupplierProductPreviewPage />);
    expect(screen.getByText(/supplier.preview.title/)).toBeInTheDocument();
    expect(screen.getByText(/supplier.preview.customerView/)).toBeInTheDocument();
  });

  it('displays price, rating and duration', () => {
    render(<SupplierProductPreviewPage />);
    expect(screen.getByText('AUD $199')).toBeInTheDocument();
    expect(screen.getByText('4.8')).toBeInTheDocument();
    expect(screen.getByText(/126/)).toBeInTheDocument();
    expect(screen.getByText('\u7ea610\u5c0f\u65f6')).toBeInTheDocument();
  });

  it('renders highlights list in Chinese', () => {
    render(<SupplierProductPreviewPage />);
    expect(screen.getByText('supplier.preview.highlights')).toBeInTheDocument();
    expect(screen.getByText('\u8fd1\u8ddd\u79bb\u63a5\u89e6\u91ce\u751f\u6d77\u8c79\u3001\u888b\u9f20\u548c\u8003\u62c9')).toBeInTheDocument();
    expect(screen.getByText('\u53c2\u89c2\u5f17\u6797\u5fb7\u65af\u00b7\u8521\u65af\u56fd\u5bb6\u516c\u56ed\u7684\u795e\u5947\u5ca9\u77f3')).toBeInTheDocument();
    expect(screen.getByText('\u54c1\u5c1d\u888b\u9f20\u5c9b\u672c\u5730\u8702\u871c\u548c\u6709\u673a\u519c\u4ea7\u54c1')).toBeInTheDocument();
    expect(screen.getByText('\u6b23\u8d4f\u5357\u5927\u6d0b\u58ee\u4e3d\u7684\u6d77\u5cb8\u7ebf\u65e5\u843d')).toBeInTheDocument();
    expect(screen.getByText('\u4e13\u4e1a\u4e2d\u82f1\u53cc\u8bed\u5bfc\u6e38\u5168\u7a0b\u8bb2\u89e3')).toBeInTheDocument();
  });

  it('renders includes list in Chinese', () => {
    render(<SupplierProductPreviewPage />);
    expect(screen.getByText('supplier.preview.includes')).toBeInTheDocument();
    expect(screen.getByText('\u963f\u5fb7\u83b1\u5fb7\u5e02\u533a\u9152\u5e97\u63a5\u9001')).toBeInTheDocument();
    expect(screen.getByText('\u6e21\u8f6e\u5f80\u8fd4\u8239\u7968')).toBeInTheDocument();
    expect(screen.getByText('\u56fd\u5bb6\u516c\u56ed\u95e8\u7968')).toBeInTheDocument();
    expect(screen.getByText('\u5348\u9910\uff08\u542b\u7d20\u98df\u9009\u9879\uff09')).toBeInTheDocument();
  });

  it('renders excludes list in Chinese', () => {
    render(<SupplierProductPreviewPage />);
    expect(screen.getByText('supplier.preview.excludes')).toBeInTheDocument();
    expect(screen.getByText('\u65c5\u884c\u4fdd\u9669')).toBeInTheDocument();
    expect(screen.getByText('\u4e2a\u4eba\u6d88\u8d39\u53ca\u5c0f\u8d39')).toBeInTheDocument();
  });

  it('displays schedule items in Chinese', () => {
    render(<SupplierProductPreviewPage />);
    expect(screen.getByText('supplier.preview.schedule')).toBeInTheDocument();
    expect(screen.getByText('06:30')).toBeInTheDocument();
    expect(screen.getByText('\u963f\u5fb7\u83b1\u5fb7\u5e02\u533a\u9152\u5e97\u63a5\u5ba2')).toBeInTheDocument();
    expect(screen.getByText('08:00')).toBeInTheDocument();
    expect(screen.getByText('\u4e58\u5750\u6e21\u8f6e\u524d\u5f80\u888b\u9f20\u5c9b')).toBeInTheDocument();
  });

  it('shows image carousel with correct counter (starts at 1/4)', () => {
    render(<SupplierProductPreviewPage />);
    expect(screen.getByText(/1\/4/)).toBeInTheDocument();
  });

  it('navigates carousel forward when next arrow is clicked', () => {
    render(<SupplierProductPreviewPage />);
    const nextBtn = screen.getByLabelText('Next image');
    fireEvent.click(nextBtn);
    expect(screen.getByText(/2\/4/)).toBeInTheDocument();
  });

  it('navigates carousel backward when prev arrow is clicked', () => {
    render(<SupplierProductPreviewPage />);
    // Clicking prev from image 1 should wrap to image 4
    const prevBtn = screen.getByLabelText('Previous image');
    fireEvent.click(prevBtn);
    expect(screen.getByText(/4\/4/)).toBeInTheDocument();
  });

  it('displays notices in Chinese', () => {
    render(<SupplierProductPreviewPage />);
    expect(screen.getByText('supplier.preview.notices')).toBeInTheDocument();
    expect(screen.getByText('\u8bf7\u7a7f\u7740\u8212\u9002\u7684\u6b65\u884c\u978b\u548c\u9632\u98ce\u5916\u5957')).toBeInTheDocument();
    expect(screen.getByText('\u6655\u8239\u65c5\u5ba2\u5efa\u8bae\u63d0\u524d\u670d\u7528\u6655\u8239\u836f')).toBeInTheDocument();
  });
});
