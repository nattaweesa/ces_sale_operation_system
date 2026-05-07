# CES Sale Operation - Project Handoff (2026-04-10)

เอกสารนี้ทำไว้สำหรับใช้เปิด session ใหม่แล้วให้ assistant ตัวใหม่อ่านต่อได้ทันที

## 1) ภาพรวมโปรเจกต์

ระบบ CES Sale Operation แบ่งเป็น 3 ส่วนหลัก:
- Backend: FastAPI + SQLAlchemy + Alembic
- Frontend: React + Vite + TypeScript
- Database: PostgreSQL

รันด้วย Docker Compose เป็นหลัก และมีหลายสภาพแวดล้อมแยกกันชัดเจน

## 2) โครงสร้าง environment ที่ใช้งานจริง

### A) Production (VPS)
- โฮสต์: 187.77.156.215
- โฟลเดอร์โปรเจกต์ปัจจุบัน: /srv/ces_sale_operation_system
- โฟลเดอร์ legacy/เอกสารเก่าบางจุดอาจยังพูดถึง: /root/ces_sale_operation_system
- compose file: docker-compose.prod.yml
- env file: .env.prod
- พอร์ตหลัก:
  - Backend: 8000
  - Frontend: 5173

หมายเหตุ:
- ช่วงท้ายมีปัญหาเชื่อม SSH ไป VPS ไม่เสถียร (หลายคำสั่ง exit 255)
- แต่ก่อนหน้านี้ deploy งานสำคัญสำเร็จแล้ว
- เวลาเช็ก production ให้ดู path `/srv/ces_sale_operation_system` ก่อนเสมอ

### B) Home instance ใหม่ (แยกจาก prod)
- โฮสต์: 192.168.3.185 (modlab04)
- โฟลเดอร์โปรเจกต์: /srv/project-data/projects/ces_sale_operation_home
- compose file: docker-compose.v2.yml
- env file: .env.home
- COMPOSE_PROJECT_NAME: ces_sale_home
- พอร์ต:
  - DB: 5545
  - Backend: 8200
  - Frontend: 5185

สถานะล่าสุด: ขึ้นครบและใช้งานได้
- backend: healthy
- db: healthy
- frontend: up
- /health ตอบ {"status":"ok"}
- หน้า frontend ตอบ HTTP 200

## 3) ฟีเจอร์ที่เพิ่งทำเสร็จ (สำคัญ)

### Deals / Sales Funnel
- เพิ่ม owner filter ในหน้า Sales Funnel
- เพิ่ม owner filter ในหน้า Executive Dashboard (เก็บไว้ทั้งสองหน้า)
- จำกัด owner dropdown ให้แสดงเฉพาะ role sales และ manager
- แสดง owner badge บน deal card (ชื่อ + สีแยกตาม owner)

### User Management
- หน้า Users มีปุ่ม:
  - activate/deactivate
  - delete user
- Backend มี DELETE /users/{user_id} พร้อม guardrails:
  - admin-only
  - ห้ามลบตัวเอง
  - ห้ามลบ user ที่ยังมี deals เป็นเจ้าของ

## 4) จุดที่ต้องรู้ก่อนเริ่มงานต่อ

### Login บน instance ใหม่
ถ้าเป็น production-like env และฐานข้อมูลใหม่ว่าง ระบบจะไม่ seed admin อัตโนมัติ
เพราะใน backend/app/main.py มีเงื่อนไข seed เฉพาะ non-production

อาการ:
- หน้าเว็บขึ้นได้ แต่ login ไม่ผ่าน (Invalid credentials)

ทางแก้เร็ว:
- สร้าง/รีเซ็ต admin ผ่านคำสั่งใน backend container
- ตั้งให้ is_active=true

### Production model/migration safety

ถ้างานแตะ SQLAlchemy model, Pydantic schema, Alembic migration, หรือ API response shape:
- ต้องทดสอบกับข้อมูลเก่าใน DB ที่มีอยู่แล้ว ไม่ใช่แค่ row ใหม่
- field ใหม่ที่เป็น list/dict ต้องรองรับ `NULL` หรือ migration ต้อง backfill ให้ครบ
- deploy script รัน `alembic upgrade heads` เท่านั้น ไม่ได้ downgrade ให้เอง
- rollback ด้วย git อย่างเดียวไม่พอถ้า migration ถูก apply ไปแล้ว
- หลัง deploy/rollback ต้องเช็กทั้ง git commit, Alembic current, schema จริง และ endpoint ที่เกี่ยวข้อง

Incident ล่าสุด 2026-05-07:
- commit พัง: `83a3d80 feat(deal): support multi-product per deal (products array) + migration`
- อาการ: `GET /deals` 500 เพราะ `DealOut.products` ต้องเป็น list แต่ row เก่าเป็น `NULL`
- recovery: downgrade `20260507_01 -> 20260505_01`, reset VPS ไป `origin/main` commit `20a2863`, rebuild backend, run `alembic upgrade heads`

## 5) คำสั่งมาตรฐานที่ใช้บ่อย

### Home instance (เครื่อง 192.168.3.185)

เข้าโฟลเดอร์:
```bash
cd /srv/project-data/projects/ces_sale_operation_home
```

ดูสถานะ:
```bash
docker compose -f docker-compose.v2.yml --env-file .env.home ps
```

ดู log:
```bash
docker compose -f docker-compose.v2.yml --env-file .env.home logs -f backend
docker compose -f docker-compose.v2.yml --env-file .env.home logs -f frontend
```

build + up:
```bash
docker compose -f docker-compose.v2.yml --env-file .env.home up -d --build
```

health check:
```bash
curl -sS http://localhost:8200/health
curl -I http://localhost:5185/
```

### Production (VPS)

```bash
cd /srv/ces_sale_operation_system
docker compose -f docker-compose.prod.yml --env-file .env.prod ps
docker compose -f docker-compose.prod.yml --env-file .env.prod logs -f backend
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

เช็ก migration/schema ก่อนและหลังงาน database:
```bash
cd /srv/ces_sale_operation_system
COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.prod"
docker exec $($COMPOSE ps -q backend) alembic current
docker exec $($COMPOSE ps -q backend) alembic heads
docker exec $($COMPOSE ps -q db) psql -U ces -d ces_sale_operation -c "\d deals"
curl -fsS http://localhost:8000/health
curl -i http://localhost:8000/deals
```

หมายเหตุ: `curl -i http://localhost:8000/deals` โดยไม่มี token ควรได้ 401 ไม่ใช่ 500

## 6) สคริปต์ backup/restore ที่ตั้งไว้บน VPS แล้ว

อยู่ที่:
- /srv/ces_sale_operation_backups/scripts/ces-prod-backup.sh
- /srv/ces_sale_operation_backups/scripts/ces-prod-restore.sh

cron:
- รัน backup ทุกวันเวลา 01:00
- log: /srv/ces_sale_operation_backups/ces-prod-backup.log

backup root:
- /srv/ces_sale_operation_backups/production
- เก็บล่าสุด 3 backups
- มี Telegram notification แจ้ง backup success/failure ไปหา owner
- ข้อความ Telegram ล่าสุดยังแสดง backup dir ใต้ `/root/ces_sale_operation_backups/production/...`
- ก่อน restore หรือเปลี่ยน path backup ให้เช็ก cron จริงบน VPS ก่อน:
  `crontab -l | grep ces-prod-backup.sh`
- ดูรายละเอียดเต็มใน docs/PROD_BACKUP_RUNBOOK.md

## 7) Checklist สำหรับเปิด session ใหม่ (copy ไปให้ agent ใหม่ได้เลย)

1. อ่านเอกสารนี้ก่อน
2. ยืนยันว่าจะทำงานกับ environment ไหน:
   - Production VPS
   - Home instance
3. ถ้าทำงานกับ Home instance ให้เช็กก่อนว่า login ได้
4. ถ้าทำงานกับ Production ให้เช็ก SSH, service health, current git commit, และ Alembic current ก่อน deploy
5. หลังแก้โค้ด local แล้ว deploy ไป environment เป้าหมายและ verify ทุกครั้ง
6. ถ้างานแตะ DB migration ให้เช็ก schema จริงและ endpoint ที่เกี่ยวข้องก่อนบอกว่างานจบ

## 8) Troubleshooting เร็ว

### กรณี login ไม่ได้บน instance ใหม่
- เช็กว่ามี user ในตาราง users หรือไม่
- เช็ก is_active ของ user
- รีเซ็ตรหัสผ่าน admin จาก backend container

### กรณี compose build มีปัญหา buildx permission
อาการที่เคยเจอ:
- open ~/.docker/buildx/.lock: permission denied

แนวแก้:
```bash
chown -R <user>:<user> ~/.docker
COMPOSE_BAKE=false docker compose -f docker-compose.v2.yml --env-file .env.home up -d --build
```

## 9) ไฟล์โค้ดสำคัญที่แก้ล่าสุด

- frontend/src/pages/DealsPage.tsx
- frontend/src/pages/DealsDashboardPage.tsx
- frontend/src/pages/UsersPage.tsx
- frontend/src/api/index.ts
- backend/app/api/deals.py
- backend/app/api/users.py

## 10) Access URLs (Home instance)

- Frontend: http://192.168.3.185:5185
- Backend health: http://192.168.3.185:8200/health

---

Last updated: 2026-04-10
Owner/context: Nattawee
