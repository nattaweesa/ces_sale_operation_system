# V2 Operations Quick Start

เอกสารนี้สำหรับ deploy/backup/rollback ของ V2 โดยไม่กระทบ V1

## 1) Local Run V2
```bash
docker compose -f docker-compose.v2.yml --env-file .env.v2 up -d --build
curl http://localhost:8100/health
```

## 1.1) Hardened Run V2 (No reload/dev server)
```bash
docker compose -f docker-compose.v2.yml -f docker-compose.v2.hardened.yml --env-file .env.v2 up -d --build
curl http://localhost:8100/health
```

## 2) Deploy V2 to VPS
> ต้องมี `.env.v2` อยู่ใน `/root/ces_sale_operation_v2` บน VPS ก่อน

```bash
./scripts/deploy-v2.sh build
```

Bundle quality gate and report export (default enabled):
```bash
BUNDLE_GATE=1 MAX_CHUNK_KB=1200 EXPORT_BUNDLE_ARTIFACT=1 ./scripts/deploy-v2.sh build
```

Generated report (local):
- `deploy_artifacts/bundle-reports/v2_stats_<timestamp>_<sha>.html`

หลัง deploy:
- Frontend V2: http://187.77.156.215:5175
- Backend V2: http://187.77.156.215:8100

## 3) Backup V2
```bash
./scripts/backup-v2.sh
```
หรือระบุชื่อ backup
```bash
./scripts/backup-v2.sh release_20260407
```

## 4) Rollback V2
rollback ล่าสุด
```bash
./scripts/rollback-v2.sh latest
```
rollback ตามชื่อ backup
```bash
./scripts/rollback-v2.sh release_20260407
```

## 5) Important Notes
- สคริปต์ V2 ทุกตัวใช้ path แยก: `/root/ces_sale_operation_v2`
- DB backup/restore ของ V2 เท่านั้น
- ไม่ใช้ compose/env ของ V1
- `deploy-v2.sh` จะรัน `npm run build:analyze` + `npm run check:bundle` ใน frontend container เมื่อ `BUNDLE_GATE=1`
- ใช้ `docker-compose.v2.hardened.yml` เมื่ออยากลดความเสี่ยงจาก dev-mode (`--reload`, `npm run dev`) ใน runtime

## 6) VA Scan + Hardening Check (Home)
รัน scan แบบเร็วและเก็บ artifact:
```bash
chmod +x scripts/security/va-scan-home.sh
./scripts/security/va-scan-home.sh
```

ผลลัพธ์จะถูกเก็บไว้ที่:
- `deploy_artifacts/security/<timestamp>_compose_ps.txt`
- `deploy_artifacts/security/<timestamp>_health.txt`
- `deploy_artifacts/security/<timestamp>_backend_headers.txt`
- `deploy_artifacts/security/<timestamp>_frontend_npm_audit.json`
- `deploy_artifacts/security/<timestamp>_backend_pip_check.txt`
- `deploy_artifacts/security/<timestamp>_backend_pip_audit.json`
- `deploy_artifacts/security/<timestamp>_backend_pip_audit.log`
- `deploy_artifacts/security/<timestamp>_hardening_checks.txt`
