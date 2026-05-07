# CES Sale Operation - TLDR Handoff (2026-04-10)

เอกสารนี้คือเวอร์ชันสั้นสำหรับเปิดงานต่อใน session ใหม่

## 1) สถานะรวมตอนนี้

- Home instance ใหม่รันสำเร็จแล้ว
- service ขึ้นครบ: backend, db, frontend
- health check ผ่าน
- frontend ตอบ HTTP 200
- Production ล่าสุด deploy แล้วที่ commit `9cde255 fix(deals): prevent duplicate product rows`
- Production backend/frontend healthy หลัง deploy วันที่ 2026-05-07
- Alembic production current ล่าสุด:
  - `20260507_02 (head)`
  - `20260409_01 (head)`

## 2) Environment ที่ใช้อยู่จริง

### Production (VPS)
- Host: 187.77.156.215
- App dir ปัจจุบัน: /srv/ces_sale_operation_system
- Legacy/เอกสารเก่าบางไฟล์อาจยังพูดถึง: /root/ces_sale_operation_system
- Compose: docker-compose.prod.yml
- Env: .env.prod
- Ports: backend 8000, frontend 5173
- หมายเหตุ: ช่วง 2026-05-07 SSH จาก Codex ไป VPS ไม่เสถียรเป็นพัก ๆ (บางคำสั่ง exit 255) แต่ retry ด้วย IPv4 แล้ว deploy สำเร็จ

### Home (แยกทดลอง)
- Host: 192.168.3.185
- App dir: /srv/project-data/projects/ces_sale_operation_home
- Compose: docker-compose.v2.yml
- Env: .env.home
- Compose project: ces_sale_home
- Ports: db 5545, backend 8200, frontend 5185

## 3) ฟีเจอร์ที่เพิ่งเสร็จ

- Deals: multi-product ต่อ deal แบบ normalized table
  - ใช้ตาราง `deal_product_entries`
  - migration `20260507_02_deal_product_entries.py`
  - ห้ามกลับไปใช้ JSON column `deals.products` แบบ commit incident `83a3d80`
  - แต่ละ row เก็บ `product_system_type_id`, `probability_pct`, `expected_value`, `expected_po_date`
  - backend รวมค่า deal summary จาก rows:
    - `expected_value` = ผลรวมทุก row
    - `probability_pct` = weighted average ตาม expected value ถ้ามี value, ไม่งั้นใช้ average
    - `expected_close_date` = earliest expected PO date
- Deals UI:
  - Product / Value / Probability เป็น repeatable section
  - ถ้าเลือก product/subsystem แล้ว row อื่นจะเลือกซ้ำไม่ได้ เช่นเลือก `C-bus` ไปแล้ว option `C-bus` จะ disabled ใน row อื่น
  - frontend validate duplicate ด้วย และ backend ยัง reject duplicate ตอน save อีกชั้น
- Production deploy history ล่าสุด:
  - `0f69d6b feat(deals): add product entry rows`
  - `9cde255 fix(deals): prevent duplicate product rows`
  - Pre-deploy backup สำเร็จที่ `/root/ces_sale_operation_backups/production/20260507_135711`
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

- active backup script บน VPS ณ 2026-05-07: `/root/backup-scripts/ces-prod-backup.sh`
- active notify env: `/root/backup-scripts/backup-notify.env`
- active backup root: `/root/ces_sale_operation_backups/production`
- active cron backup: ทุกวัน 01:00
- active cron log: `/var/log/ces-prod-backup.log`
- retention: เก็บล่าสุด 3 backups
- มี Telegram notification แจ้ง backup success/failure ไปหา owner
- verified 2026-05-07: manual pre-deploy backup created `/root/ces_sale_operation_backups/production/20260507_135711`
- repository also contains newer backup scripts under `scripts/backup/`; do not assume they are installed to `/srv/ces_sale_operation_backups/scripts` on VPS
- ก่อน restore หรือเปลี่ยน path backup ให้ SSH ไปเช็ก `crontab -l | grep ces-prod-backup.sh` บน VPS ก่อนเสมอ
- รายละเอียดเต็ม: docs/PROD_BACKUP_RUNBOOK.md

## 7) ไฟล์ที่เปลี่ยนล่าสุด (สำคัญ)

- frontend/src/pages/DealsPage.tsx
- backend/app/api/deals.py
- backend/app/models/deal.py
- backend/app/models/__init__.py
- backend/app/schemas/deal.py
- backend/alembic/versions/20260507_02_deal_product_entries.py
- DEPLOYMENT.md
- DEPLOY-QUICK-START.md
- docs/PROD_BACKUP_RUNBOOK.md

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
ถ้าแก้ Deals multi-product ต่อ ให้รักษา invariant: product/system type ห้ามซ้ำใน deal/project เดียวกันทั้ง UI และ backend

---
Last updated: 2026-05-07
