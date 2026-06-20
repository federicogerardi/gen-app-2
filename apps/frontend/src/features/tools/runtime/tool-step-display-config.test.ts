import { describe, it, expect } from 'vitest';
import {
  TOOL_STEP_DISPLAY_CONFIG,
  isStepVisible,
  isStepIncludedInDownload,
  getVisibleSteps,
  getIncludedSteps,
} from './tool-step-display-config';

describe('tool-step-display-config', () => {
  describe('TOOL_STEP_DISPLAY_CONFIG structure', () => {
    it('should define config for all canonical tools', () => {
      const toolsWithConfig = Object.keys(TOOL_STEP_DISPLAY_CONFIG).sort();
      expect(toolsWithConfig).toEqual([
        'angle-generator',
        'funnel-pages',
        'geometric',
        'meta-ads',
        'nextland',
        'youtube-description',
        'youtube-lf-script',
      ]);
    });

    it('should configure every step for each tool', () => {
      for (const [toolKey, toolConfig] of Object.entries(TOOL_STEP_DISPLAY_CONFIG)) {
        void toolKey; // validated by surrounding test context
        const stepEntries = Object.keys(toolConfig);
        expect(stepEntries.length).toBeGreaterThan(0);

        for (const stepKey of stepEntries) {
          const config = toolConfig[stepKey as keyof typeof toolConfig];
          expect(config).toBeDefined();
          expect(typeof config?.visible).toBe('boolean');
          expect(typeof config?.includeInDownload).toBe('boolean');
        }
      }
    });

    it('should default every step to { visible: true, includeInDownload: true } when no override exists', () => {
      const funnelConfig = TOOL_STEP_DISPLAY_CONFIG['funnel-pages'];
      const funnelSteps = Object.values(funnelConfig || {});
      expect(funnelSteps.length).toBeGreaterThan(0);
      for (const stepConfig of funnelSteps) {
        expect(stepConfig).toEqual({ visible: true, includeInDownload: true });
      }
    });

    it('should allow explicit overrides per tool step', () => {
      const geometricConfig = TOOL_STEP_DISPLAY_CONFIG.geometric;
      expect(geometricConfig?.['serp-crawling']).toEqual({ visible: false, includeInDownload: false });
      expect(geometricConfig?.['competitor-scoring']).toEqual({ visible: false, includeInDownload: false });
      expect(geometricConfig?.['strategic-reporting']).toEqual({ visible: true, includeInDownload: false });
      expect(geometricConfig?.['unified-report']).toEqual({ visible: true, includeInDownload: true });
    });
  });

  describe('isStepVisible', () => {
    it('returns true for configured steps', () => {
      expect(isStepVisible('optin', 'funnel-pages')).toBe(true);
      expect(isStepVisible('landing', 'nextland')).toBe(true);
      expect(isStepVisible('pre-script-analysis', 'youtube-lf-script')).toBe(true);
    });

    it('returns false for geometric hidden steps', () => {
      expect(isStepVisible('serp-crawling', 'geometric')).toBe(false);
      expect(isStepVisible('competitor-scoring', 'geometric')).toBe(false);
      expect(isStepVisible('strategic-reporting', 'geometric')).toBe(true);
    });

    it('returns true for unconfigured steps (backward-compatible default)', () => {
      expect(isStepVisible('nonexistent-step', 'funnel-pages')).toBe(true);
      expect(isStepVisible('optin', 'nonexistent-tool')).toBe(true);
    });

    it('returns true when toolKey is null', () => {
      expect(isStepVisible('optin', null)).toBe(true);
    });

    it('returns true when stepKey is unrecognized', () => {
      expect(isStepVisible('totally-unknown-step', 'funnel-pages')).toBe(true);
    });
  });

  describe('isStepIncludedInDownload', () => {
    it('returns true for configured steps', () => {
      expect(isStepIncludedInDownload('quiz', 'funnel-pages')).toBe(true);
      expect(isStepIncludedInDownload('thank_you', 'nextland')).toBe(true);
    });

    it('returns false for geometric excluded steps', () => {
      expect(isStepIncludedInDownload('serp-crawling', 'geometric')).toBe(false);
      expect(isStepIncludedInDownload('competitor-scoring', 'geometric')).toBe(false);
      expect(isStepIncludedInDownload('strategic-reporting', 'geometric')).toBe(false);
      expect(isStepIncludedInDownload('unified-report', 'geometric')).toBe(true);
    });

    it('returns true for unconfigured steps (backward-compatible default)', () => {
      expect(isStepIncludedInDownload('nonexistent-step', 'funnel-pages')).toBe(true);
      expect(isStepIncludedInDownload('optin', 'nonexistent-tool')).toBe(true);
    });

    it('returns true when toolKey is null', () => {
      expect(isStepIncludedInDownload('quiz', null)).toBe(true);
    });

    it('returns true when stepKey is unrecognized', () => {
      expect(isStepIncludedInDownload('totally-unknown-step', 'funnel-pages')).toBe(true);
    });
  });

  describe('getVisibleSteps', () => {
    it('returns all steps for a configured tool (all visible by default)', () => {
      expect(getVisibleSteps('funnel-pages')).toEqual(['optin', 'quiz', 'vsl']);
      expect(getVisibleSteps('nextland')).toEqual(['landing', 'thank_you']);
    });

    it('returns only visible steps for geometric', () => {
      expect(getVisibleSteps('geometric')).toEqual([
        'strategic-reporting',
        'unified-report',
      ]);
    });

    it('returns empty array for null or invalid toolKey', () => {
      expect(getVisibleSteps(null)).toEqual([]);
      expect(getVisibleSteps('')).toEqual([]);
      expect(getVisibleSteps('nonexistent-tool')).toEqual([]);
    });

    it('returns steps in canonical order from TOOL_STEP_ORDER', () => {
      expect(getVisibleSteps('youtube-lf-script')).toEqual([
        'pre-script-analysis',
        'packaging',
        'intro-structure',
        'body-structure',
        'native-cta-embeds',
        'outro-structure',
      ]);
    });
  });

  describe('getIncludedSteps', () => {
    it('returns all steps for a configured tool (all included by default)', () => {
      expect(getIncludedSteps('funnel-pages')).toEqual(['optin', 'quiz', 'vsl']);
      expect(getIncludedSteps('nextland')).toEqual(['landing', 'thank_you']);
    });

    it('returns empty array for null or invalid toolKey', () => {
      expect(getIncludedSteps(null)).toEqual([]);
      expect(getIncludedSteps('')).toEqual([]);
      expect(getIncludedSteps('nonexistent-tool')).toEqual([]);
    });

    it('returns only included steps for geometric', () => {
      expect(getIncludedSteps('geometric')).toEqual([
        'unified-report',
      ]);
    });

    it('returns steps in canonical order from TOOL_STEP_ORDER', () => {
      expect(getIncludedSteps('youtube-lf-script')).toEqual([
        'pre-script-analysis',
        'packaging',
        'intro-structure',
        'body-structure',
        'native-cta-embeds',
        'outro-structure',
      ]);
    });
  });
});
