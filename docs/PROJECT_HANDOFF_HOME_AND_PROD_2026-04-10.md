# CES Sale Operation - Project Handoff (2026-04-10)

เอกสารนี้ทำไว้สำหรับใช้เปิด session ใหม่แล้วให้ assistant ตัวใหม่อ่านต่อได้ทันที

## 1) ภาพรวมโปรเจกต์

ระบบ CES Sale Operation แบ่งเป็น 3 ส่วนหลัก:
- Backend: FastAPI + SQLAlchemy + Alembic
- Frontend: React + Vite + TypeScript
- Database: PostgreSQL

รันด้วย Docker Compose เป็นหลัก และมีหลายสภาพแวดล้อมแยกกันชัดเจน

## 2) โครงสร้าง environment ที่ใช้งานจริง

### A) Production เดิม (VPS)
- โฮสต์: 187.77.156.215
- โฟลเดอร์โปรเจกต์: /root/ces_sale_operation_system
- compose file: docker-compose.prod.yml
- env file: .env.prod
- พอร์ตหลัก:
  - Backend: 8000
  - Frontend: 5173

หมายเหตุ:
- ช่วงท้ายมีปัญหาเชื่อม SSH ไป VPS ไม่เสถียร (หลายคำสั่ง exit 255)
- แต่ก่อนหน้านี้ deploy งานสำคัญสำเร็จแล้ว

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
cd /root/ces_sale_operation_system
docker compose -f docker-compose.prod.yml --env-file .env.prod ps
docker compose -f docker-compose.prod.yml --env-file .env.prod logs -f backend
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

## 6) สคริปต์ backup/restore ที่ตั้งไว้บน VPS แล้ว

อยู่ที่:
- /root/backup-scripts/ces-prod-backup.sh
- /root/backup-scripts/ces-prod-restore.sh

cron:
- รัน backup ทุกวันเวลา 01:00
- log: /var/log/ces-prod-backup.log

backup root:
- /root/ces_sale_operation_backups/production

## 7) Checklist สำหรับเปิด session ใหม่ (copy ไปให้ agent ใหม่ได้เลย)

1. อ่านเอกสารนี้ก่อน
2. ยืนยันว่าจะทำงานกับ environment ไหน:
   - Production VPS
   - Home instance
3. ถ้าทำงานกับ Home instance ให้เช็กก่อนว่า login ได้
4. ถ้าทำงานกับ Production ให้เช็ก SSH และ service health ก่อน deploy
5. หลังแก้โค้ด local แล้ว deploy ไป environment เป้าหมายและ verify ทุกครั้ง

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
