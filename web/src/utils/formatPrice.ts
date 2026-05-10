export type Currency = 'AUD' | 'CNY';

export interface FormatPriceOptions {
  symbol?: boolean;
  decimals?: number;
}

const SYMBOL: Record<Currency, string> = {
  AUD: 'A$',
  CNY: '¥',
};

export function formatPrice(
  amount: number | string | null | undefined,
  currency: Currency | string | null | undefined = 'AUD',
  options: FormatPriceOptions = {},
): string {
  const { symbol = true, decimals = 2 } = options;

  const numeric =
    typeof amount === 'number'
      ? amount
      : typeof amount === 'string'
        ? Number(amount)
        : NaN;
  const safe = Number.isFinite(numeric) ? numeric : 0;

  const code: Currency = currency === 'CNY' ? 'CNY' : 'AUD';
  const body = safe.toFixed(decimals);

  return symbol ? `${SYMBOL[code]}${body}` : body;
}
