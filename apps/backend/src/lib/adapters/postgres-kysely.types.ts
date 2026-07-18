import type { Generated } from 'kysely';

/**
 * Kysely DB interface for all tables referenced by production adapters.
 * Modeled after existing row types (ArtifactRow, ApiServiceRow, etc.)
 * and the authoritative DB schema in packages/infra-db/migrations.
 *
 * Schema qualifiers are intentionally omitted from these types.
 * Repositories apply schema per-query via db.withSchema(options.schema).
 */

export interface ArtifactsTable {
  id: string;
  request_id: string;
  user_id: string | null;
  project_id: string | null;
  type: string;
  status: string;
  model: string;
  workflow_type: string | null;
  session_id: string | null;
  step_key: string | null;
  artifact_role: string | null;
  run_mode: string | null;
  input_json: Record<string, unknown>;
  content: string;
  failure_reason: string | null;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  registry_version: string | null;
  registry_snapshot_ref: string | null;
  streamed_at: Date | null;
  completed_at: Date | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface UsersTable {
  id: string;
  email: string;
  monthly_quota: number;
  monthly_credits_used: number;
  monthly_artifact_limit: number;
  monthly_artifacts_used: number;
  role: string;
  status: string;
  password_hash: string | null;
  password_algo: string | null;
  password_changed_at: Date | null;
  last_login_at: Date | null;
  disabled_at: Date | null;
  created_by_admin_user_id: string | null;
  quota_window_started_at: Generated<Date>;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface AuthSessionsTable {
  id: string;
  user_id: string;
  session_token_hash: string;
  auth_method: string;
  ip_address: string | null;
  user_agent: string | null;
  expires_at: Date;
  revoked_at: Date | null;
  last_seen_at: Generated<Date>;
  created_at: Generated<Date>;
}

export interface OAuthAccountsTable {
  id: Generated<number>;
  user_id: string;
  provider: string;
  provider_subject: string;
  email_at_provider: string | null;
  profile_json: Record<string, unknown>;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface OAuthStateTokensTable {
  state: string;
  provider: string;
  code_verifier: string;
  redirect_uri: string;
  requested_by_ip: string | null;
  expires_at: Date;
  consumed_at: Date | null;
  created_at: Generated<Date>;
}

export interface ProjectsTable {
  id: string;
  user_id: string;
  name: string | null;
  status: Generated<'active' | 'archived'>;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface ApiServicesTable {
  id: string;
  key: string;
  label: string;
  base_url: string;
  resource_path: string;
  access_mode: string;
  timeout_ms: number;
  retry_count: number;
  request_method: string;
  request_template_json: Record<string, unknown>;
  request_mapping_rules_json: unknown;
  request_headers_template_json: Record<string, unknown>;
  token_header_name: string | null;
  token_param_name: string | null;
  response_mapping_rules_json: unknown;
  error_mapping_rules_json: unknown;
  contract_profile_version: number;
  token_ref: string | null;
  token_ciphertext: string | null;
  status: string;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface ApiServiceToolStepBindingsTable {
  id: string;
  api_service_id: string;
  tool_key: string;
  step_key: string;
  workflow_step_type: string;
  binding_status: string;
  requiredness: string;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface QuotaHistoryTable {
  id: Generated<number>;
  user_id: string;
  project_id: string | null;
  request_id: string | null;
  artifact_id: string | null;
  session_id: string | null;
  status: string;
  cost_type: Generated<string>;
  credit_cost: Generated<number>;
  request_count: number;
  cost_usd: number;
  input_tokens: number;
  output_tokens: number;
  metadata_json: Record<string, unknown>;
  created_at: Generated<Date>;
}

export interface UserReportsTable {
  id: string;
  category: string;
  status: string;
  title: string;
  description: string;
  created_by_user_id: string;
  triaged_by_user_id: string | null;
  triaged_at: Date | null;
  closed_at: Date | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface UserReportGithubLinksTable {
  user_report_id: string;
  repository: string;
  issue_number: number;
  issue_url: string;
  published_by_user_id: string;
  published_at: Generated<Date>;
}

export interface ProductChangelogsTable {
  id: string;
  title: string;
  body: string;
  status: string;
  created_by_user_id: string;
  published_by_user_id: string | null;
  published_at: Date | null;
  archived_by_user_id: string | null;
  archived_at: Date | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface LlmModelsTable {
  id: string;
  key: string;
  label: string;
  status: string;
  is_default: boolean;
  sort_order: number | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface RequestIdempotencyTable {
  id: Generated<number>;
  user_id: string;
  project_id: string;
  endpoint: string;
  idempotency_key: string;
  status: string;
  artifact_id: string | null;
  content: string;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

// =====================================================================
// Asset Domain Tables (DDD-188 through DDD-207)
// =====================================================================

export interface AssetsTable {
  id: string;
  project_id: string;
  asset_type: string;
  source: string;
  source_artifact_id: string | null;
  status: string;
  content: string;
  label: string;
  current_version: number;
  stale_upstream: boolean;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface AssetGroupsTable {
  id: string;
  project_id: string;
  label: string;
  group_usage: string;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface AssetGroupMembersTable {
  group_id: string;
  asset_id: string;
  position: number;
  created_at: Generated<Date>;
}

export interface AssetVersionsTable {
  id: Generated<number>;
  asset_id: string;
  version_number: number;
  content: string;
  source_artifact_id: string | null;
  created_at: Generated<Date>;
}

export interface AssetDerivationChainsTable {
  id: Generated<number>;
  upstream_asset_id: string;
  upstream_version: number;
  downstream_asset_id: string;
  tool_key: string;
  session_id: string;
  created_at: Generated<Date>;
}

export interface GenerationFeedbackTable {
  id: Generated<number>;
  artifact_id: string;
  user_id: string;
  rating: string;
  comment: string | null;
  created_at: Generated<Date>;
}

export interface DB {
  artifacts: ArtifactsTable;
  users: UsersTable;
  auth_sessions: AuthSessionsTable;
  oauth_accounts: OAuthAccountsTable;
  oauth_state_tokens: OAuthStateTokensTable;
  projects: ProjectsTable;
  api_services: ApiServicesTable;
  api_service_tool_step_bindings: ApiServiceToolStepBindingsTable;
  quota_history: QuotaHistoryTable;
  user_reports: UserReportsTable;
  user_report_github_links: UserReportGithubLinksTable;
  product_changelogs: ProductChangelogsTable;
  llm_models: LlmModelsTable;
  request_idempotency: RequestIdempotencyTable;
  assets: AssetsTable;
  asset_groups: AssetGroupsTable;
  asset_group_members: AssetGroupMembersTable;
  asset_versions: AssetVersionsTable;
  asset_derivation_chains: AssetDerivationChainsTable;
  generation_feedback: GenerationFeedbackTable;
}
