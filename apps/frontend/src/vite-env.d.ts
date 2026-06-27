/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FF_USE_CLUSTER_SYSTEM: string | undefined;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
