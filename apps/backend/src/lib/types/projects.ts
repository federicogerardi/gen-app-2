export type ProjectSummary = {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'archived';
  updatedAt: string;
};

export type ProjectDetail = ProjectSummary & {
  userId: string;
  createdAt: string;
};

export type CreateProjectInput = {
  name: string;
  description?: string;
};

type ProjectRow = {
  id: string;
  user_id: string;
  name: string | null;
  status: string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

const toIso = (value: Date | string): string => {
  return typeof value === 'string' ? value : value.toISOString();
};

export const mapProjectRowToSummary = (row: ProjectRow): ProjectSummary => {
  return {
    id: row.id,
    name: row.name ?? 'Untitled project',
    description: '',
    status: (row.status as 'active' | 'archived') ?? 'active',
    updatedAt: toIso(row.updated_at),
  };
};

export const mapProjectRowToDetail = (row: ProjectRow): ProjectDetail => {
  return {
    ...mapProjectRowToSummary(row),
    userId: row.user_id,
    createdAt: toIso(row.created_at),
  };
};
