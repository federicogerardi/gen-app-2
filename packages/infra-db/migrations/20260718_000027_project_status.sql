-- Project status column for workspace archiving (DDD-209)
ALTER TABLE projects ADD COLUMN status VARCHAR NOT NULL DEFAULT 'active';
ALTER TABLE projects ADD CONSTRAINT projects_status_check CHECK (status IN ('active', 'archived'));
