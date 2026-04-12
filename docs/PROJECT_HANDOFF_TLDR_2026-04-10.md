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
- App dir: /root/ces_sale_operation_system
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

## 5) คำสั่งเร็วที่ใช้ประจำ (Home)

- cd /srv/project-data/projects/ces_sale_operation_home
- docker compose -f docker-compose.v2.yml --env-file .env.home ps
- docker compose -f docker-compose.v2.yml --env-file .env.home logs -f backend
- docker compose -f docker-compose.v2.yml --env-file .env.home up -d --build
- curl -sS http://localhost:8200/health
- curl -I http://localhost:5185/

## 6) Backup/Restore (Production)

- backup script: /root/backup-scripts/ces-prod-backup.sh
- restore script: /root/backup-scripts/ces-prod-restore.sh
- cron backup: ทุกวัน 01:00
- log: /var/log/ces-prod-backup.log
- backup root: /root/ces_sale_operation_backups/production

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
ถ้าทำบน Production ให้เช็ก SSH และ service health ก่อน deploy
หลังแก้ local ต้อง deploy และ verify บนเครื่องเป้าหมายทุกครั้ง

---
Last updated: 2026-04-10
