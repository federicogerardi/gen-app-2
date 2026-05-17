const TONE_PROFILE_DEFAULT = 'Professional';
const TONE_PROFILE_ALLOWED = ['Professional', 'Casual', 'Formal', 'Technical'] as const;

export const normalizeModelForPayload = (model: string, fallbackModel: string): string => {
  const normalized = model.trim();
  if (normalized.length === 0) {
    return fallbackModel;
  }

  if (normalized.includes('/')) {
    return normalized;
  }

  if (normalized.includes(':')) {
    const [provider, ...rest] = normalized.split(':');
    if (provider && rest.length > 0) {
      return `${provider}/${rest.join(':')}`;
    }
  }

  return normalized;
};

export const normalizeToneProfile = (
  tone: string,
  fallbackTone: string = TONE_PROFILE_DEFAULT,
): string => {
  const normalized = tone.trim().toLowerCase();
  if (normalized.length === 0) {
    return fallbackTone;
  }

  const match = TONE_PROFILE_ALLOWED.find((candidate) => candidate.toLowerCase() === normalized);
  return match ?? fallbackTone;
};

export const mapInlineDispatchError = (reason: string | null | undefined): string | null => {
  if (!reason) {
    return null;
  }

  const normalized = reason.trim();
  if (normalized.length === 0) {
    return null;
  }

  if (normalized === 'extraction_context_insufficient' || normalized === 'stream_empty_output') {
    return 'Il briefing non contiene dati sufficienti per la generazione. Carica un nuovo brief più dettagliato.';
  }

  if (normalized.startsWith('terminal_failed')) {
    return 'La generazione non è andata a buon fine. Riprova tra pochi istanti.';
  }

  return normalized;
};

export const isEmptyPayload = (payload: Record<string, unknown>): boolean =>
  Object.keys(payload).length === 0;
