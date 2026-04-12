# VA Scan + Hardening Report (2026-04-12)

Scope
- Environment: Home stack (`docker-compose.v2.yml` + `.env.home`)
- Focus: dependency vulnerabilities + runtime hardening posture

Implemented Hardening
- Backend security headers middleware added:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy: geolocation=(), microphone=(), camera=()`
  - `Cross-Origin-Opener-Policy: same-origin`
  - `Cross-Origin-Resource-Policy: same-site`
- CORS policy tightened:
  - Production allows only configured `FRONTEND_ORIGIN`
  - Non-production keeps localhost developer origins
  - Allowed methods reduced from wildcard to explicit methods
- Added VA automation script:
  - `scripts/security/va-scan-home.sh`
- Added hardened compose override:
  - `docker-compose.v2.hardened.yml` (no `--reload`, no frontend dev server)

Dependency Remediation Applied (Backend)
- fastapi: `0.111.0` -> `0.115.12`
- python-jose: `3.3.0` -> `3.5.0`
- python-multipart: `0.0.9` -> `0.0.22`
- jinja2: `3.1.4` -> `3.1.6`
- pypdf: `4.2.0` -> `6.10.0`
- pillow: `10.3.0` -> `12.1.1`
- weasyprint: `61.2` -> `68.0`
- pydyf: `0.9.0` -> `0.11.0`
- pip in backend image upgraded to `25.3`

VA Results (Backend pip-audit)
- Before remediation: `33 vulnerabilities in 8 packages`
- After remediation: `3 vulnerabilities in 2 packages`
  - `starlette@0.46.2` (2 vulns; fixed in `0.47.2`/`0.49.1`)
  - `pip@25.3` (1 vuln; fixed in `26.0`)

VA Results (Frontend npm audit)
- Current state: `0 vulnerabilities`

Runtime Validation
- Frontend: HTTP 200 on `http://localhost:5185`
- Backend health: HTTP 200 on `http://localhost:8200/health`
- Security headers present in backend response headers capture artifact

Artifacts
- Directory: `deploy_artifacts/security/`
- Latest run prefix at report time: `20260412_044041`

Residual Risk and Next Actions
1. Starlette advisories remain because current FastAPI pin line resolves to `starlette<0.47.0`.
2. To fully clear Starlette findings, plan controlled framework upgrade to a FastAPI release line that supports Starlette >= `0.49.1` and update `pydantic` pin accordingly.
3. Optional: move backend base image/tooling to pip `26.x` after compatibility check.
4. Run regression suite for file upload, auth, and PDF-generation paths after framework bump.
