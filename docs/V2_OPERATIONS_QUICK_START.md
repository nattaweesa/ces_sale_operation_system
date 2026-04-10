# V2 Operations Quick Start

เอกสารนี้สำหรับ deploy/backup/rollback ของ V2 โดยไม่กระทบ V1

## 1) Local Run V2
```bash
docker compose -f docker-compose.v2.yml --env-file .env.v2 up -d --build
curl http://localhost:8100/health
```

## 2) Deploy V2 to VPS
> ต้องมี `.env.v2` อยู่ใน `/root/ces_sale_operation_v2` บน VPS ก่อน

```bash
./scripts/deploy-v2.sh build
```

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
