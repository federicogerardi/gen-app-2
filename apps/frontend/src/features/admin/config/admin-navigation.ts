export type AdminNavigationItem = {
  key: 'overview' | 'users' | 'models' | 'api-services' | 'changelog' | 'user-reports' | 'activity';
  to: '/admin' | '/admin/users' | '/admin/models' | '/admin/api-services' | '/admin/changelog' | '/admin/user-reports' | '/admin/activity';
  label: string;
  description: string;
  end?: boolean;
};

export const adminNavigationItems: readonly AdminNavigationItem[] = [
  {
    key: 'overview',
    to: '/admin',
    label: 'Panoramica',
    description: 'Dashboard centrale per i flussi amministrativi.',
    end: true,
  },
  {
    key: 'users',
    to: '/admin/users',
    label: 'Utenti',
    description: 'Provisioning, ruoli, stato account e quota mensile.',
  },
  {
    key: 'models',
    to: '/admin/models',
    label: 'Modelli LLM',
    description: 'Catalogo LlmModel e stato di disponibilita.',
  },
  {
    key: 'api-services',
    to: '/admin/api-services',
    label: 'ApiService',
    description: 'Catalogo ApiService e binding dei tool step.',
  },
  {
    key: 'changelog',
    to: '/admin/changelog',
    label: 'Changelog',
    description: 'Pubblicazione e archivio ProductChangelog.',
  },
  {
    key: 'user-reports',
    to: '/admin/user-reports',
    label: 'Segnalazioni',
    description: 'Inbox UserReport e policy di escalation.',
  },
  {
    key: 'activity',
    to: '/admin/activity',
    label: 'Attivita recente',
    description: 'Vista tabellare delle checkpoint recenti del workspace.',
  },
] as const;