import { describe, expect, it } from 'vitest';
import {
  getEnabledToolKeys,
  getAvailableSteps,
  isToolEnabled,
} from './tool-form-architecture';

describe('getAvailableSteps', () => {
  it('returns only incomplete steps whose dependencies are satisfied for funnel-pages', () => {
    expect(getAvailableSteps('funnel-pages', new Set())).toEqual(['optin']);
    expect(getAvailableSteps('funnel-pages', new Set(['optin']))).toEqual(['quiz']);
    expect(getAvailableSteps('funnel-pages', new Set(['optin', 'quiz']))).toEqual(['vsl']);
    expect(getAvailableSteps('funnel-pages', new Set(['optin', 'quiz', 'vsl']))).toEqual([]);
  });

  it('returns only incomplete steps for nextland', () => {
    expect(getAvailableSteps('nextland', new Set())).toEqual(['landing']);
    expect(getAvailableSteps('nextland', new Set(['landing']))).toEqual(['thank_you']);
    expect(getAvailableSteps('nextland', new Set(['landing', 'thank_you']))).toEqual([]);
  });

  it('returns only incomplete steps for youtube-lf-script', () => {
    expect(getAvailableSteps('youtube-lf-script', new Set())).toEqual(['pre-script-analysis']);
    expect(getAvailableSteps('youtube-lf-script', new Set(['pre-script-analysis']))).toEqual(['packaging']);
    expect(getAvailableSteps('youtube-lf-script', new Set(['pre-script-analysis', 'packaging']))).toEqual(['intro-structure']);
  });
});

describe('isToolEnabled', () => {
  it('filters tools by role using availability policy', () => {
    expect(isToolEnabled('nextland', 'member')).toBe(false);
    expect(isToolEnabled('nextland', 'admin')).toBe(true);
    expect(isToolEnabled('geometric', 'member')).toBe(true);
    expect(isToolEnabled('geometric', 'admin')).toBe(true);
  });

  it('returns non-empty list for member and admin', () => {
    expect(getEnabledToolKeys('member').length).toBeGreaterThan(0);
    expect(getEnabledToolKeys('admin').length).toBeGreaterThan(getEnabledToolKeys('member').length);
  });
});
