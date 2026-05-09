/**
 * REQ-20260510-0001 · F1/F6 · 双语字段解析 helper
 *
 * 统一处理「中/英文字段对」的取值与 fallback：
 *   - strict=false（C 端默认）: 缺请求语言时 fallback 到对面语言（保留现有 ProductDetailPage 行为）
 *   - strict=true（预览页传）: 缺请求语言返 null，由组件层显 SkeletonLine 而非英文 fallback
 *
 * 参考 REQ-20260510-0001 PRD v1.1 缺陷 #3 修订（skeleton vs fallback 冲突）。
 */

export type Locale = 'zh' | 'en';

export interface LocalizedFieldPair<T extends string | readonly string[]> {
  zh?: T | null;
  en?: T | null;
}

export interface GetLocalizedFieldOptions {
  /** true → 缺请求语言返 null，不 fallback。预览页用。 */
  strict?: boolean;
}

function isNonEmpty(v: unknown): boolean {
  if (v === null || v === undefined) return false;
  if (typeof v === 'string') return v.trim().length > 0;
  if (Array.isArray(v)) return v.length > 0;
  return true;
}

/**
 * 从一对中英字段中取目标语言的内容。
 *
 * @example
 * getLocalizedField({ zh: '阿德莱德', en: 'Adelaide' }, 'en') // → 'Adelaide'
 * getLocalizedField({ zh: '', en: 'Adelaide' }, 'zh') // → 'Adelaide'（fallback）
 * getLocalizedField({ zh: '', en: 'Adelaide' }, 'zh', { strict: true }) // → null
 */
export function getLocalizedField<T extends string | readonly string[]>(
  pair: LocalizedFieldPair<T>,
  locale: Locale,
  options?: GetLocalizedFieldOptions,
): T | null {
  const requested = locale === 'zh' ? pair.zh : pair.en;
  if (isNonEmpty(requested)) return requested as T;

  if (options?.strict) return null;

  const fallback = locale === 'zh' ? pair.en : pair.zh;
  if (isNonEmpty(fallback)) return fallback as T;

  return null;
}
