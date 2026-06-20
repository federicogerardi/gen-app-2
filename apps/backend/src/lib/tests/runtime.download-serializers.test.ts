import test from 'node:test';
import assert from 'node:assert/strict';
import mammoth from 'mammoth';

import {
  parseInlineMarkdownRuns,
  parseMarkdownToDocxBlocks,
  serializeArtifactDownload,
  serializeSessionDownload,
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
  const classicParagraphSpacing = classicTheme.paragraphByKind?.paragraph?.spacing as { line?: number } | undefined;
  const classicHeading1Spacing = classicTheme.paragraphByKind?.['heading-1']?.spacing as { before?: number } | undefined;
  const googleDocsParagraphSpacing = googleDocsTheme.paragraphByKind?.paragraph?.spacing as { line?: number } | undefined;

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
  assert.equal(classicParagraphSpacing?.line, 384);
  assert.ok((classicHeading1Spacing?.before ?? 0) < 360);
  assert.equal(googleDocsTheme.runByRole?.default?.font, 'Arial');
  assert.equal(googleDocsTheme.runByRole?.default?.size, 24);
  assert.equal(googleDocsTheme.runByRole?.heading?.size, 30);
  assert.equal(googleDocsParagraphSpacing?.line, 320);
});

// ── Phase 4: serializeSessionDownload with excludeSteps ──────────────────────

const buildMockSessionArtifacts = (): import('../adapters/session-query.adapter').SessionArtifactEntry[] => [
  { artifactId: 'a-1', requestId: 'r-1', projectId: 'p-1', stepKey: 'optin', artifactRole: 'step', runMode: 'new', status: 'completed', content: '# Optin\n\nOptin content', updatedAt: '2026-05-09T10:00:00.000Z', failureReason: null, workflowType: 'funnel_pages', toolKey: 'funnel-pages' },
  { artifactId: 'a-2', requestId: 'r-2', projectId: 'p-1', stepKey: 'quiz', artifactRole: 'step', runMode: 'new', status: 'completed', content: '# Quiz\n\nQuiz content', updatedAt: '2026-05-09T10:01:00.000Z', failureReason: null, workflowType: 'funnel_pages', toolKey: 'funnel-pages' },
  { artifactId: 'a-3', requestId: 'r-3', projectId: 'p-1', stepKey: 'vsl', artifactRole: 'final', runMode: 'new', status: 'completed', content: '# VSL\n\nVSL content', updatedAt: '2026-05-09T10:02:00.000Z', failureReason: null, workflowType: 'funnel_pages', toolKey: 'funnel-pages' },
];

test('serializeSessionDownload md includes all steps when excludeSteps is absent', async () => {
  const steps = buildMockSessionArtifacts();
  const buffer = await serializeSessionDownload('sess-1', 'funnel-pages', steps, 'md');
  const text = buffer.toString('utf-8');

  assert.match(text, /Optin content/);
  assert.match(text, /Quiz content/);
  assert.match(text, /VSL content/);
});

test('serializeSessionDownload md excludes specified steps when excludeSteps is provided', async () => {
  const steps = buildMockSessionArtifacts();
  const buffer = await serializeSessionDownload('sess-1', 'funnel-pages', steps, 'md', {
    excludeSteps: ['quiz'],
  });
  const text = buffer.toString('utf-8');

  assert.match(text, /Optin content/);
  assert.equal(text.includes('Quiz content'), false);
  assert.match(text, /VSL content/);
});

test('serializeSessionDownload md excludes multiple steps when excludeSteps has multiple entries', async () => {
  const steps = buildMockSessionArtifacts();
  const buffer = await serializeSessionDownload('sess-1', 'funnel-pages', steps, 'md', {
    excludeSteps: ['optin', 'vsl'],
  });
  const text = buffer.toString('utf-8');

  assert.equal(text.includes('Optin content'), false);
  assert.match(text, /Quiz content/);
  assert.equal(text.includes('VSL content'), false);
});

test('serializeSessionDownload txt excludes specified steps', async () => {
  const steps = buildMockSessionArtifacts();
  const buffer = await serializeSessionDownload('sess-1', 'funnel-pages', steps, 'txt', {
    excludeSteps: ['quiz'],
  });
  const text = buffer.toString('utf-8');

  assert.match(text, /Optin content/);
  assert.equal(text.includes('Quiz content'), false);
  assert.match(text, /VSL content/);
});

test('serializeSessionDownload docx excludes specified steps', async () => {
  const steps = buildMockSessionArtifacts();
  const buffer = await serializeSessionDownload('sess-1', 'funnel-pages', steps, 'docx', {
    excludeSteps: ['quiz'],
  });
  const raw = await mammoth.extractRawText({ buffer });

  assert.match(raw.value, /Optin content/i);
  assert.equal(raw.value.toLowerCase().includes('quiz content'), false);
  assert.match(raw.value, /VSL content/i);
});

test('serializeSessionDownload with empty excludeSteps includes all steps (backward compatibility)', async () => {
  const steps = buildMockSessionArtifacts();
  const buffer = await serializeSessionDownload('sess-1', 'funnel-pages', steps, 'md', {
    excludeSteps: [],
  });
  const text = buffer.toString('utf-8');

  assert.match(text, /Optin content/);
  assert.match(text, /Quiz content/);
  assert.match(text, /VSL content/);
});

test('serializeSessionDownload without excludeSteps option includes all steps (backward compatibility)', async () => {
  const steps = buildMockSessionArtifacts();
  const buffer = await serializeSessionDownload('sess-1', 'funnel-pages', steps, 'md');
  const text = buffer.toString('utf-8');

  assert.match(text, /Optin content/);
  assert.match(text, /Quiz content/);
  assert.match(text, /VSL content/);
});

// ── Table rendering in DOCX ──────────────────────────────────────────────────

test('parseMarkdownToDocxBlocks parses a markdown table into a table block', () => {
  const markdown = [
    '# Report',
    '',
    '| Metric | Value |',
    '|--------|-------|',
    '| Revenue | €10k |',
    '| Cost | €3k |',
    '',
    'Fine report',
  ].join('\n');

  const blocks = parseMarkdownToDocxBlocks(markdown);

  assert.deepEqual(blocks, [
    { kind: 'heading', level: 1, text: 'Report' },
    { kind: 'blank' },
    { kind: 'table', headerRow: ['Metric', 'Value'], rows: [['Revenue', '€10k'], ['Cost', '€3k']] },
    { kind: 'blank' },
    { kind: 'paragraph', text: 'Fine report' },
  ]);
});

test('parseMarkdownToDocxBlocks handles table with empty cells', () => {
  const markdown = [
    '| A | B | C |',
    '|---|---|---|',
    '| 1 |   | 3 |',
  ].join('\n');

  const blocks = parseMarkdownToDocxBlocks(markdown);

  assert.equal(blocks.length, 1);
  const tableBlock = blocks[0];
  assert.ok(tableBlock);
  assert.equal(tableBlock.kind, 'table');
  if (tableBlock.kind === 'table') {
    assert.deepEqual(tableBlock.headerRow, ['A', 'B', 'C']);
    assert.equal(tableBlock.rows.length, 1);
  }
});

test('serializeArtifactDownload docx renders tables with borders', async () => {
  const content = [
    '| Colonna 1 | Colonna 2 |',
    '|-----------|-----------|',
    '| Dato A    | Dato B    |',
    '| Dato C    | Dato D    |',
  ].join('\n');

  const buffer = await serializeArtifactDownload('artifact-table', content, 'docx');
  const html = await mammoth.convertToHtml({ buffer });

  assert.match(html.value, /Colonna 1/i);
  assert.match(html.value, /Colonna 2/i);
  assert.match(html.value, /Dato A/i);
  assert.match(html.value, /Dato B/i);
  assert.match(html.value, /Dato C/i);
  assert.match(html.value, /Dato D/i);
  assert.match(html.value, /<table/i);
});

test('serializeSessionDownload docx renders tables within step content', async () => {
  const steps = [
    { artifactId: 'a-1', requestId: 'r-1', projectId: 'p-1', stepKey: 'analysis', artifactRole: 'step' as const, runMode: 'new' as const, status: 'completed' as const, content: '# Analisi\n\n| Metrica | Valore |\n|---------|--------|\n| CTR | 3.2% |\n| CPC | €0.50 |', updatedAt: '2026-05-09T10:00:00.000Z', failureReason: null, workflowType: 'funnel_pages', toolKey: 'funnel-pages' },
  ];

  const buffer = await serializeSessionDownload('sess-1', 'funnel-pages', steps, 'docx');
  const html = await mammoth.convertToHtml({ buffer });

  assert.match(html.value, /<table/i);
  assert.match(html.value, /Metrica/i);
  assert.match(html.value, /Valore/i);
  assert.match(html.value, /CTR/i);
  assert.match(html.value, /3\.2%/i);
});
