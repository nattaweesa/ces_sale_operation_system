# Security Handoff (Agent-Friendly)

Purpose: quick onboarding for any new engineer or agent to understand current security posture and continue work safely.

## 1) Current Security Baseline

- Backend VA scan (`pip-audit`): 0 known vulnerabilities
- Frontend VA scan (`npm audit`): 0 vulnerabilities
- Backend runtime headers: enabled
- CORS: tightened by environment
- Health checks: backend and frontend return HTTP 200

## 2) What Was Hardened

### Backend security headers
Implemented in `backend/app/main.py` via `SecurityHeadersMiddleware`:
- X-Content-Type-Options: nosniff
- X-Frame-Options: DENY
- Referrer-Policy: strict-origin-when-cross-origin
- Permissions-Policy: geolocation=(), microphone=(), camera=()
- Cross-Origin-Opener-Policy: same-origin
- Cross-Origin-Resource-Policy: same-site

### CORS policy tightening
Implemented in `backend/app/main.py`:
- Production: allow only configured frontend origin
- Non-production: also allow localhost dev origins
- Explicit methods only (no wildcard)

### Dependency remediation
Implemented in `backend/requirements.txt` and `backend/Dockerfile`:
- fastapi==0.124.4
- starlette==0.49.3
- pip==26.0.1 (image build)
- plus upgrades for jose, multipart, jinja2, pypdf, pillow, weasyprint, pydyf

### VA automation
Implemented in `scripts/security/va-scan-home.sh`:
- Captures compose status, health, headers
- Runs frontend npm audit
- Runs backend pip check + pip-audit
- Stores artifacts under `deploy_artifacts/security/`

## 3) Source of Truth Files

- `backend/app/main.py`
- `backend/requirements.txt`
- `backend/Dockerfile`
- `scripts/security/va-scan-home.sh`
- `docker-compose.v2.hardened.yml`
- `docs/SECURITY_SUMMARY_2026-04-12.md`
- `docs/VA_HARDENING_REPORT_2026-04-12.md`

## 4) Verify Baseline (copy/paste)

From repository root:

```bash
# 1) Ensure stack is running

docker compose -f docker-compose.v2.yml --env-file .env.home up -d

# 2) Health checks
curl -s -o /dev/null -w "frontend=%{http_code}\n" http://localhost:5185/
curl -s -o /dev/null -w "backend=%{http_code}\n" http://localhost:8200/health

# 3) Security headers snapshot
curl -sSI http://localhost:8200/health | grep -Ei "x-content-type-options|x-frame-options|referrer-policy|permissions-policy|cross-origin-opener-policy|cross-origin-resource-policy"

# 4) Full VA scan and artifacts
./scripts/security/va-scan-home.sh
```

## 5) Safe Operating Rules For Next Agent

- Keep `starlette` pinned at secure patch level (>= 0.49.1).
- If bumping `fastapi`, run a full regression on auth/upload/pdf flows.
- Do not loosen CORS wildcard methods/origins in production.
- Do not remove security headers middleware.
- Always attach VA artifacts for each security change.

## 6) Known Non-Security Noise

- SQLAlchemy mapper warning about relationship overlap appears in logs.
- This is not a VA finding, but should be cleaned later for log hygiene.

## 7) Recommended Next Steps

1. Enforce VA gates in CI (fail build when vulnerability threshold is exceeded).
2. Add automated regression tests for auth, upload, and PDF generation.
3. Keep monthly dependency refresh with the same verification checklist.
