/**
 * LlmModel domain types for the LlmModelCatalog bounded context.
 * DDD-053: LlmModel, DDD-054: LlmModelStatus, DDD-055: LlmModelCatalog, DDD-056: LlmModelId.
 */

export type LlmModelStatus = 'enabled' | 'disabled';

export type LlmModel = {
  id: string;
  key: string;
  label: string;
  status: LlmModelStatus;
  /** Whether this model is the catalog default. Exactly one enabled model has isDefault = true. DDD-056. */
  isDefault: boolean;
  sortOrder: number | null;
  createdAt: Date;
  updatedAt: Date;
};

export type LlmModelRow = {
  id: string;
  key: string;
  label: string;
  status: string;
  is_default: boolean;
  sort_order: number | null;
  created_at: Date;
  updated_at: Date;
};

export const rowToLlmModel = (row: LlmModelRow): LlmModel => ({
  id: row.id,
  key: row.key,
  label: row.label,
  status: row.status as LlmModelStatus,
  isDefault: row.is_default,
  sortOrder: row.sort_order,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});
