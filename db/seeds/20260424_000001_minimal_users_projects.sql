BEGIN;

INSERT INTO users (
  id,
  email,
  monthly_quota,
  monthly_used,
  created_at,
  updated_at
)
VALUES (
  'seed-user-001',
  'seed-user-001@example.local',
  100,
  0,
  NOW(),
  NOW()
)
ON CONFLICT (id)
DO UPDATE SET
  email = EXCLUDED.email,
  monthly_quota = EXCLUDED.monthly_quota,
  updated_at = NOW();

INSERT INTO projects (
  id,
  user_id,
  name,
  created_at,
  updated_at
)
VALUES (
  'seed-project-001',
  'seed-user-001',
  'Seed Project 001',
  NOW(),
  NOW()
)
ON CONFLICT (id)
DO UPDATE SET
  user_id = EXCLUDED.user_id,
  name = EXCLUDED.name,
  updated_at = NOW();

COMMIT;