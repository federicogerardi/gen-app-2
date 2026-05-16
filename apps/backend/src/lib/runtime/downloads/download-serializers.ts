/**
 * Serializers for artifact and session download content.
 *
 * Supports md, txt, and docx formats.
 * DOCX generation uses the `docx` npm package (added as explicit dependency).
 */

import type { SessionArtifactEntry } from '../../adapters/session-query.adapter';
import type { DownloadFormat } from './download-format';
import {
  DOCX_VISUAL_THEME_NONE,
  mergeDocxVisualTheme,
  type DocxParagraphKind,
  type DocxRunRole,
  type DocxVisualTheme,
} from './docx-theme';
import { getDefaultDocxVisualTheme } from './docx-theme-config';

// ── Minimal docx interface for type safety without requiring installed package ──

interface DocxParagraph {
  // opaque
}
interface DocxDocument {
  // opaque
}
interface DocxPacker {
  toBuffer(doc: DocxDocument): Promise<Buffer>;
}
type HeadingLevelMap = Record<string, unknown>;
interface DocxModule {
  Document: new (opts: { sections: [{ children: DocxParagraph[] }] }) => DocxDocument;
  Paragraph: new (opts: { text?: string; children?: unknown[]; heading?: unknown }) => DocxParagraph;
  TextRun: new (opts: string | { text: string; bold?: boolean; italics?: boolean; strike?: boolean }) => unknown;
  HeadingLevel: HeadingLevelMap;
  Packer: DocxPacker;
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const loadDocx = (): DocxModule => require('docx') as DocxModule;

type MarkdownDocxBlock =
  | { kind: 'heading'; level: 1 | 2 | 3; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'unordered-list-item'; text: string }
  | { kind: 'ordered-list-item'; index: number; text: string }
  | { kind: 'code'; text: string }
  | { kind: 'blank' };

const normalizeLine = (line: string): string => line.replace(/\r/g, '');

type InlineMarkdownRun = {
  text: string;
  bold?: boolean;
  italics?: boolean;
  strike?: boolean;
};

const INLINE_MARKDOWN_TOKEN = /(\*\*\*[^*\n]+\*\*\*|___[^_\n]+___|\*\*[^*\n]+\*\*|__[^_\n]+__|\*[^*\n]+\*|_[^_\n]+_|~~[^~\n]+~~)/g;

export const parseInlineMarkdownRuns = (input: string): InlineMarkdownRun[] => {
  if (input.length === 0) {
    return [{ text: '' }];
  }

  const runs: InlineMarkdownRun[] = [];
  let cursor = 0;

  for (const match of input.matchAll(INLINE_MARKDOWN_TOKEN)) {
    if (match.index === undefined) {
      continue;
    }

    const token = match[0];
    const start = match.index;
    const end = start + token.length;

    if (start > cursor) {
      runs.push({ text: input.slice(cursor, start) });
    }

    if ((token.startsWith('***') && token.endsWith('***')) || (token.startsWith('___') && token.endsWith('___'))) {
      runs.push({ text: token.slice(3, -3), bold: true, italics: true });
    } else if ((token.startsWith('**') && token.endsWith('**')) || (token.startsWith('__') && token.endsWith('__'))) {
      runs.push({ text: token.slice(2, -2), bold: true });
    } else if ((token.startsWith('*') && token.endsWith('*')) || (token.startsWith('_') && token.endsWith('_'))) {
      runs.push({ text: token.slice(1, -1), italics: true });
    } else if (token.startsWith('~~') && token.endsWith('~~')) {
      runs.push({ text: token.slice(2, -2), strike: true });
    } else {
      runs.push({ text: token });
    }

    cursor = end;
  }

  if (cursor < input.length) {
    runs.push({ text: input.slice(cursor) });
  }

  return runs.filter((run) => run.text.length > 0);
};

const resolveParagraphTheme = (
  kind: DocxParagraphKind,
  theme: DocxVisualTheme,
): Record<string, unknown> => ({
  ...(theme.paragraphByKind?.[kind] ?? {}),
});

const resolveRunTheme = (
  role: DocxRunRole,
  theme: DocxVisualTheme,
): Record<string, unknown> => ({
  ...(theme.runByRole?.[role] ?? {}),
});

export const parseMarkdownToDocxBlocks = (input: string): MarkdownDocxBlock[] => {
  const lines = input.split('\n').map(normalizeLine);
  const blocks: MarkdownDocxBlock[] = [];
  let inCodeFence = false;

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();

    if (/^```/.test(trimmed)) {
      inCodeFence = !inCodeFence;
      continue;
    }

    if (inCodeFence) {
      blocks.push(trimmed.length === 0 ? { kind: 'blank' } : { kind: 'code', text: line });
      continue;
    }

    if (trimmed.length === 0) {
      blocks.push({ kind: 'blank' });
      continue;
    }

    const heading = trimmed.match(/^(#{1,3})\s+(.*)$/);
    if (heading) {
      const level = heading[1].length as 1 | 2 | 3;
      const text = heading[2].trim();
      blocks.push({ kind: 'heading', level, text });
      continue;
    }

    const bullet = trimmed.match(/^[-*+]\s+(.*)$/);
    if (bullet) {
      blocks.push({ kind: 'unordered-list-item', text: bullet[1].trim() });
      continue;
    }

    const ordered = trimmed.match(/^(\d+)\.\s+(.*)$/);
    if (ordered) {
      blocks.push({ kind: 'ordered-list-item', index: Number(ordered[1]), text: ordered[2].trim() });
      continue;
    }

    blocks.push({ kind: 'paragraph', text: line });
  }

  return blocks;
};

const toDocxTextRuns = (
  text: string,
  docx: DocxModule,
  theme: DocxVisualTheme,
  parseInline = true,
  forcedRole?: DocxRunRole,
): unknown[] => {
  const { TextRun } = docx;
  const inlineRuns = parseInline ? parseInlineMarkdownRuns(text) : [{ text }];

  return inlineRuns.map((run) => new TextRun({
    text: run.text,
    ...(run.bold ? { bold: true } : {}),
    ...(run.italics ? { italics: true } : {}),
    ...(run.strike ? { strike: true } : {}),
    ...resolveRunTheme(
      forcedRole
      ?? (run.bold && run.italics
        ? 'bold-italic'
        : run.bold
          ? 'bold'
          : run.italics
            ? 'italic'
            : run.strike
              ? 'strike'
              : 'default'),
      theme,
    ),
  }));
};

const toDocxParagraphs = (content: string, docx: DocxModule, theme: DocxVisualTheme): DocxParagraph[] => {
  const { Paragraph, HeadingLevel } = docx;
  const blocks = parseMarkdownToDocxBlocks(content);

  return blocks.map((block) => {
    if (block.kind === 'heading') {
      const headingLevel =
        block.level === 1
          ? HeadingLevel['HEADING_1']
          : block.level === 2
            ? HeadingLevel['HEADING_2']
            : HeadingLevel['HEADING_3'];
      return new Paragraph({
        heading: headingLevel,
        children: toDocxTextRuns(block.text, docx, theme, true, 'heading'),
        ...resolveParagraphTheme(
          block.level === 1 ? 'heading-1' : block.level === 2 ? 'heading-2' : 'heading-3',
          theme,
        ),
      });
    }

    if (block.kind === 'unordered-list-item') {
      return new Paragraph({
        children: [
          ...toDocxTextRuns('• ', docx, theme, false, 'list-prefix'),
          ...toDocxTextRuns(block.text, docx, theme),
        ],
        ...resolveParagraphTheme('unordered-list-item', theme),
      });
    }

    if (block.kind === 'ordered-list-item') {
      return new Paragraph({
        children: [
          ...toDocxTextRuns(`${block.index}. `, docx, theme, false, 'list-prefix'),
          ...toDocxTextRuns(block.text, docx, theme),
        ],
        ...resolveParagraphTheme('ordered-list-item', theme),
      });
    }

    if (block.kind === 'code') {
      return new Paragraph({
        children: toDocxTextRuns(block.text, docx, theme, false, 'code'),
        ...resolveParagraphTheme('code', theme),
      });
    }

    if (block.kind === 'paragraph') {
      return new Paragraph({
        children: toDocxTextRuns(block.text, docx, theme),
        ...resolveParagraphTheme('paragraph', theme),
      });
    }

    return new Paragraph({ text: '', ...resolveParagraphTheme('blank', theme) });
  });
};

// ── Markdown helpers ──────────────────────────────────────────────────────────

const toMarkdownDocument = (title: string, content: string): string =>
  `# ${title}\n\n${content}\n`;

const toMarkdownSessionDocument = (
  sessionId: string,
  toolKey: string | null,
  steps: SessionArtifactEntry[],
): string => {
  const header = `# Session: ${sessionId}\n\nTool: ${toolKey ?? 'unknown'}\n\n---\n\n`;
  const sections = steps
    .map((step) => {
      const stepLabel = step.stepKey ?? 'unknown-step';
      return `## Step: ${stepLabel}\n\n${step.content}\n`;
    })
    .join('\n---\n\n');
  return header + sections;
};

// ── Plain text helpers ─────────────────────────────────────────────────────────

const toPlainTextDocument = (title: string, content: string): string =>
  `${title.toUpperCase()}\n${'='.repeat(title.length)}\n\n${content}\n`;

const toPlainTextSessionDocument = (
  sessionId: string,
  toolKey: string | null,
  steps: SessionArtifactEntry[],
): string => {
  const header = `SESSION: ${sessionId}\nTOOL: ${toolKey ?? 'unknown'}\n\n${'='.repeat(60)}\n\n`;
  const sections = steps
    .map((step) => {
      const stepLabel = (step.stepKey ?? 'unknown-step').toUpperCase();
      return `=== STEP: ${stepLabel} ===\n\n${step.content}\n`;
    })
    .join('\n' + '-'.repeat(60) + '\n\n');
  return header + sections;
};

// ── DOCX helpers ──────────────────────────────────────────────────────────────

const toDocxBuffer = async (
  title: string,
  content: string,
  visualTheme?: DocxVisualTheme,
): Promise<Buffer> => {
  const docx = loadDocx();
  const { Document, Paragraph, HeadingLevel, Packer } = docx;
  const resolvedTheme = mergeDocxVisualTheme(DOCX_VISUAL_THEME_NONE, visualTheme);
  const children: DocxParagraph[] = [
    new Paragraph({
      heading: HeadingLevel['HEADING_1'],
      children: toDocxTextRuns(title, docx, resolvedTheme, false, 'title'),
      ...resolveParagraphTheme('title', resolvedTheme),
    }),
    ...toDocxParagraphs(content, docx, resolvedTheme),
  ];
  const doc = new Document({ sections: [{ children }] });
  return Packer.toBuffer(doc);
};

const toDocxSessionBuffer = async (
  sessionId: string,
  toolKey: string | null,
  steps: SessionArtifactEntry[],
  visualTheme?: DocxVisualTheme,
): Promise<Buffer> => {
  const docx = loadDocx();
  const { Document, Paragraph, HeadingLevel, Packer } = docx;
  const resolvedTheme = mergeDocxVisualTheme(DOCX_VISUAL_THEME_NONE, visualTheme);

  const children: DocxParagraph[] = [
    new Paragraph({
      heading: HeadingLevel['HEADING_1'],
      children: toDocxTextRuns(`Session: ${sessionId}`, docx, resolvedTheme, false, 'title'),
      ...resolveParagraphTheme('title', resolvedTheme),
    }),
    new Paragraph({
      children: toDocxTextRuns(`Tool: ${toolKey ?? 'unknown'}`, docx, resolvedTheme, false, 'meta'),
      ...resolveParagraphTheme('meta', resolvedTheme),
    }),
    new Paragraph({ ...resolveParagraphTheme('blank', resolvedTheme) }),
  ];

  for (const step of steps) {
    const stepLabel = step.stepKey ?? 'unknown-step';
    children.push(new Paragraph({
      heading: HeadingLevel['HEADING_2'],
      children: toDocxTextRuns(`Step: ${stepLabel}`, docx, resolvedTheme, false, 'heading'),
      ...resolveParagraphTheme('heading-2', resolvedTheme),
    }));
    children.push(...toDocxParagraphs(step.content, docx, resolvedTheme));
    children.push(new Paragraph({ ...resolveParagraphTheme('blank', resolvedTheme) }));
  }

  const doc = new Document({ sections: [{ children }] });
  return Packer.toBuffer(doc);
};

// ── Public serializer API ─────────────────────────────────────────────────────

export const serializeArtifactDownload = async (
  artifactId: string,
  content: string,
  format: DownloadFormat,
  options?: { docxTheme?: DocxVisualTheme },
): Promise<Buffer> => {
  if (format === 'md') {
    return Buffer.from(toMarkdownDocument(artifactId, content), 'utf-8');
  }
  if (format === 'txt') {
    return Buffer.from(toPlainTextDocument(artifactId, content), 'utf-8');
  }
  return toDocxBuffer(
    artifactId,
    content,
    options?.docxTheme ?? getDefaultDocxVisualTheme(),
  );
};

export const serializeSessionDownload = async (
  sessionId: string,
  toolKey: string | null,
  steps: SessionArtifactEntry[],
  format: DownloadFormat,
  options?: { docxTheme?: DocxVisualTheme },
): Promise<Buffer> => {
  if (format === 'md') {
    return Buffer.from(toMarkdownSessionDocument(sessionId, toolKey, steps), 'utf-8');
  }
  if (format === 'txt') {
    return Buffer.from(toPlainTextSessionDocument(sessionId, toolKey, steps), 'utf-8');
  }
  return toDocxSessionBuffer(
    sessionId,
    toolKey,
    steps,
    options?.docxTheme ?? getDefaultDocxVisualTheme(),
  );
};
