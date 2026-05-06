BEGIN;

UPDATE request_idempotency AS ri
SET artifact_id = NULL
WHERE artifact_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM artifacts AS a
    WHERE a.id = ri.artifact_id
  );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'request_idempotency_artifact_id_fkey'
  ) THEN
    ALTER TABLE request_idempotency
      ADD CONSTRAINT request_idempotency_artifact_id_fkey
      FOREIGN KEY (artifact_id)
      REFERENCES artifacts(id)
      ON DELETE SET NULL;
  END IF;
END
$$;

COMMIT;