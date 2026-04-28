# Code Review: Auth Role Coherence (Frontend Admin vs Backend Auth)
**Ready for Production**: Yes
**Critical Issues**: 0

## Scope
- Verifica coerenza tra ruoli impostabili da UI admin frontend e ruoli effettivamente accettati/usati da auth backend per distinguere utente standard e admin.

## Priority 1 (Must Fix) ⛔
- Nessun rilievo P1.

## Priority 2 (Should Fix)
- Nessun rilievo P2 aperto.
- Chiuso in data 2026-04-28: tipizzazione frontend ruolo/stato riallineata al dominio canonico.
  - Evidenza: [frontend/src/features/auth/runtime/auth-client.ts](frontend/src/features/auth/runtime/auth-client.ts#L7), [frontend/src/features/auth/runtime/auth-client.ts](frontend/src/features/auth/runtime/auth-client.ts#L10), [frontend/src/features/auth/runtime/auth-client.ts](frontend/src/features/auth/runtime/auth-client.ts#L27), [frontend/src/features/admin/runtime/admin-client.ts](frontend/src/features/admin/runtime/admin-client.ts#L3), [frontend/src/features/admin/pages/AdminUsersPage.tsx](frontend/src/features/admin/pages/AdminUsersPage.tsx#L19).

## Priority 3 (Nice To Fix)
- Nessun rilievo P3 aperto.
- Chiuso in data 2026-04-28: mock test frontend riallineati da `user` a `member`.
  - Evidenza: [frontend/src/features/admin/pages/AdminUsersPage.test.tsx](frontend/src/features/admin/pages/AdminUsersPage.test.tsx#L11), [frontend/src/features/admin/runtime/admin-client.test.ts](frontend/src/features/admin/runtime/admin-client.test.ts#L46), [frontend/src/features/projects/pages/ProjectsListPage.test.tsx](frontend/src/features/projects/pages/ProjectsListPage.test.tsx#L11), [frontend/src/features/projects/pages/ProjectDetailPage.test.tsx](frontend/src/features/projects/pages/ProjectDetailPage.test.tsx#L39), [frontend/src/features/dashboard/pages/DashboardPage.test.tsx](frontend/src/features/dashboard/pages/DashboardPage.test.tsx#L9), [frontend/src/features/artifacts/pages/ArtifactsPage.test.tsx](frontend/src/features/artifacts/pages/ArtifactsPage.test.tsx#L42).

## Coerenza Verificata (As-Is)
- Frontend admin espone ruoli canonici impostabili `member` e `admin`.
  - Evidenza: [frontend/src/features/admin/pages/AdminUsersPage.tsx](frontend/src/features/admin/pages/AdminUsersPage.tsx#L21), [frontend/src/features/admin/pages/AdminUsersPage.tsx](frontend/src/features/admin/pages/AdminUsersPage.tsx#L22), [frontend/src/features/admin/pages/AdminUsersPage.tsx](frontend/src/features/admin/pages/AdminUsersPage.tsx#L23).
- Default creazione utente in UI su `member`.
  - Evidenza: [frontend/src/features/admin/pages/AdminUsersPage.tsx](frontend/src/features/admin/pages/AdminUsersPage.tsx#L42).
- Guard frontend per area admin basata su `role === 'admin'`.
  - Evidenza: [frontend/src/features/admin/routing/admin-guard.tsx](frontend/src/features/admin/routing/admin-guard.tsx#L8).
- Backend auth accetta solo ruoli canonici (`admin`, `member`) e rifiuta altri valori.
  - Evidenza: [src/lib/types/auth.ts](src/lib/types/auth.ts#L3), [src/lib/runtime/auth-http.ts](src/lib/runtime/auth-http.ts#L108), [src/lib/runtime/auth-http.ts](src/lib/runtime/auth-http.ts#L194), [src/lib/runtime/auth-http.ts](src/lib/runtime/auth-http.ts#L975), [src/lib/runtime/auth-http.ts](src/lib/runtime/auth-http.ts#L1073).
- Distinzione autorizzativa admin vs non-admin enforced server-side.
  - Evidenza: [src/lib/runtime/auth-http.ts](src/lib/runtime/auth-http.ts#L569), [src/lib/runtime/auth-http.ts](src/lib/runtime/auth-http.ts#L580).
- Vincolo database coerente con runtime (`admin|member`).
  - Evidenza: [db/migrations/20260424_000003_auth_minimal.sql](db/migrations/20260424_000003_auth_minimal.sql#L29).

## Test Coverage Notes
- Copertura backend presente su CRUD admin e blocco non-admin.
  - Evidenza: [src/lib/tests/runtime.auth-http.test.ts](src/lib/tests/runtime.auth-http.test.ts#L346), [src/lib/tests/runtime.auth-http.test.ts](src/lib/tests/runtime.auth-http.test.ts#L391).
- Validazione frontend eseguita sui test aggiornati: 25/25 passati.
  - Evidenza: [frontend/src/features/admin/pages/AdminUsersPage.test.tsx](frontend/src/features/admin/pages/AdminUsersPage.test.tsx), [frontend/src/features/admin/runtime/admin-client.test.ts](frontend/src/features/admin/runtime/admin-client.test.ts), [frontend/src/features/projects/pages/ProjectsListPage.test.tsx](frontend/src/features/projects/pages/ProjectsListPage.test.tsx), [frontend/src/features/projects/pages/ProjectDetailPage.test.tsx](frontend/src/features/projects/pages/ProjectDetailPage.test.tsx), [frontend/src/features/dashboard/pages/DashboardPage.test.tsx](frontend/src/features/dashboard/pages/DashboardPage.test.tsx), [frontend/src/features/artifacts/pages/ArtifactsPage.test.tsx](frontend/src/features/artifacts/pages/ArtifactsPage.test.tsx).

## Verdict
- Coerenza operativa tra frontend admin e backend auth: **confermata** per i ruoli effettivi (`admin`/`member`) e per la separazione privilegi admin.
- Follow-up chiusi: typing frontend rafforzato e test frontend riallineati.