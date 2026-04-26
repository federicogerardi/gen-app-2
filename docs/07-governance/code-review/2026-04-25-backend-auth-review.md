# Code Review: Backend Auth Surface
**Ready for Production**: No
**Critical Issues**: 1

## Priority 1 (Must Fix) ⛔
- The generation endpoint is reachable without backend authentication. In [src/lib/runtime/node-server.ts](../../../src/lib/runtime/node-server.ts#L218), the request is passed to the auth runtime first, but if the auth runtime does not handle the path, the server accepts POST requests on the generation route and forwards the parsed payload directly to generation handling. No session principal is required there.

## Observed Protection Model
- Public auth bootstrap routes: [src/lib/runtime/auth-http.ts](../../../src/lib/runtime/auth-http.ts#L1185), [src/lib/runtime/auth-http.ts](../../../src/lib/runtime/auth-http.ts#L1200), and [src/lib/runtime/auth-http.ts](../../../src/lib/runtime/auth-http.ts#L1205) expose login and Google OAuth start/callback without an existing session, which is expected.
- Session-backed user routes: [src/lib/runtime/auth-http.ts](../../../src/lib/runtime/auth-http.ts#L1242), [src/lib/runtime/auth-http.ts](../../../src/lib/runtime/auth-http.ts#L1263), [src/lib/runtime/auth-http.ts](../../../src/lib/runtime/auth-http.ts#L1268), and [src/lib/runtime/auth-http.ts](../../../src/lib/runtime/auth-http.ts#L1273) resolve through handlers that call [src/lib/runtime/auth-http.ts](../../../src/lib/runtime/auth-http.ts#L539) and return 401 when no active session cookie is present.
- Admin-only routes: [src/lib/runtime/auth-http.ts](../../../src/lib/runtime/auth-http.ts#L1215) and [src/lib/runtime/auth-http.ts](../../../src/lib/runtime/auth-http.ts#L1229) rely on [src/lib/runtime/auth-http.ts](../../../src/lib/runtime/auth-http.ts#L520), which requires both an active session and admin role.
- CORS and CSRF are enabled in [src/server.ts](../../../src/server.ts#L100) and [src/server.ts](../../../src/server.ts#L108), but those controls do not authenticate callers.

## Recommended Changes
- Require a valid session principal before accepting the generation route.
- Derive user identity from the authenticated principal instead of trusting userId from the request body.
- Keep login and OAuth bootstrap public, but treat all business APIs as authenticated-by-backend, not authenticated-by-frontend.