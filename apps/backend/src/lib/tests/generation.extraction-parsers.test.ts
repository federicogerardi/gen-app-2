import test from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeExtractionFieldKeysForTool,
  parseExtractionContent,
  parseMetaAdsExtractionMarkdown,
  parseYoutubeExtractionMarkdown,
} from '../machines/generation/extraction-parsers';

test('parseYoutubeExtractionMarkdown maps canonical sections and normalizes missing markers', () => {
  const markdown = [
    '## Knowledge Content',
    '- Framework A',
    '## Avatar',
    '- Non emerso dal documento.',
    '## Pain Point',
    '- Problema principale',
    '## Offer',
    '- Offerta 1',
    '## Proof',
    '- Testimonianza',
  ].join('\n');

  const parsed = parseYoutubeExtractionMarkdown(markdown);

  assert.equal(parsed.knowledge_content, 'Framework A');
  assert.equal(parsed.avatar, null);
  assert.equal(parsed.pain_point, 'Problema principale');
  assert.equal(parsed.offer, 'Offerta 1');
  assert.equal(parsed.proof, 'Testimonianza');
  assert.equal(parsed.purchase_process_type, null);
});

test('parseExtractionContent uses markdown parser for youtube-lf-script and falls back for others', () => {
  const markdown = ['## Tone', '- Diretto'].join('\n');
  const fromYoutube = parseExtractionContent(markdown, 'youtube_lf_script');
  assert.equal(fromYoutube.tone, 'Diretto');

  const fromJson = parseExtractionContent('{"foo":"bar"}', 'funnel-pages');
  assert.deepEqual(fromJson, { foo: 'bar' });

  const fromArray = parseExtractionContent('["foo","bar"]', 'funnel-pages');
  assert.deepEqual(fromArray, {});

  const fromInvalid = parseExtractionContent('not-json', 'funnel-pages');
  assert.deepEqual(fromInvalid, {});
});

test('parseMetaAdsExtractionMarkdown maps canonical sections and missing markers', () => {
  const markdown = [
    '## Product or Service',
    '- Meta blueprint',
    '## Target Audience',
    '- DTC founders',
    '## Campaign Objective',
    '- Non emerso dal documento.',
    '## Angle Candidates',
    '- Pain-first opener',
  ].join('\n');

  const parsed = parseMetaAdsExtractionMarkdown(markdown);

  assert.equal(parsed.product_or_service, 'Meta blueprint');
  assert.equal(parsed.target_audience, 'DTC founders');
  assert.equal(parsed.campaign_objective, null);
  assert.equal(parsed.angle_candidates, 'Pain-first opener');
  assert.equal(parsed.unique_mechanism, null);
});

test('parseMetaAdsExtractionMarkdown accepts italian headings and key:value bullet format', () => {
  const markdown = [
    '### Prodotto o servizio',
    '- Isolamento sottotetto in cellulosa',
    '- Target: Proprietari casa 40-75 Nord Italia',
    '- Obiettivo campagna: Leads',
    '- Contesto budget: 4.600 ticket medio',
    '- Offerta principale: Sopralluogo gratuito',
  ].join('\n');

  const parsed = parseMetaAdsExtractionMarkdown(markdown);

  assert.equal(parsed.product_or_service, 'Isolamento sottotetto in cellulosa');
  assert.equal(parsed.target_audience, 'Proprietari casa 40-75 Nord Italia');
  assert.equal(parsed.campaign_objective, 'Leads');
  assert.equal(parsed.budget_context, '4.600 ticket medio');
  assert.equal(parsed.primary_offer, 'Sopralluogo gratuito');
});

test('parseExtractionContent parses meta-ads markdown without strict ## heading structure', () => {
  const markdown = [
    '- **Product or Service**: Isolamento sottotetto',
    '- **Target Audience**: Proprietari Nord Italia',
    '- **Campaign Objective**: Leads',
  ].join('\n');

  const parsed = parseExtractionContent(markdown, 'meta_ads_generator');

  assert.equal(parsed.product_or_service, 'Isolamento sottotetto');
  assert.equal(parsed.target_audience, 'Proprietari Nord Italia');
  assert.equal(parsed.campaign_objective, 'Leads');
});

test('parseExtractionContent normalizes legacy aliases to canonical keys for supported tools', () => {
  const funnelJson = JSON.stringify({
    'Obiettivo del funnel': 'Lead',
    Target: 'Founder',
    Offerta: 'Audit',
    'Proof o testimonianze': 'Testimonial',
    'CTA principale': 'Prenota',
  });

  const nextlandJson = JSON.stringify({
    'Obiettivo del sito': 'Presentare brand',
    'Brand o azienda': 'Acme',
    Target: 'PMI',
    'Offerta o servizio': 'Consulenza',
    'Sezioni richieste': 'hero, proof, cta',
  });

  const angleJson = JSON.stringify({
    Obiettivo: 'Awareness',
    'Prodotto o servizio': 'Corso',
    Mercato: 'Italia',
    Target: 'Creator',
    'Pain point': 'Bassa retention',
    Proof: 'Case study',
    'Vincoli creativi': 'No claim aggressivi',
  });

  const parsedFunnel = parseExtractionContent(funnelJson, 'funnel-pages');
  assert.equal(parsedFunnel.funnel_goal, 'Lead');
  assert.equal(parsedFunnel.primary_cta, 'Prenota');

  const parsedNextland = parseExtractionContent(nextlandJson, 'nextland');
  assert.equal(parsedNextland.website_goal, 'Presentare brand');
  assert.equal(parsedNextland.required_sections, 'hero, proof, cta');

  const parsedAngle = parseExtractionContent(angleJson, 'angle-generator');
  assert.equal(parsedAngle.goal, 'Awareness');
  assert.equal(parsedAngle.creative_constraints, 'No claim aggressivi');

  const metaAdsJson = JSON.stringify({
    'Obiettivo campagna': 'Lead generation',
    'Contesto budget': 'Scaling phase',
    'Offerta principale': 'Audit call',
    'Meccanismo unico': 'Framework 3A',
  });

  const parsedMetaAds = parseExtractionContent(metaAdsJson, 'meta_ads_generator');
  assert.equal(parsedMetaAds.campaign_objective, 'Lead generation');
  assert.equal(parsedMetaAds.budget_context, 'Scaling phase');
  assert.equal(parsedMetaAds.primary_offer, 'Audit call');
  assert.equal(parsedMetaAds.unique_mechanism, 'Framework 3A');
});

test('normalizeExtractionFieldKeysForTool keeps payload unchanged for unknown tool keys', () => {
  const payload = {
    custom_field: 'value',
    Other: 'value-2',
  };

  assert.deepEqual(
    normalizeExtractionFieldKeysForTool('unknown-tool', payload),
    payload,
  );
});
