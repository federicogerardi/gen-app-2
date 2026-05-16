import {
  DOCX_VISUAL_THEME_NONE,
  type DocxVisualTheme,
} from './docx-theme';

export type DocxThemePreset = 'none' | 'classic';

export const DOCX_VISUAL_THEME_CLASSIC: DocxVisualTheme = Object.freeze({
  paragraphByKind: Object.freeze({
    title: Object.freeze({
      spacing: { before: 0, after: 240, line: 576 },
    }),
    meta: Object.freeze({
      spacing: { before: 0, after: 160, line: 408 },
    }),
    'heading-1': Object.freeze({
      spacing: { before: 360, after: 120, line: 360 },
    }),
    'heading-2': Object.freeze({
      spacing: { before: 300, after: 100, line: 340 },
    }),
    'heading-3': Object.freeze({
      spacing: { before: 260, after: 100, line: 320 },
    }),
    paragraph: Object.freeze({
      spacing: { before: 0, after: 160, line: 408 },
    }),
    'unordered-list-item': Object.freeze({
      spacing: { before: 0, after: 100, line: 408 },
      indent: { left: 540, hanging: 260 },
    }),
    'ordered-list-item': Object.freeze({
      spacing: { before: 0, after: 100, line: 408 },
      indent: { left: 540, hanging: 260 },
    }),
    code: Object.freeze({
      spacing: { before: 100, after: 160, line: 340 },
      shading: { fill: 'E6EBF2' },
      border: {
        left: { color: '1D4ED8', size: 6, space: 1 },
      },
    }),
    blank: Object.freeze({
      spacing: { before: 0, after: 100, line: 240 },
    }),
  }),
  runByRole: Object.freeze({
    default: Object.freeze({
      font: 'Source Sans 3',
      size: 30,
      color: '0F172A',
    }),
    title: Object.freeze({
      font: 'IBM Plex Sans',
      size: 48,
      bold: true,
      color: '0F172A',
    }),
    meta: Object.freeze({
      font: 'Source Sans 3',
      size: 26,
      color: '475569',
    }),
    heading: Object.freeze({
      font: 'IBM Plex Sans',
      size: 40,
      bold: true,
      color: '0F172A',
    }),
    'list-prefix': Object.freeze({
      font: 'Source Sans 3',
      size: 30,
      color: '0F172A',
    }),
    code: Object.freeze({
      font: 'JetBrains Mono',
      size: 26,
      color: '0F172A',
    }),
    bold: Object.freeze({
      font: 'Source Sans 3',
      size: 30,
      bold: true,
      color: '0F172A',
    }),
    italic: Object.freeze({
      font: 'Source Sans 3',
      size: 30,
      italics: true,
      color: '0F172A',
    }),
    'bold-italic': Object.freeze({
      font: 'Source Sans 3',
      size: 30,
      bold: true,
      italics: true,
      color: '0F172A',
    }),
    strike: Object.freeze({
      font: 'Source Sans 3',
      size: 30,
      strike: true,
      color: '0F172A',
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
  return 'none';
};

export const docxThemeFromPreset = (preset: DocxThemePreset): DocxVisualTheme => {
  if (preset === 'classic') {
    return DOCX_VISUAL_THEME_CLASSIC;
  }
  return DOCX_VISUAL_THEME_NONE;
};

export const getDefaultDocxVisualTheme = (
  env: NodeJS.ProcessEnv = process.env,
): DocxVisualTheme => docxThemeFromPreset(parseDocxThemePresetFromEnv(env));
