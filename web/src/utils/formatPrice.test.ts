import { describe, it, expect } from 'vitest';
import { formatPrice } from './formatPrice';

describe('formatPrice', () => {
  it('AUD 是默认币种', () => {
    expect(formatPrice(199.5)).toBe('A$199.50');
  });

  it('显式传 AUD 同样得 A$ 前缀', () => {
    expect(formatPrice(199.5, 'AUD')).toBe('A$199.50');
  });

  it('CNY 显式时用 ¥ 前缀', () => {
    expect(formatPrice(199.5, 'CNY')).toBe('¥199.50');
  });

  it('未知/无效 currency 兜底 AUD', () => {
    expect(formatPrice(99, 'USD' as unknown as 'AUD')).toBe('A$99.00');
    expect(formatPrice(99, undefined)).toBe('A$99.00');
    expect(formatPrice(99, null)).toBe('A$99.00');
  });

  it('字符串 amount 转数字', () => {
    expect(formatPrice('199.5', 'AUD')).toBe('A$199.50');
    expect(formatPrice('199', 'CNY')).toBe('¥199.00');
  });

  it('小数位可配', () => {
    expect(formatPrice(199, 'AUD', { decimals: 0 })).toBe('A$199');
    expect(formatPrice(199.123, 'AUD', { decimals: 3 })).toBe('A$199.123');
  });

  it('symbol=false 时只返数字', () => {
    expect(formatPrice(199.5, 'AUD', { symbol: false })).toBe('199.50');
    expect(formatPrice(199.5, 'CNY', { symbol: false })).toBe('199.50');
  });

  it('amount 为 null/undefined/NaN 时返 0.00', () => {
    expect(formatPrice(null)).toBe('A$0.00');
    expect(formatPrice(undefined)).toBe('A$0.00');
    expect(formatPrice('not-a-number')).toBe('A$0.00');
  });

  it('amount 为 0 时正确显示', () => {
    expect(formatPrice(0, 'AUD')).toBe('A$0.00');
    expect(formatPrice(0, 'CNY')).toBe('¥0.00');
  });
});
