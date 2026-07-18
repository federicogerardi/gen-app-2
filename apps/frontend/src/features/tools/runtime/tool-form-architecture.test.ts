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
    expect(getToolLabel('meta_ads_generator')).toBe('MetaAds Generator');
    expect(getToolRoute('meta_ads')).toBe('/tools/meta-ads');
    expect(getToolLabel('youtube_description')).toBe('YT Description Generator');
    expect(getToolRoute('youtube_description')).toBe('/tools/youtube-description');
    expect(getToolLabel('geometric_analysis')).toBe('Geometric');
    expect(getToolRoute('geometric')).toBe('/tools/geometric');
  });

  it('filters enabled tools by role using availability policy', () => {
    expect(getEnabledToolKeys('member')).toEqual([
      'funnel-pages',
      'youtube-lf-script',
      'angle-generator',
      'meta-ads',
      'youtube-description',
      'geometric',
      'blog-article-generator',
      'brief-generator',
    ]);
    expect(getEnabledToolKeys('admin')).toEqual([
      'funnel-pages',
      'nextland',
      'youtube-lf-script',
      'angle-generator',
      'meta-ads',
      'youtube-description',
      'geometric',
      'blog-article-generator',
      'brief-generator',
    ]);
    expect(isToolEnabled('nextland', 'member')).toBe(false);
    expect(isToolEnabled('nextland', 'admin')).toBe(true);
    expect(isToolEnabled('geometric', 'member')).toBe(true);
    expect(isToolEnabled('geometric', 'admin')).toBe(true);
  });
});
