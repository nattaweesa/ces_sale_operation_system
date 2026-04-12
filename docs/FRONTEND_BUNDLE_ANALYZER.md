# Frontend Bundle Analyzer

Purpose
- Generate a visual bundle report after production build.
- Track bundle growth over time and catch regressions early.

Prerequisites
- Frontend dependencies installed.
- Docker stack for Home environment running.

Run (Home environment)
1. Build with analyzer enabled:
   - docker compose -f /srv/project-data/projects/ces_sale_operation_home/docker-compose.v2.yml --env-file /srv/project-data/projects/ces_sale_operation_home/.env.home exec -T frontend npm run build:analyze
2. Report path:
   - /srv/project-data/projects/ces_sale_operation_home/frontend/dist/stats.html

What Was Added
- npm script:
  - build:analyze = tsc && ANALYZE=true vite build
- Vite plugin:
  - rollup-plugin-visualizer (treemap, gzip + brotli size)
- Output file:
  - dist/stats.html

Suggested CI Step
- Add a job that runs:
  - npm ci
  - npm run build:analyze
- Upload artifact:
  - frontend/dist/stats.html

Interpretation Tips
- Focus on the largest chunks first (currently antd-vendor).
- Compare gzip size trend release-to-release.
- Investigate sudden growth in route-level chunks.
