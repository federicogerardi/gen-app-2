export type DocxParagraphKind =
  | 'title'
  | 'meta'
  | 'heading-1'
  | 'heading-2'
  | 'heading-3'
  | 'paragraph'
  | 'unordered-list-item'
  | 'ordered-list-item'
  | 'code'
  | 'blank'
  | 'table'
  | 'table-header-cell'
  | 'table-cell';

export type DocxRunRole =
  | 'default'
  | 'title'
  | 'meta'
  | 'heading'
  | 'list-prefix'
  | 'code'
  | 'bold'
  | 'italic'
  | 'bold-italic'
  | 'strike';

export type DocxVisualStyle = Record<string, unknown>;

export type DocxVisualTheme = {
  paragraphByKind?: Partial<Record<DocxParagraphKind, DocxVisualStyle>>;
  runByRole?: Partial<Record<DocxRunRole, DocxVisualStyle>>;
};

export const DOCX_VISUAL_THEME_NONE: DocxVisualTheme = Object.freeze({
  paragraphByKind: Object.freeze({}),
  runByRole: Object.freeze({}),
});

export const mergeDocxVisualTheme = (
  base: DocxVisualTheme,
  override?: DocxVisualTheme,
): DocxVisualTheme => {
  if (!override) {
    return base;
  }

  return {
    paragraphByKind: {
      ...(base.paragraphByKind ?? {}),
      ...(override.paragraphByKind ?? {}),
    },
    runByRole: {
      ...(base.runByRole ?? {}),
      ...(override.runByRole ?? {}),
    },
  };
};
