# Gate 004 Diff Summary

Documentation and governance updates:
- README repository map switched to apps/* and packages/* ownership
- docs/index-overview links updated for moved plans and frontend/backend paths
- docs/02-design/adr/frontend-data-access-layer-adr.md includes monorepo boundary addendum
- plan documents relocated to docs/03-development/plans/

CI updates:
- backend-gate workflow now targets apps/backend and packages/infra-db/contracts
- main-pr-gate workflow now targets apps/frontend and runs workspace commands from root
