import { canRoleAccessToolKey, normalizeToolKeyCandidate } from '@gen-app-2/contracts';

import type { AuthUserRole } from '../../types/auth';

const resolveToolAccessRole = (role: AuthUserRole): 'admin' | 'member' => (
  role === 'admin' ? 'admin' : 'member'
);

export const canPrincipalRoleAccessToolKey = (
  toolKey: string,
  role: AuthUserRole,
): boolean => {
  const normalizedToolKey = normalizeToolKeyCandidate(toolKey);
  if (!normalizedToolKey) {
    return false;
  }

  return canRoleAccessToolKey(normalizedToolKey, resolveToolAccessRole(role));
};
