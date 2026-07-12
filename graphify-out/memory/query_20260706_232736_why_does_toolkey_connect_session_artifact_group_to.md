---
type: "query"
date: "2026-07-06T23:27:36.008907+00:00"
question: "Why does ToolKey connect Session Artifact Group to Generation Route Pipeline, Shared Utils, and UI primitives?"
contributor: "graphify"
source_nodes: ["packages_contracts_src_tool_workflows_toolkey", "apps_frontend_src_features_tools_machines_tool_flow_machine", "apps_backend_src_lib_runtime_auth_http_route_table"]
---

# Q: Why does ToolKey connect Session Artifact Group to Generation Route Pipeline, Shared Utils, and UI primitives?

## Answer

Expanded from original query via vocab: ['group', 'connect()', 'ToolKey', 'artifact()', 'GenerationWorkspaceProvider.tsx', '.pipeline()', 'primitives.tsx', 'route-table.ts', 'SessionSummaryDetailPage.tsx', 'shared-utils.ts']. The graph shows that ToolKey is a fundamental contract abstraction (in packages/contracts/src/tool-workflows.ts). It is widely referenced because:
1. UI Layouts & Components (like GenerationWorkspaceProvider, SessionArtifactTabs, AuthenticatedShell) use ToolKey to determine which tool configuration or form architecture to render.
2. Route Pipelines & Handlers (route-table.ts, tools-handlers.ts) rely on ToolKey as a validation and mapping boundary.
3. State Machines & Artifact Management (tool-flow.machine.ts, artifact-history.ts, step-hydration.ts) key their state and artifacts by ToolKey to isolate workflows.
Overall, ToolKey acts as the primary runtime discriminator for polymorphic behaviors across the frontend tools UI, backend orchestration, and artifact storage.

## Source Nodes

- packages_contracts_src_tool_workflows_toolkey
- apps_frontend_src_features_tools_machines_tool_flow_machine
- apps_backend_src_lib_runtime_auth_http_route_table