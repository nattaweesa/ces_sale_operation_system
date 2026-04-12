# Home Frontend Performance Baseline (2026-04-12)

Environment
- Workspace: /srv/project-data/projects/ces_sale_operation_home
- Frontend service: docker compose v2 profile (.env.home)
- Build toolchain: vite 7.3.2, @vitejs/plugin-react 5.1.0

Changes Applied
- Route-level lazy loading for page components in src/App.tsx
- Removed dynamic import conflict in MaterialApproval page by using static API client import
- Build chunking kept with explicit vendor chunk groups in vite.config.ts
- chunkSizeWarningLimit set to 1200 for AntD-heavy bundle profile

Validation Commands
- npm run build (inside frontend container)
- npm audit --json (inside frontend container)
- curl http://localhost:5185 (host check)

Validation Results
- Build: PASS
- Security audit: 0 vulnerabilities (high/critical/moderate/low all 0)
- Frontend health: HTTP 200

Build Output Snapshot
- dist/assets/index-Ch0u5921.js: 70.14 kB (gzip 25.14 kB)
- dist/assets/react-vendor-BRW-c55D.js: 160.58 kB (gzip 52.75 kB)
- dist/assets/antd-vendor-CwERNInP.js: 1,077.96 kB (gzip 339.25 kB)
- Largest route chunks:
  - AIChatPage-hDcq7Xg2.js: 164.44 kB (gzip 49.99 kB)
  - DealsPage-BbF7nnov.js: 22.99 kB (gzip 6.70 kB)
  - QuotationDetailPage-zlx4YN_d.js: 11.99 kB (gzip 3.92 kB)

Observations
- Initial route payload improved due lazy-loaded page modules.
- Ant Design vendor chunk remains dominant and is expected for this stack.
- No functional regression found in smoke checks.

Next Optimization Candidates
- Split heavy features with nested lazy boundaries (e.g., AI chat panels, rich tables)
- Evaluate targeted AntD import strategy where practical
- Add bundle analyzer in CI to compare build deltas per release
