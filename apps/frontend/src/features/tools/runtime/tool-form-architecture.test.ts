import { describe, expect, it } from 'vitest';
import {
  getEnabledToolKeys,
  getAvailableSteps,
  getToolLabel,
  getToolRoute,
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

  it('normalizes workflow-form tool identifiers to canonical label and route', () => {
    expect(getToolLabel('angle_generator')).toBe('Angle Generator');
    expect(getToolRoute('angle_generator')).toBe('/tools/angle-generator');
  });

  it('filters enabled tools by role using availability policy', () => {
    expect(getEnabledToolKeys('member')).toEqual([
      'funnel-pages',
      'youtube-lf-script',
      'angle-generator',
    ]);
    expect(getEnabledToolKeys('admin')).toEqual([
      'funnel-pages',
      'nextland',
      'youtube-lf-script',
      'angle-generator',
    ]);
    expect(isToolEnabled('nextland', 'member')).toBe(false);
    expect(isToolEnabled('nextland', 'admin')).toBe(true);
  });
});
