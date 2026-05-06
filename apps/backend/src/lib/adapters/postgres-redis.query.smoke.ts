import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

import { Pool } from 'pg';

import {
  PostgresArtifactQueryRepository,
  PostgresProjectQueryRepository,
} from './index';

const requiredEnv = (name: 'DATABASE_URL'): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

const run = async () => {
  const databaseUrl = requiredEnv('DATABASE_URL');
  const pg = new Pool({ connectionString: databaseUrl });

  const ownUserId = 'seed-user-001';
  const otherUserId = 'seed-user-queries-002';
  const ownProjectId = `seed-project-query-own-${randomUUID()}`;
  const otherProjectId = `seed-project-query-other-${randomUUID()}`;

  const ownArtifactId = `artifact-query-own-${randomUUID()}`;
  const otherArtifactId = `artifact-query-other-${randomUUID()}`;

  const projectQueries = new PostgresProjectQueryRepository(pg);
  const artifactQueries = new PostgresArtifactQueryRepository(pg);

  try {
    await pg.query(
      `INSERT INTO users (id, email, monthly_quota, monthly_used)
       VALUES ($1, $2, 100, 0)
       ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, updated_at = NOW()`,
      [otherUserId, `${otherUserId}@example.local`],
    );

    await pg.query(
      `INSERT INTO projects (id, user_id, name, created_at, updated_at)
       VALUES
         ($1, $2, 'Query Own Project', NOW(), NOW() - INTERVAL '2 minute'),
         ($3, $4, 'Query Other Project', NOW(), NOW() - INTERVAL '1 minute')
       ON CONFLICT (id)
       DO UPDATE SET user_id = EXCLUDED.user_id, name = EXCLUDED.name, updated_at = EXCLUDED.updated_at`,
      [ownProjectId, ownUserId, otherProjectId, otherUserId],
    );

    await pg.query(
      `INSERT INTO artifacts
        (
          id,
          request_id,
          user_id,
          project_id,
          type,
          workflow_type,
          model,
          input_json,
          content,
          status,
          completed_at,
          created_at,
          updated_at
        )
       VALUES
        (
          $1,
          'request-query-own-001',
          $2,
          $3,
          'content',
          'tool',
          'smoke-model',
          '{"prompt":"query-smoke"}'::jsonb,
          'query-smoke-content',
          'completed',
          NOW(),
          NOW(),
          NOW() - INTERVAL '2 minute'
        ),
        (
          $4,
          'request-query-other-001',
          $5,
          $6,
          'content',
          NULL,
          'smoke-model',
          '{"prompt":"query-smoke-other"}'::jsonb,
          'query-smoke-other-content',
          'completed',
          NOW(),
          NOW(),
          NOW() - INTERVAL '1 minute'
        )
       ON CONFLICT (id)
       DO UPDATE SET
         user_id = EXCLUDED.user_id,
         project_id = EXCLUDED.project_id,
         status = EXCLUDED.status,
         content = EXCLUDED.content,
         updated_at = EXCLUDED.updated_at`,
      [
        ownArtifactId,
        ownUserId,
        ownProjectId,
        otherArtifactId,
        otherUserId,
        otherProjectId,
      ],
    );

    const listedOwnProjects = await projectQueries.listProjectsByUser(ownUserId);
    assert.ok(listedOwnProjects.some((project) => project.id === ownProjectId));
    assert.ok(listedOwnProjects.every((project) => project.id !== otherProjectId));

    const createdProject = await projectQueries.createProjectForUser(ownUserId, {
      name: `Created Query Project ${randomUUID()}`,
    });
    const readCreatedProject = await projectQueries.getProjectByIdForUser(ownUserId, createdProject.id);
    assert.ok(readCreatedProject);
    assert.equal(readCreatedProject.id, createdProject.id);

    const notVisibleProject = await projectQueries.getProjectByIdForUser(otherUserId, createdProject.id);
    assert.equal(notVisibleProject, null);

    const ownCompletedArtifacts = await artifactQueries.listArtifactsByUser(ownUserId, {
      type: 'content',
      status: 'completed',
      projectId: ownProjectId,
    });
    assert.ok(ownCompletedArtifacts.some((artifact) => artifact.artifactId === ownArtifactId));
    assert.ok(ownCompletedArtifacts.every((artifact) => artifact.artifactId !== otherArtifactId));

    const readOwnArtifact = await artifactQueries.getArtifactByIdForUser(ownUserId, ownArtifactId);
    assert.ok(readOwnArtifact);
    assert.equal(readOwnArtifact.artifactId, ownArtifactId);

    const readOtherArtifactAsOwn = await artifactQueries.getArtifactByIdForUser(ownUserId, otherArtifactId);
    assert.equal(readOtherArtifactAsOwn, null);

    console.log('Smoke OK: query repositories projects/artifacts are scoped and filtered correctly');

    await pg.query(
      `DELETE FROM artifacts WHERE id = ANY($1::text[])`,
      [[ownArtifactId, otherArtifactId]],
    );
    await pg.query(
      `DELETE FROM projects WHERE id = ANY($1::text[])`,
      [[ownProjectId, otherProjectId, createdProject.id]],
    );
    await pg.query(`DELETE FROM users WHERE id = $1`, [otherUserId]);
  } finally {
    await pg.end();
  }
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});