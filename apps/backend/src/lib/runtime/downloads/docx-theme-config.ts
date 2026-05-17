import {
  DOCX_VISUAL_THEME_NONE,
  type DocxVisualTheme,
} from './docx-theme';

export type DocxThemePreset = 'none' | 'classic' | 'google-docs';

const GOOGLE_DOCS_FONT = 'Arial';

export const DOCX_VISUAL_THEME_CLASSIC: DocxVisualTheme = Object.freeze({
  paragraphByKind: Object.freeze({
    title: Object.freeze({
      spacing: { before: 0, after: 200, line: 520 },
    }),
    meta: Object.freeze({
      spacing: { before: 0, after: 120, line: 360 },
    }),
    'heading-1': Object.freeze({
      spacing: { before: 220, after: 100, line: 336 },
    }),
    'heading-2': Object.freeze({
      spacing: { before: 180, after: 90, line: 328 },
    }),
    'heading-3': Object.freeze({
      spacing: { before: 160, after: 80, line: 320 },
    }),
    paragraph: Object.freeze({
      spacing: { before: 0, after: 120, line: 384 },
    }),
    'unordered-list-item': Object.freeze({
      spacing: { before: 0, after: 80, line: 384 },
      indent: { left: 540, hanging: 260 },
    }),
    'ordered-list-item': Object.freeze({
      spacing: { before: 0, after: 80, line: 384 },
      indent: { left: 540, hanging: 260 },
    }),
    code: Object.freeze({
      spacing: { before: 80, after: 120, line: 320 },
      shading: { fill: 'E6EBF2' },
      border: {
        left: { color: '1D4ED8', size: 6, space: 1 },
      },
    }),
    blank: Object.freeze({
      spacing: { before: 0, after: 80, line: 220 },
    }),
  }),
  runByRole: Object.freeze({
    default: Object.freeze({
      font: 'Lato',
      size: 24,
      color: '0F172A',
    }),
    title: Object.freeze({
      font: 'Lato',
      size: 38,
      bold: true,
      color: '0F172A',
    }),
    meta: Object.freeze({
      font: 'Lato',
      size: 22,
      color: '475569',
    }),
    heading: Object.freeze({
      font: 'Lato',
      size: 32,
      bold: true,
      color: '0F172A',
    }),
    'list-prefix': Object.freeze({
      font: 'Lato',
      size: 24,
      color: '0F172A',
    }),
    code: Object.freeze({
      font: 'Lato',
      size: 24,
      color: '0F172A',
    }),
    bold: Object.freeze({
      font: 'Lato',
      size: 24,
      bold: true,
      color: '0F172A',
    }),
    italic: Object.freeze({
      font: 'Lato',
      size: 24,
      italics: true,
      color: '0F172A',
    }),
    'bold-italic': Object.freeze({
      font: 'Lato',
      size: 24,
      bold: true,
      italics: true,
      color: '0F172A',
    }),
    strike: Object.freeze({
      font: 'Lato',
      size: 24,
      strike: true,
      color: '0F172A',
    }),
  }),
});

export const DOCX_VISUAL_THEME_GOOGLE_DOCS: DocxVisualTheme = Object.freeze({
  paragraphByKind: Object.freeze({
    title: Object.freeze({
      spacing: { before: 0, after: 160, line: 440 },
    }),
    meta: Object.freeze({
      spacing: { before: 0, after: 100, line: 320 },
    }),
    'heading-1': Object.freeze({
      spacing: { before: 160, after: 80, line: 320 },
    }),
    'heading-2': Object.freeze({
      spacing: { before: 140, after: 70, line: 312 },
    }),
    'heading-3': Object.freeze({
      spacing: { before: 120, after: 60, line: 304 },
    }),
    paragraph: Object.freeze({
      spacing: { before: 0, after: 100, line: 320 },
    }),
    'unordered-list-item': Object.freeze({
      spacing: { before: 0, after: 70, line: 320 },
      indent: { left: 520, hanging: 240 },
    }),
    'ordered-list-item': Object.freeze({
      spacing: { before: 0, after: 70, line: 320 },
      indent: { left: 520, hanging: 240 },
    }),
    code: Object.freeze({
      spacing: { before: 70, after: 100, line: 300 },
    }),
    blank: Object.freeze({
      spacing: { before: 0, after: 60, line: 200 },
    }),
  }),
  runByRole: Object.freeze({
    default: Object.freeze({
      font: GOOGLE_DOCS_FONT,
      size: 24,
      color: '202124',
    }),
    title: Object.freeze({
      font: GOOGLE_DOCS_FONT,
      size: 34,
      bold: true,
      color: '202124',
    }),
    meta: Object.freeze({
      font: GOOGLE_DOCS_FONT,
      size: 20,
      color: '5F6368',
    }),
    heading: Object.freeze({
      font: GOOGLE_DOCS_FONT,
      size: 30,
      bold: true,
      color: '202124',
    }),
    'list-prefix': Object.freeze({
      font: GOOGLE_DOCS_FONT,
      size: 24,
      color: '202124',
    }),
    code: Object.freeze({
      font: GOOGLE_DOCS_FONT,
      size: 22,
      color: '202124',
    }),
    bold: Object.freeze({
      font: GOOGLE_DOCS_FONT,
      size: 24,
      bold: true,
      color: '202124',
    }),
    italic: Object.freeze({
      font: GOOGLE_DOCS_FONT,
      size: 24,
      italics: true,
      color: '202124',
    }),
    'bold-italic': Object.freeze({
      font: GOOGLE_DOCS_FONT,
      size: 24,
      bold: true,
      italics: true,
      color: '202124',
    }),
    strike: Object.freeze({
      font: GOOGLE_DOCS_FONT,
      size: 24,
      strike: true,
      color: '202124',
    }),
  }),
});

export const parseDocxThemePresetFromEnv = (
  env: NodeJS.ProcessEnv = process.env,
): DocxThemePreset => {
  const raw = (env.DOCX_DEFAULT_THEME ?? 'none').trim().toLowerCase();
  if (raw === 'classic') {
    return 'classic';
  }
  if (raw === 'google-docs' || raw === 'google_docs' || raw === 'gdocs') {
    return 'google-docs';
  }
  return 'none';
};

export const docxThemeFromPreset = (preset: DocxThemePreset): DocxVisualTheme => {
  if (preset === 'classic') {
    return DOCX_VISUAL_THEME_CLASSIC;
  }
  if (preset === 'google-docs') {
    return DOCX_VISUAL_THEME_GOOGLE_DOCS;
  }
  return DOCX_VISUAL_THEME_NONE;
};

export const getDefaultDocxVisualTheme = (
  env: NodeJS.ProcessEnv = process.env,
): DocxVisualTheme => docxThemeFromPreset(parseDocxThemePresetFromEnv(env));
