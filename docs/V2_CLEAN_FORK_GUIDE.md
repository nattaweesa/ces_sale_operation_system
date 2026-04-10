# V2 Clean Fork Guide

เป้าหมาย: แยก V2 เป็นระบบใหม่ทั้งหมด โดยคง Frontend ปัจจุบันเป็นฐานเดิม และไม่กระทบ V1 ที่ใช้อยู่

## Scope ที่ตกลงกัน
- Frontend: ใช้ของเดิมได้ ไม่ต้อง rewrite
- Backend API: ปรับ/เพิ่มได้เต็มที่
- Database: ออกแบบใหม่หรือ migrate ใหม่ได้
- Deployment: แยกเส้นทางใหม่ทั้งหมด (ไม่ deploy ทับ V1)

## Target Architecture
- V1 (เดิม):
  - Frontend 5173
  - Backend 8000
  - DB เดิม
- V2 (ใหม่):
  - Frontend 5175
  - Backend 8100
  - DB ใหม่ (แยกชื่อ DB + volume)

## Non-Negotiable Rules
1. ห้ามใช้ DB เดียวกับ V1
2. ห้ามใช้ storage path เดียวกับ V1
3. ห้ามใช้ compose/env/deploy script ชุดเดียวกับ V1
4. ห้ามแก้ path VPS เดิมของ V1

## Execution Plan
1. สร้าง V2 clean fork จากโค้ดปัจจุบัน
2. ตั้งชื่อโครงการใหม่ + env ใหม่ + compose ใหม่
3. ตั้ง DB ใหม่และรัน migration ใหม่เฉพาะ V2
4. Functional test ให้ครบใน V2
5. Deploy ขึ้น VPS path ใหม่
6. ตรวจ smoke test และ health check

## Suggested Branching
- Repo ใหม่: แนะนำมากสุด
- ถ้าต้องอยู่ repo เดียวชั่วคราว:
  - branch `v2/main`
  - ห้าม merge เข้าสาย V1 จนกว่าจะพร้อม cutover

## Cutover Strategy (ภายหลัง)
1. Run V1+V2 คู่ขนาน
2. ให้ผู้ใช้บางกลุ่มทดสอบ V2
3. สรุป defect + fix
4. ค่อยตัดสินใจ cutover

## Done Criteria สำหรับ V2
- `/health` ผ่าน
- login ผ่าน
- flow BOQ->Pricing->Quotation ผ่าน end-to-end
- backup/rollback script ของ V2 ผ่าน dry-run
- deploy ซ้ำได้โดยไม่แตะ V1
