import type { ProductionAdapterRuntime } from './postgres-redis.interfaces';

export const nowDate = (runtime?: ProductionAdapterRuntime): Date =>
  runtime?.now?.() ?? new Date();

export const randomId = (runtime?: ProductionAdapterRuntime): string =>
  runtime?.randomId?.() ?? Math.random().toString(36).slice(2, 14);
