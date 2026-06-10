import test from 'node:test';
import assert from 'node:assert/strict';

import { canPrincipalRoleAccessToolKey } from '../runtime/auth-http/tool-availability-policy';

test('canPrincipalRoleAccessToolKey is fail-closed for invalid tool keys', () => {
  assert.equal(canPrincipalRoleAccessToolKey('', 'member'), false);
  assert.equal(canPrincipalRoleAccessToolKey('not a valid key', 'member'), false);
});

test('canPrincipalRoleAccessToolKey allows enabled tools for admin role', () => {
  assert.equal(canPrincipalRoleAccessToolKey('funnel-pages', 'admin'), true);
});
