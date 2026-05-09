import { describe, it, expect } from 'vitest';
import { getLocalizedField } from './getLocalizedField';

describe('getLocalizedField', () => {
  describe('string field, locale=zh', () => {
    it('zh 有 + en 有 → 返 zh', () => {
      expect(getLocalizedField({ zh: '阿德莱德', en: 'Adelaide' }, 'zh')).toBe('阿德莱德');
    });

    it('zh 空 + en 有 + strict=false → fallback en', () => {
      expect(getLocalizedField({ zh: '', en: 'Adelaide' }, 'zh')).toBe('Adelaide');
    });

    it('zh 空 + en 有 + strict=true → 返 null（用于预览页 skeleton）', () => {
      expect(getLocalizedField({ zh: '', en: 'Adelaide' }, 'zh', { strict: true })).toBeNull();
    });

    it('zh undefined + en undefined → 返 null', () => {
      expect(getLocalizedField({}, 'zh')).toBeNull();
    });

    it('zh 仅空格 → 等同空，触发 fallback', () => {
      expect(getLocalizedField({ zh: '   ', en: 'Adelaide' }, 'zh')).toBe('Adelaide');
    });
  });

  describe('string field, locale=en', () => {
    it('en 有 + zh 有 → 返 en', () => {
      expect(getLocalizedField({ zh: '阿德莱德', en: 'Adelaide' }, 'en')).toBe('Adelaide');
    });

    it('en 空 + zh 有 + strict=false → fallback zh', () => {
      expect(getLocalizedField({ zh: '阿德莱德', en: '' }, 'en')).toBe('阿德莱德');
    });

    it('en 空 + zh 有 + strict=true → 返 null', () => {
      expect(getLocalizedField({ zh: '阿德莱德', en: '' }, 'en', { strict: true })).toBeNull();
    });

    it('en null + zh null → 返 null', () => {
      expect(getLocalizedField({ zh: null, en: null }, 'en')).toBeNull();
    });
  });

  describe('array field（highlights/inclusions/exclusions）', () => {
    it('zh 数组非空 + en 数组非空 → 返 zh 数组（locale=zh）', () => {
      const result = getLocalizedField(
        { zh: ['亮点1', '亮点2'], en: ['Point 1', 'Point 2'] },
        'zh',
      );
      expect(result).toEqual(['亮点1', '亮点2']);
    });

    it('zh 空数组 + en 非空 + strict=false → fallback en 数组', () => {
      const result = getLocalizedField(
        { zh: [], en: ['Point 1'] },
        'zh',
      );
      expect(result).toEqual(['Point 1']);
    });

    it('zh 空数组 + en 非空 + strict=true → 返 null', () => {
      const result = getLocalizedField(
        { zh: [], en: ['Point 1'] },
        'zh',
        { strict: true },
      );
      expect(result).toBeNull();
    });

    it('两边都空数组 → 返 null', () => {
      expect(getLocalizedField({ zh: [], en: [] }, 'zh')).toBeNull();
      expect(getLocalizedField({ zh: [], en: [] }, 'en')).toBeNull();
    });
  });

  describe('strict 在两边都缺时也返 null（与非 strict 一致）', () => {
    it('zh 空 + en 空 + strict=true', () => {
      expect(getLocalizedField({ zh: '', en: '' }, 'zh', { strict: true })).toBeNull();
      expect(getLocalizedField({ zh: '', en: '' }, 'en', { strict: true })).toBeNull();
    });
  });
});
