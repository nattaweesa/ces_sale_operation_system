# CES Sale Operation - TLDR Handoff (2026-04-10)

เอกสารนี้คือเวอร์ชันสั้นสำหรับเปิดงานต่อใน session ใหม่

## 1) สถานะรวมตอนนี้

- Home instance ใหม่รันสำเร็จแล้ว
- service ขึ้นครบ: backend, db, frontend
- health check ผ่าน
- frontend ตอบ HTTP 200

## 2) Environment ที่ใช้อยู่จริง

### Production (VPS)
- Host: 187.77.156.215
- App dir ปัจจุบัน: /srv/ces_sale_operation_system
- Legacy/เอกสารเก่าบางไฟล์อาจยังพูดถึง: /root/ces_sale_operation_system
- Compose: docker-compose.prod.yml
- Env: .env.prod
- Ports: backend 8000, frontend 5173
- หมายเหตุ: ช่วงหลัง SSH ไป VPS ไม่เสถียร (หลายคำสั่ง exit 255)

### Home (แยกทดลอง)
- Host: 192.168.3.185
- App dir: /srv/project-data/projects/ces_sale_operation_home
- Compose: docker-compose.v2.yml
- Env: .env.home
- Compose project: ces_sale_home
- Ports: db 5545, backend 8200, frontend 5185

## 3) ฟีเจอร์ที่เพิ่งเสร็จ

- Owner filter ใน Sales Funnel
- Owner filter ใน Executive Dashboard
- Owner dropdown จำกัดเฉพาะ role sales และ manager
- แสดง owner badge สีแยกบน deal card
- Users page: activate/deactivate และ delete
- Backend: DELETE /users/{id} พร้อมกันพลาด (admin-only, ห้ามลบตัวเอง, ห้ามลบ user ที่ยังมี deals)

## 4) ประเด็นสำคัญที่สุดก่อนเริ่มงาน

- ถ้าเป็นฐานข้อมูลใหม่และตั้ง environment เป็น production ระบบจะไม่สร้าง admin อัตโนมัติ
- อาการคือหน้าเว็บเข้าได้แต่ login ไม่ผ่าน
- ต้องสร้างหรือรีเซ็ต user admin เองก่อน
- งานที่แตะ database model / Alembic migration ต้องระวังมากเป็นพิเศษ:
  - ห้าม rollback production ด้วย `git reset` หรือ `git push --force` อย่างเดียว
  - ต้องตรวจ `alembic current`, schema จริงใน DB, backend logs, และ health/API ที่เกี่ยวข้อง
  - ถ้า migration ถูก deploy ไปแล้ว แต่ rollback code กลับ ต้องจัดการ DB state ให้ตรงด้วย
  - สำหรับ production ให้ใช้ backup/restore rollback script เป็นหลักเมื่อไม่มั่นใจ

### Incident Note - 2026-05-07

เกิด production incident จาก commit ทดลอง `83a3d80 feat(deal): support multi-product per deal (products array) + migration`

อาการ:
- หน้า Deals / Sales Funnel เรียก `GET /deals` แล้ว backend 500
- Dashboard ยังเห็นข้อมูลบางส่วน เพราะไม่ได้ใช้ response path เดียวกัน

สาเหตุ:
- Prod code ยังอยู่ที่ commit `83a3d80` แม้ local/origin กลับไป `20a2863` แล้ว
- Migration `20260507_01` เพิ่ม column `deals.products`
- Row เก่าใน DB มี `products = NULL`
- Pydantic schema ใหม่ประกาศ `products: list[dict]` ทำให้ serialize deal เก่าแล้ว validation error

สิ่งที่แก้แล้ว:
- บน VPS path `/srv/ces_sale_operation_system`
- รัน `alembic downgrade 20260505_01` เพื่อลบ migration `20260507_01`
- `git reset --hard origin/main` กลับ commit `20a2863`
- rebuild/recreate backend container
- รัน `alembic upgrade heads`
- verified: backend healthy, `products` column ไม่มีแล้ว, `GET /deals` แบบไม่ login ตอบ 401 ไม่ใช่ 500

## 5) คำสั่งเร็วที่ใช้ประจำ (Home)

- cd /srv/project-data/projects/ces_sale_operation_home
- docker compose -f docker-compose.v2.yml --env-file .env.home ps
- docker compose -f docker-compose.v2.yml --env-file .env.home logs -f backend
- docker compose -f docker-compose.v2.yml --env-file .env.home up -d --build
- curl -sS http://localhost:8200/health
- curl -I http://localhost:5185/

## 6) Backup/Restore (Production)

- backup script: /srv/ces_sale_operation_backups/scripts/ces-prod-backup.sh
- restore script: /srv/ces_sale_operation_backups/scripts/ces-prod-restore.sh
- cron backup: ทุกวัน 01:00
- log: /srv/ces_sale_operation_backups/ces-prod-backup.log
- backup root: /srv/ces_sale_operation_backups/production
- retention: เก็บล่าสุด 3 backups
- มี Telegram notification แจ้ง backup success/failure ไปหา owner
- รูป/ข้อความล่าสุดจาก Telegram ยังแสดง backup dir ใต้ `/root/ces_sale_operation_backups/production/...`
- ก่อน restore หรือเปลี่ยน path backup ให้ SSH ไปเช็ก `crontab -l | grep ces-prod-backup.sh` บน VPS ก่อนเสมอ
- รายละเอียดเต็ม: docs/PROD_BACKUP_RUNBOOK.md

## 7) ไฟล์ที่เปลี่ยนล่าสุด (สำคัญ)

- frontend/src/pages/DealsPage.tsx
- frontend/src/pages/DealsDashboardPage.tsx
- frontend/src/pages/UsersPage.tsx
- frontend/src/api/index.ts
- backend/app/api/deals.py
- backend/app/api/users.py

## 8) URL ใช้งาน Home

- Frontend: http://192.168.3.185:5185
- Backend health: http://192.168.3.185:8200/health

## 9) Prompt สั้นสำหรับส่งต่อให้ agent ใหม่

อ่าน docs/PROJECT_HANDOFF_HOME_AND_PROD_2026-04-10.md และ docs/PROJECT_HANDOFF_TLDR_2026-04-10.md ก่อนเริ่มงาน
จากนั้นยืนยันว่าจะทำงานบน environment ไหน (Production VPS หรือ Home instance)
ถ้าทำบน Home ให้เช็ก login และ health ก่อน
ถ้าทำบน Production ให้เช็ก SSH, service health, current git commit, และ Alembic current ก่อน deploy
หลังแก้ local ต้อง deploy และ verify บนเครื่องเป้าหมายทุกครั้ง
ถ้าเกี่ยวกับ DB migration ให้ verify schema จริงและ API ที่ใช้ model นั้นโดยตรง

---
Last updated: 2026-04-10
