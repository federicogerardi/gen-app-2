import { describe, it, expect } from 'vitest';
import { getToolAssetInputs, getProducerToolsForAsset } from './toolAssetRegistry';

describe('toolAssetRegistry', () => {
  describe('getToolAssetInputs', () => {
    it('returns consumes for funnel-pages', () => {
      const result = getToolAssetInputs('funnel-pages');
      expect(result).toHaveLength(2);
      expect(result.map(e => e.assetType)).toEqual(expect.arrayContaining(['persona', 'brand-voice']));
      expect(result.every(e => e.requiredness === 'always-required')).toBe(true);
    });

    it('returns consumes for meta-ads', () => {
      const result = getToolAssetInputs('meta-ads');
      expect(result.length).toBeGreaterThanOrEqual(3);
      expect(result.map(e => e.assetType)).toEqual(expect.arrayContaining(['angle', 'persona', 'brand-voice']));
    });

    it('returns empty array for geometric (no consumes)', () => {
      const result = getToolAssetInputs('geometric');
      expect(result).toHaveLength(0);
    });

    it('returns correct label for each asset type', () => {
      const result = getToolAssetInputs('funnel-pages');
      const personaEntry = result.find(e => e.assetType === 'persona');
      expect(personaEntry?.label).toBe('Persona');
    });
  });

  describe('getProducerToolsForAsset', () => {
    it('returns tools that produce landing-page', () => {
      const producers = getProducerToolsForAsset('landing-page');
      expect(producers).toEqual(expect.arrayContaining(['funnel-pages', 'nextland']));
    });

    it('returns tools that produce angle', () => {
      const producers = getProducerToolsForAsset('angle');
      expect(producers).toContain('angle-generator');
    });

    it('returns tools that produce ad-copy', () => {
      const producers = getProducerToolsForAsset('ad-copy');
      expect(producers).toContain('meta-ads');
    });

    it('returns empty array for unproduced asset type', () => {
      const producers = getProducerToolsForAsset('creative-brief');
      expect(producers).toHaveLength(0);
    });
  });
});
