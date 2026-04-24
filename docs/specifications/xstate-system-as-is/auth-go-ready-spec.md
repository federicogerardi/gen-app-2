# Auth GO Ready Mini Spec

Versione: 1.0
Data: 2026-04-24
Stato: ready-to-implement

Obiettivo: portare il sistema a GO per:

- auth nativo username/password senza self-registration
- CRUD utenti in scope admin
- login federato Google OAuth 2.0 / OIDC

Questa specifica e minima e implementativa. Assume il dominio gia esistente (`users`, `projects`, `artifacts`, `quota_history`) e aggiunge solo i contratti necessari per identity, sessione e autorizzazione admin.

## 1. Diagnosi As-Is

Stato corrente verificato nel blueprint/runtime:

- esistono `users` e riferimenti FK gia coerenti con `projects`, `artifacts`, `quota_history`
- il `requestGatewayMachine` gestisce solo `AUTH_OK` / `AUTH_FAIL` e persiste `userId`
- esiste `authActor` solo come placeholder architetturale, non come surface runtime completa
- manca un contratto stabile per session cookies, credenziali password, Google OAuth callback e amministrazione utenti

Conclusione: il GO auth richiede un layer dedicato, separato dal gateway di generation. Il gateway deve consumare una sessione gia risolta, non orchestrare login o callback OAuth.

## 2. Architettura Proposta

Attori XState distinti:

- `authSessionMachine`: ownership del ciclo login/logout/session refresh/callback OAuth
- `requestGatewayMachine`: gate di richiesta protetta; consuma `sessionSnapshot` o `AUTH_SESSION_RESOLVED`

Separazioni obbligatorie:

- `authSessionMachine` non decide quota, idempotency o stream transport
- `requestGatewayMachine` non valida password e non parla con Google direttamente
- gli handler HTTP auth/admin parlano con repository/actors auth dedicati; il runtime generation osserva solo `session.userId`, `session.role`, `session.status`

## 3. Schema DB Minimo

### 3.1 Estensioni `users`

Delta minimo sulla tabella esistente `users`:

```sql
ALTER TABLE users
  ALTER COLUMN email SET NOT NULL;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'member',
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS password_hash text,
  ADD COLUMN IF NOT EXISTS password_algo text,
  ADD COLUMN IF NOT EXISTS password_changed_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_login_at timestamptz,
  ADD COLUMN IF NOT EXISTS disabled_at timestamptz,
  ADD COLUMN IF NOT EXISTS created_by_admin_user_id text REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE users
  ADD CONSTRAINT users_role_valid
    CHECK (role IN ('admin', 'member'));

ALTER TABLE users
  ADD CONSTRAINT users_status_valid
    CHECK (status IN ('active', 'disabled', 'pending_password_reset'));

CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique_idx
  ON users (lower(email));
```

Regole:

- `password_hash` obbligatorio per utenti native, nullo per utenti solo Google
- `role='admin'` governa tutta la surface `/api/admin/*`
- `status='disabled'` impedisce login native e session bootstrap anche se il cookie e valido
- self-registration vietata: nuovi utenti creati solo da admin o bootstrap seed/migration

### 3.2 Nuova tabella `auth_sessions`

```sql
CREATE TABLE IF NOT EXISTS auth_sessions (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_token_hash text NOT NULL,
  auth_method text NOT NULL,
  ip_address inet,
  user_agent text,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  last_seen_at timestamptz NOT NULL DEFAULT NOW(),
  created_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT auth_sessions_auth_method_valid
    CHECK (auth_method IN ('native', 'google'))
);

CREATE UNIQUE INDEX IF NOT EXISTS auth_sessions_token_hash_unique_idx
  ON auth_sessions (session_token_hash);

CREATE INDEX IF NOT EXISTS auth_sessions_user_lookup_idx
  ON auth_sessions (user_id, expires_at DESC);
```

Regole:

- nel cookie si espone solo token opaco; nel DB si persiste hash del token
- una sessione revocata o scaduta non puo produrre `AUTH_OK`
- `last_seen_at` puo essere aggiornato con throttling server-side, non a ogni request

### 3.3 Nuova tabella `oauth_accounts`

```sql
CREATE TABLE IF NOT EXISTS oauth_accounts (
  id bigserial PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider text NOT NULL,
  provider_subject text NOT NULL,
  email_at_provider text,
  profile_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT oauth_accounts_provider_valid CHECK (provider IN ('google')),
  CONSTRAINT oauth_accounts_provider_subject_unique UNIQUE (provider, provider_subject),
  CONSTRAINT oauth_accounts_provider_user_unique UNIQUE (provider, user_id)
);
```

Regole:

- account Google collegabile solo a utenti pre-esistenti creati in scope admin
- per policy no self-registration, callback Google senza match applicativo produce `403 FORBIDDEN`
- `email_at_provider` e informativa, non autoritativa per creare l'utente

### 3.4 Nuova tabella `oauth_state_tokens`

```sql
CREATE TABLE IF NOT EXISTS oauth_state_tokens (
  state text PRIMARY KEY,
  provider text NOT NULL,
  code_verifier text NOT NULL,
  redirect_uri text NOT NULL,
  requested_by_ip inet,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT oauth_state_tokens_provider_valid CHECK (provider IN ('google'))
);
```

Regole:

- necessario per CSRF protection e PKCE
- token `state` monouso; riuso dopo `consumed_at` deve fallire con `UNAUTHORIZED`

## 4. Surface API Auth/Admin

## 4.1 Auth API

### POST `/api/auth/login`

Body:

```json
{
  "email": "admin@example.com",
  "password": "plain-text-from-form"
}
```

Esito:

- `204 No Content` + `Set-Cookie: genapp_session=...; HttpOnly; Secure; SameSite=Lax; Path=/`
- `401 UNAUTHORIZED` credenziali non valide
- `423 ACCOUNT_DISABLED` utente disabilitato
- `409 PASSWORD_RESET_REQUIRED` stato `pending_password_reset`

### POST `/api/auth/logout`

Esito:

- `204 No Content`
- revoca server-side sessione corrente + cookie expire immediato

### GET `/api/auth/session`

Response `200`:

```json
{
  "authenticated": true,
  "user": {
    "id": "user_123",
    "email": "admin@example.com",
    "role": "admin",
    "status": "active"
  },
  "authMethod": "native"
}
```

Response `200` anonima:

```json
{
  "authenticated": false
}
```

### GET `/api/auth/google/start`

Query opzionale:

- `returnTo=/admin/users`

Esito:

- `302` redirect verso Google Authorization Endpoint
- persist `oauth_state_tokens`

### GET `/api/auth/google/callback`

Input query:

- `code`
- `state`

Esito:

- `302` verso applicazione con cookie sessione impostato
- `401 UNAUTHORIZED` state invalido / code exchange fallito
- `403 FORBIDDEN` account Google non autorizzato o non collegato a utente esistente
- nessuna creazione automatica utente

## 4.2 Admin API

Tutte le route richiedono sessione autenticata con `role='admin'`.

### GET `/api/admin/users`

Supporta filtri minimi:

- `status=active|disabled|pending_password_reset`
- `q=<email>`

### POST `/api/admin/users`

Body minimo:

```json
{
  "email": "member@example.com",
  "role": "member",
  "auth": {
    "provider": "native",
    "temporaryPassword": "TempPassword123!"
  }
}
```

Oppure:

```json
{
  "email": "member@example.com",
  "role": "member",
  "auth": {
    "provider": "google"
  }
}
```

Effetti:

- crea utente applicativo
- per native salva `password_hash` e opzionalmente `status='pending_password_reset'`
- per Google crea solo utente locale; linking account avviene al primo callback approvato o via flow admin dedicato

### PATCH `/api/admin/users/:userId`

Campi minimi modificabili:

- `role`
- `status`
- `monthlyQuota`

Vincoli:

- un admin non puo auto-disabilitare l'ultimo admin attivo
- downgrade `admin -> member` richiede almeno un altro admin attivo

### POST `/api/admin/users/:userId/reset-password`

Body:

```json
{
  "temporaryPassword": "AnotherTemp123!",
  "requireChange": true
}
```

Effetti:

- ruota `password_hash`
- revoca tutte le `auth_sessions` native dell'utente
- se `requireChange=true`, imposta `status='pending_password_reset'`

### POST `/api/admin/users/:userId/google-link`

Body:

```json
{
  "googleEmail": "member@example.com"
}
```

Uso minimo consigliato:

- prepara il linking applicativo atteso per account Google esistente
- in alternativa, si puo evitare questa route e autorizzare il linking al primo callback Google solo se esiste un utente locale con stessa email e policy esplicita `allowGoogleAutoLink=true`

Scelta GO consigliata: partire senza auto-link implicito e mantenere linking solo esplicito/admin.

## 5. Error Contract Minimo Auth

Codici applicativi minimi:

- `UNAUTHORIZED`
- `FORBIDDEN`
- `ACCOUNT_DISABLED`
- `PASSWORD_RESET_REQUIRED`
- `SESSION_EXPIRED`
- `OAUTH_STATE_INVALID`
- `OAUTH_ACCOUNT_NOT_LINKED`
- `VALIDATION_ERROR`
- `CONFLICT`
- `INTERNAL_ERROR`

Shape coerente col runtime esistente:

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid credentials",
    "requestId": "req_123"
  }
}
```

## 6. State Model XState

## 6.1 Gateway/Auth Boundary

Il `requestGatewayMachine` resta focalizzato sul gate di request protetta. La risoluzione sessione arriva da actor dedicato.

Flusso:

```text
idle
 -> auth
 -> validation
 -> usageAndIdempotency
 -> passed
 -> failed
```

Contratti evento aggiuntivi minimi:

- `AUTH_SESSION_RESOLVED { userId, role, status, authMethod, sessionId }`
- `AUTH_SESSION_MISSING`
- `AUTH_SESSION_INVALID { reason }`
- `AUTHZ_DENIED { reason }`

Transizioni minime:

| Stato | Evento | Guard | Target | Azioni |
|---|---|---|---|---|
| `auth` | `AUTH_SESSION_RESOLVED` | `isSessionActive` | `validation` | `setUserId`, `setSessionMeta` |
| `auth` | `AUTH_SESSION_MISSING` | - | `failed` | `setFailureReason='unauthorized'` |
| `auth` | `AUTH_SESSION_INVALID` | - | `failed` | `setFailureReason=event.reason` |
| `validation` | `AUTHZ_DENIED` | - | `failed` | `setFailureReason='forbidden'` |

Guardie minime:

- `isSessionActive`: `status === 'active'`
- `isAdminSession`: `role === 'admin'`

## 6.2 `authSessionMachine`

Macchina dedicata a route auth/session. Pattern v5: `setup().createMachine()` + `actors` `fromPromise(...)`, runtime via `createActor()`.

Stati:

```text
unknown
 -> resolvingSession
 -> anonymous
 -> authenticated
 -> loginSubmitting
 -> logoutSubmitting
 -> oauthRedirecting
 -> oauthCallbackProcessing
 -> failure
```

Eventi minimi:

```ts
type AuthSessionEvent =
  | { type: 'SESSION_BOOT' }
  | { type: 'LOGIN_SUBMIT'; email: string; password: string }
  | { type: 'LOGOUT_SUBMIT' }
  | { type: 'GOOGLE_START'; returnTo?: string }
  | { type: 'GOOGLE_CALLBACK'; code: string; state: string }
  | { type: 'SESSION_REFRESH' }
  | { type: 'RETRY' };
```

Contesto minimo:

```ts
interface AuthSessionContext {
  requestId: string;
  sessionId: string | null;
  userId: string | null;
  role: 'admin' | 'member' | null;
  status: 'active' | 'disabled' | 'pending_password_reset' | null;
  authMethod: 'native' | 'google' | null;
  email: string | null;
  returnTo: string | null;
  failureCode: string | null;
}
```

Skeleton v5:

```ts
import { setup, assign, fromPromise } from 'xstate';

export const authSessionMachine = setup({
  types: {
    context: {} as AuthSessionContext,
    events: {} as AuthSessionEvent
  },
  actors: {
    resolveSession: fromPromise(async ({ input }) => input.authApi.getSession()),
    loginWithPassword: fromPromise(async ({ input }) => input.authApi.login(input)),
    logoutSession: fromPromise(async ({ input }) => input.authApi.logout(input)),
    beginGoogleOAuth: fromPromise(async ({ input }) => input.authApi.startGoogle(input)),
    handleGoogleCallback: fromPromise(async ({ input }) => input.authApi.finishGoogle(input))
  },
  guards: {
    isAuthenticated: ({ context }) => Boolean(context.userId && context.status === 'active')
  },
  actions: {
    cacheSession: assign({
      sessionId: (_, params: { sessionId: string }) => params.sessionId,
      userId: (_, params: { userId: string }) => params.userId,
      role: (_, params: { role: 'admin' | 'member' }) => params.role,
      status: (_, params: { status: 'active' | 'disabled' | 'pending_password_reset' }) => params.status,
      authMethod: (_, params: { authMethod: 'native' | 'google' }) => params.authMethod,
      email: (_, params: { email: string }) => params.email,
      failureCode: () => null
    }),
    clearSession: assign({
      sessionId: null,
      userId: null,
      role: null,
      status: null,
      authMethod: null,
      email: null
    }),
    setFailureCode: assign({
      failureCode: (_, params: { code: string }) => params.code
    })
  }
}).createMachine({
  id: 'authSession',
  initial: 'unknown',
  context: {
    requestId: '',
    sessionId: null,
    userId: null,
    role: null,
    status: null,
    authMethod: null,
    email: null,
    returnTo: null,
    failureCode: null
  },
  states: {
    unknown: {
      on: { SESSION_BOOT: 'resolvingSession' }
    },
    resolvingSession: {},
    anonymous: {
      on: {
        LOGIN_SUBMIT: 'loginSubmitting',
        GOOGLE_START: 'oauthRedirecting'
      }
    },
    authenticated: {
      on: {
        SESSION_REFRESH: 'resolvingSession',
        LOGOUT_SUBMIT: 'logoutSubmitting'
      }
    },
    loginSubmitting: {},
    logoutSubmitting: {},
    oauthRedirecting: {},
    oauthCallbackProcessing: {},
    failure: {
      on: { RETRY: 'resolvingSession' }
    }
  }
});
```

Note v5 operative:

- transizioni interne di default; usare `reenter: true` solo se si vuole ripetere esplicitamente entry/invoke sullo stesso nodo
- usare `always` solo per routing deterministico dopo `onDone`, evitando loop
- il route handler osserva `actor.getSnapshot()` per serializzare la response, non legge stato duplicato fuori macchina

## 7. Checklist Test GO

## 7.1 Native Auth

- login con password valida crea `auth_sessions`, ritorna cookie e `GET /api/auth/session` autenticata
- login con password errata ritorna `401 UNAUTHORIZED` senza creare sessione
- login utente `disabled` ritorna `423 ACCOUNT_DISABLED`
- login utente `pending_password_reset` ritorna `409 PASSWORD_RESET_REQUIRED`
- logout revoca la sessione corrente e il cookie non risolve piu `AUTH_SESSION_RESOLVED`
- route admin con sessione member ritorna `403 FORBIDDEN`
- `POST /api/admin/users` crea utente native con `password_hash` valorizzato e `created_by_admin_user_id`
- reset password revoca tutte le sessioni native attive dell'utente
- downgrade/disabilitazione ultimo admin attivo viene rifiutato
- cookie mancante o token hash sconosciuto produce `AUTH_SESSION_MISSING`
- sessione scaduta o revocata produce `AUTH_SESSION_INVALID { reason: 'session_expired'|'session_revoked' }`

## 7.2 Google OAuth

- `GET /api/auth/google/start` crea record `oauth_state_tokens` e redireziona a Google con `state` e PKCE
- callback con `state` non valido o scaduto fallisce con `401 OAUTH_STATE_INVALID`
- callback con `state` gia consumato fallisce
- callback Google con subject linkato a utente attivo crea sessione `auth_method='google'`
- callback Google con utente locale non linkato fallisce `403 OAUTH_ACCOUNT_NOT_LINKED`
- callback Google per utente `disabled` fallisce `403 FORBIDDEN`
- logout dopo login Google revoca la sessione locale ma non tenta revoke lato Google come requisito GO minimo
- `GET /api/auth/session` riflette `authMethod='google'`

## 7.3 XState / Gateway

- `requestGatewayMachine` entra in failure su `AUTH_SESSION_MISSING`
- `requestGatewayMachine` prosegue a `validation` su `AUTH_SESSION_RESOLVED` con `status='active'`
- guard `isAdminSession` blocca route admin non autorizzate
- `authSessionMachine` segue il path `unknown -> resolvingSession -> anonymous` senza cookie
- `authSessionMachine` segue il path `unknown -> resolvingSession -> authenticated` con sessione valida
- `authSessionMachine` segue il path `anonymous -> loginSubmitting -> authenticated` su login native valido
- `authSessionMachine` segue il path `anonymous -> oauthRedirecting -> oauthCallbackProcessing -> authenticated` su callback Google valido
- error path mappano `failureCode` coerente col contract API

## 8. Decisioni GO / No-Go

GO quando tutti i punti seguenti sono veri:

- migration DB applicata con indici e constraint auth minimi
- cookie sessione HttpOnly firmato/opaco implementato
- password hashing forte implementato (`argon2id` raccomandato)
- nessuna route di self-registration esposta
- admin CRUD utenti coperto da authorization server-side
- Google OAuth usa state monouso + PKCE + nessun auto-provisioning implicito
- `requestGatewayMachine` consuma sessione risolta senza incorporare logica auth provider
- test checklist sopra verde su path native, admin e Google

No-Go se presente uno dei seguenti:

- session token persistito in chiaro
- linking Google basato solo su email senza policy esplicita
- revoca sessione assente su reset password o disable user
- route admin protette solo da check client-side
- gateway generation che continua a basarsi su `userId` passato dal client invece che da sessione server-side

## 9. Patch Sequence Consigliata

1. migration SQL: `users` delta + `auth_sessions` + `oauth_accounts` + `oauth_state_tokens`
2. repository auth: password verify, session create/revoke/read, oauth state store, oauth identity lookup
3. API auth/admin: login, logout, session, users CRUD, reset password, google start/callback
4. `authSessionMachine` + adapter runtime per route auth
5. integrazione `requestGatewayMachine` con session resolver server-side
6. test integration per native/admin/Google