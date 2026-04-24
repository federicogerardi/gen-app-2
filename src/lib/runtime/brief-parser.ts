import path from 'node:path';
import mammoth from 'mammoth';

export type SupportedBriefFormat = 'txt' | 'md' | 'docx';

export type ParseBriefInput = {
  fileName: string;
  mimeType: string | null;
  content: Buffer;
};

export type ParseBriefOutput = {
  format: SupportedBriefFormat;
  normalizedText: string;
  charCount: number;
  wordCount: number;
};

export class BriefParseError extends Error {
  code: 'unsupported_format' | 'invalid_docx' | 'empty_content';

  constructor(code: BriefParseError['code'], message: string) {
    super(message);
    this.name = 'BriefParseError';
    this.code = code;
  }
}

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

const normalizeText = (value: string): string => {
  return value
    .replace(/\r\n/g, '\n')
    .replace(/\u0000/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

const countWords = (value: string): number => {
  const tokens = value.split(/\s+/).filter((token) => token.length > 0);
  return tokens.length;
};

const inferFormat = (fileName: string, mimeType: string | null): SupportedBriefFormat => {
  const extension = path.extname(fileName).toLowerCase();
  if (extension === '.txt') {
    return 'txt';
  }

  if (extension === '.md') {
    return 'md';
  }

  if (extension === '.docx') {
    return 'docx';
  }

  if (mimeType === DOCX_MIME) {
    return 'docx';
  }

  throw new BriefParseError('unsupported_format', 'Unsupported brief format. Use .docx, .txt or .md');
};

export const parseBriefInput = async (input: ParseBriefInput): Promise<ParseBriefOutput> => {
  const format = inferFormat(input.fileName, input.mimeType);

  let rawText = '';
  if (format === 'docx') {
    try {
      const extraction = await mammoth.extractRawText({ buffer: input.content });
      rawText = extraction.value;
    } catch {
      throw new BriefParseError('invalid_docx', 'Unable to parse .docx content');
    }
  } else {
    rawText = input.content.toString('utf8');
  }

  const normalizedText = normalizeText(rawText);
  if (!normalizedText) {
    throw new BriefParseError('empty_content', 'Brief content is empty after parsing');
  }

  return {
    format,
    normalizedText,
    charCount: normalizedText.length,
    wordCount: countWords(normalizedText),
  };
};
