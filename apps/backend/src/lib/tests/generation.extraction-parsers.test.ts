import test from 'node:test';
import assert from 'node:assert/strict';

import { parseExtractionContent, parseYoutubeExtractionMarkdown } from '../machines/generation/extraction-parsers';

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

  const fromInvalid = parseExtractionContent('not-json', 'funnel-pages');
  assert.deepEqual(fromInvalid, {});
});
