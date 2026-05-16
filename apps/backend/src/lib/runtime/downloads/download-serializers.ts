/**
 * Serializers for artifact and session download content.
 *
 * Supports md, txt, and docx formats.
 * DOCX generation uses the `docx` npm package (added as explicit dependency).
 */

import type { SessionArtifactEntry } from '../../adapters/session-query.adapter';
import type { DownloadFormat } from './download-format';

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
  TextRun: new (text: string) => unknown;
  HeadingLevel: HeadingLevelMap;
  Packer: DocxPacker;
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const loadDocx = (): DocxModule => require('docx') as DocxModule;

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

const toDocxBuffer = async (title: string, content: string): Promise<Buffer> => {
  const { Document, Paragraph, TextRun, HeadingLevel, Packer } = loadDocx();
  const lines = content.split('\n');
  const children: DocxParagraph[] = [
    new Paragraph({ text: title, heading: HeadingLevel['HEADING_1'] }),
    ...lines.map((line) => new Paragraph({ children: [new TextRun(line)] })),
  ];
  const doc = new Document({ sections: [{ children }] });
  return Packer.toBuffer(doc);
};

const toDocxSessionBuffer = async (
  sessionId: string,
  toolKey: string | null,
  steps: SessionArtifactEntry[],
): Promise<Buffer> => {
  const { Document, Paragraph, TextRun, HeadingLevel, Packer } = loadDocx();

  const children: DocxParagraph[] = [
    new Paragraph({ text: `Session: ${sessionId}`, heading: HeadingLevel['HEADING_1'] }),
    new Paragraph({ children: [new TextRun(`Tool: ${toolKey ?? 'unknown'}`)] }),
    new Paragraph({}),
  ];

  for (const step of steps) {
    const stepLabel = step.stepKey ?? 'unknown-step';
    children.push(new Paragraph({ text: `Step: ${stepLabel}`, heading: HeadingLevel['HEADING_2'] }));
    const lines = step.content.split('\n');
    for (const line of lines) {
      children.push(new Paragraph({ children: [new TextRun(line)] }));
    }
    children.push(new Paragraph({}));
  }

  const doc = new Document({ sections: [{ children }] });
  return Packer.toBuffer(doc);
};

// ── Public serializer API ─────────────────────────────────────────────────────

export const serializeArtifactDownload = async (
  artifactId: string,
  content: string,
  format: DownloadFormat,
): Promise<Buffer> => {
  if (format === 'md') {
    return Buffer.from(toMarkdownDocument(artifactId, content), 'utf-8');
  }
  if (format === 'txt') {
    return Buffer.from(toPlainTextDocument(artifactId, content), 'utf-8');
  }
  return toDocxBuffer(artifactId, content);
};

export const serializeSessionDownload = async (
  sessionId: string,
  toolKey: string | null,
  steps: SessionArtifactEntry[],
  format: DownloadFormat,
): Promise<Buffer> => {
  if (format === 'md') {
    return Buffer.from(toMarkdownSessionDocument(sessionId, toolKey, steps), 'utf-8');
  }
  if (format === 'txt') {
    return Buffer.from(toPlainTextSessionDocument(sessionId, toolKey, steps), 'utf-8');
  }
  return toDocxSessionBuffer(sessionId, toolKey, steps);
};
