import { describe, it, expect } from 'vitest';
import { getToolAssetInputs, getProducerToolsForAsset } from './toolAssetRegistry';

describe('toolAssetRegistry', () => {
  describe('getToolAssetInputs', () => {
    it('sorts required-first for funnel-pages (brief required, rest optional)', () => {
      const result = getToolAssetInputs('funnel-pages');
      expect(result).toHaveLength(4);
      // brief has no '?' → always-required → first
      expect(result[0]!.assetType).toBe('brief');
      expect(result[0]!.requiredness).toBe('always-required');
      // persona?, brand-voice?, angle? have '?' → optional-by-tool-setting
      expect(result.slice(1).every(e => e.requiredness === 'optional-by-tool-setting')).toBe(true);
    });

    it('sorts required-first for mixed required/optional consumes (angle-generator)', () => {
      const result = getToolAssetInputs('angle-generator');
      expect(result).toHaveLength(3);
      // brief has no '?' → always-required → first
      expect(result[0]!.assetType).toBe('brief');
      expect(result[0]!.requiredness).toBe('always-required');
      // persona? and competitor-analysis? have '?' → optional-by-tool-setting
      expect(result.slice(1).every(e => e.requiredness === 'optional-by-tool-setting')).toBe(true);
    });

    it('sorts required-first for meta-ads (brief required, rest optional)', () => {
      const result = getToolAssetInputs('meta-ads');
      expect(result).toHaveLength(5);
      // brief has no '?' → always-required → first
      expect(result[0]!.assetType).toBe('brief');
      expect(result[0]!.requiredness).toBe('always-required');
      // angle?, persona?, brand-voice?, hook? have '?' → optional-by-tool-setting
      expect(result.slice(1).every(e => e.requiredness === 'optional-by-tool-setting')).toBe(true);
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
      expect(producers).toEqual(['nextland']);
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
