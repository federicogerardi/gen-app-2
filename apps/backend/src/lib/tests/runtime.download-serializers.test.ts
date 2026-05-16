import test from 'node:test';
import assert from 'node:assert/strict';
import mammoth from 'mammoth';

import {
  parseInlineMarkdownRuns,
  parseMarkdownToDocxBlocks,
  serializeArtifactDownload,
} from '../runtime/downloads/download-serializers';
import type { DocxVisualTheme } from '../runtime/downloads/docx-theme';
import {
  docxThemeFromPreset,
  parseDocxThemePresetFromEnv,
} from '../runtime/downloads/docx-theme-config';

test('parseMarkdownToDocxBlocks maps headings, lists, and code fences to docx blocks', () => {
  const markdown = [
    '# Titolo',
    '## Sezione',
    'Paragrafo di testo',
    '- voce elenco',
    '1. voce ordinata',
    '```ts',
    'const x = 1;',
    '```',
  ].join('\n');

  const blocks = parseMarkdownToDocxBlocks(markdown);

  assert.deepEqual(blocks, [
    { kind: 'heading', level: 1, text: 'Titolo' },
    { kind: 'heading', level: 2, text: 'Sezione' },
    { kind: 'paragraph', text: 'Paragrafo di testo' },
    { kind: 'unordered-list-item', text: 'voce elenco' },
    { kind: 'ordered-list-item', index: 1, text: 'voce ordinata' },
    { kind: 'code', text: 'const x = 1;' },
  ]);
});

test('serializeArtifactDownload docx strips markdown heading markers from content text', async () => {
  const content = ['## Heading Due', 'Testo paragrafo'].join('\n\n');

  const buffer = await serializeArtifactDownload('artifact-123', content, 'docx');
  const extracted = await mammoth.extractRawText({ buffer });

  assert.match(extracted.value, /artifact-123/i);
  assert.match(extracted.value, /Heading Due/);
  assert.match(extracted.value, /Testo paragrafo/);
  assert.equal(extracted.value.includes('## Heading Due'), false);
});

test('parseInlineMarkdownRuns preserves semantic inline markdown runs', () => {
  const input = 'Intro **grassetto** e *corsivo* finale';
  const runs = parseInlineMarkdownRuns(input);

  assert.deepEqual(runs, [
    { text: 'Intro ' },
    { text: 'grassetto', bold: true },
    { text: ' e ' },
    { text: 'corsivo', italics: true },
    { text: ' finale' },
  ]);
});

test('serializeArtifactDownload docx preserves semantic markdown and avoids visual-client style directives', async () => {
  const content = 'Testo con **grassetto**, *corsivo* e emoji 😀';

  const buffer = await serializeArtifactDownload('artifact-inline-emoji', content, 'docx');
  const html = await mammoth.convertToHtml({ buffer });
  const raw = await mammoth.extractRawText({ buffer });

  assert.match(html.value, /<strong>grassetto<\/strong>/i);
  assert.match(html.value, /<em>corsivo<\/em>/i);
  assert.equal(html.value.toLowerCase().includes('font-family'), false);
  assert.equal(html.value.toLowerCase().includes('font-size'), false);
  assert.equal(html.value.toLowerCase().includes('style='), false);
  assert.match(raw.value, /grassetto/);
  assert.match(raw.value, /corsivo/);
  assert.match(raw.value, /😀/);
});

test('serializeArtifactDownload applies optional visual theme without changing parser behavior', async () => {
  const theme: DocxVisualTheme = {
    runByRole: {
      heading: { font: 'Calibri' },
      title: { font: 'Calibri' },
    },
  };

  const content = '## Sezione\n\nTesto con **enfasi**';
  const buffer = await serializeArtifactDownload('artifact-theme', content, 'docx', { docxTheme: theme });
  const raw = await mammoth.extractRawText({ buffer });

  assert.match(raw.value, /artifact-theme/i);
  assert.match(raw.value, /Sezione/);
  assert.match(raw.value, /Testo con enfasi/);
  assert.equal(raw.value.includes('## Sezione'), false);
});

test('parseDocxThemePresetFromEnv returns classic only for supported value', () => {
  assert.equal(parseDocxThemePresetFromEnv({ DOCX_DEFAULT_THEME: 'classic' }), 'classic');
  assert.equal(parseDocxThemePresetFromEnv({ DOCX_DEFAULT_THEME: 'CLASSIC' }), 'classic');
  assert.equal(parseDocxThemePresetFromEnv({ DOCX_DEFAULT_THEME: 'google-docs' }), 'google-docs');
  assert.equal(parseDocxThemePresetFromEnv({ DOCX_DEFAULT_THEME: 'google_docs' }), 'google-docs');
  assert.equal(parseDocxThemePresetFromEnv({ DOCX_DEFAULT_THEME: 'gdocs' }), 'google-docs');
  assert.equal(parseDocxThemePresetFromEnv({ DOCX_DEFAULT_THEME: 'unsupported' }), 'none');
  assert.equal(parseDocxThemePresetFromEnv({}), 'none');
});

test('docxThemeFromPreset returns a deterministic theme object', () => {
  const noneTheme = docxThemeFromPreset('none');
  const classicTheme = docxThemeFromPreset('classic');
  const googleDocsTheme = docxThemeFromPreset('google-docs');

  assert.equal(typeof noneTheme, 'object');
  assert.equal(typeof classicTheme, 'object');
  assert.equal(typeof googleDocsTheme, 'object');
  assert.notEqual(classicTheme, noneTheme);
  assert.notEqual(googleDocsTheme, noneTheme);
  assert.equal(classicTheme.runByRole?.default?.font, 'Lato');
  assert.equal(classicTheme.runByRole?.heading?.font, 'Lato');
  assert.equal(classicTheme.runByRole?.code?.font, 'Lato');
  assert.equal(classicTheme.runByRole?.default?.size, 24);
  assert.equal(classicTheme.runByRole?.heading?.size, 32);
  assert.equal(classicTheme.paragraphByKind?.paragraph?.spacing?.line, 384);
  assert.ok((classicTheme.paragraphByKind?.['heading-1']?.spacing?.before ?? 0) < 360);
  assert.equal(googleDocsTheme.runByRole?.default?.font, 'Arial');
  assert.equal(googleDocsTheme.runByRole?.default?.size, 24);
  assert.equal(googleDocsTheme.runByRole?.heading?.size, 30);
  assert.equal(googleDocsTheme.paragraphByKind?.paragraph?.spacing?.line, 320);
});
