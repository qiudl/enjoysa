import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../api', () => ({
  get: vi.fn(),
}));

import { get } from '../api';
import {
  getRevenueTrend,
  getTopProducts,
  getChannelStats,
} from '../supplierDashboardService';

const mockGet = get as unknown as ReturnType<typeof vi.fn>;

describe('supplierDashboardService null tolerance', () => {
  beforeEach(() => {
    mockGet.mockReset();
  });

  it('getRevenueTrend coerces null to []', async () => {
    mockGet.mockResolvedValueOnce(null);
    await expect(getRevenueTrend(7)).resolves.toEqual([]);
  });

  it('getRevenueTrend passes through arrays unchanged', async () => {
    const sample = [{ date: '2026-03-20', revenue: 100, order_count: 2 }];
    mockGet.mockResolvedValueOnce(sample);
    await expect(getRevenueTrend(7)).resolves.toEqual(sample);
  });

  it('getTopProducts coerces null to []', async () => {
    mockGet.mockResolvedValueOnce(null);
    await expect(getTopProducts(30, 5)).resolves.toEqual([]);
  });

  it('getChannelStats coerces null to []', async () => {
    mockGet.mockResolvedValueOnce(null);
    await expect(getChannelStats(30)).resolves.toEqual([]);
  });
});
