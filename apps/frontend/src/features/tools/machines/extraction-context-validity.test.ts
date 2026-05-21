import { describe, expect, it } from 'vitest';
import {
  hasRequiredExtractionFields,
  isExtractionContextValidForTool,
} from './extraction-context-validity';

describe('extraction-context-validity', () => {
  it('evaluates required keys through reusable hasRequiredExtractionFields helper', () => {
    const payload = {
      offer: 'Offerta',
      proof: 'Case study',
      target_audience: 'Freelance',
    };

    expect(hasRequiredExtractionFields(payload, ['offer', 'proof'])).toBe(true);
    expect(hasRequiredExtractionFields(payload, ['offer', 'primary_cta'])).toBe(false);
  });

  it('normalizes known legacy aliases before readiness checks', () => {
    const payload = {
      'Obiettivo del funnel': 'Lead generation',
      Target: 'Founder',
      Offerta: 'Audit gratuito',
      'Proof o testimonianze': 'Caso studio',
      'CTA principale': 'Prenota ora',
    };

    expect(
      isExtractionContextValidForTool('funnel-pages', payload, 'brief text'),
    ).toBe(true);
  });

  it('keeps youtube readiness blocked when canonical required keys are missing', () => {
    const payload = {
      knowledge_content: 'Context',
      avatar: 'Avatar',
      offer: 'Offer',
      proof: 'Proof',
    };

    expect(
      isExtractionContextValidForTool('youtube-lf-script', payload, 'brief text'),
    ).toBe(false);
  });
});
