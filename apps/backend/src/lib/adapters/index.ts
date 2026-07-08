// DEPRECATED BARREL — use domain-specific imports instead:
//   import { ... } from '../adapters/generation'  ← Generation Context (incl. ApiService)
//   import { ... } from '../adapters/auth'         ← Auth Context
//   import { ... } from '../adapters/admin'        ← organizational grouping (changelog, reports)
// This barrel will be removed after all consumers are migrated.

export * from './generation';
export * from './auth';
export * from './admin';
