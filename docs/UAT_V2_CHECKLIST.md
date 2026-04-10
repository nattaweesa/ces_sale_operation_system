# UAT Checklist for V2

เป้าหมาย: ยืนยันว่า V2 พร้อมใช้งานจริงโดยไม่กระทบ V1

## Environment Verification
- [ ] V1 ยังออนไลน์ปกติ (frontend 5173, backend 8000)
- [ ] V2 ออนไลน์แยกพอร์ต (frontend 5175, backend 8100)
- [ ] V2 DB แยกจาก V1 (port 5435, db name v2)
- [ ] V2 storage แยกจาก V1

## Auth & Access
- [ ] Login V2 ด้วย admin สำเร็จ
- [ ] Role-based access ของ V2 ทำงานถูกต้อง
- [ ] Token refresh/expiry ตามที่คาด

## Core Business Flow (V2)
- [ ] สร้าง BOQ revision จาก BOQ สำเร็จ
- [ ] สร้าง pricing session สำเร็จ
- [ ] แก้ไข line price/discount ได้ตอน draft
- [ ] Finalize session แล้วแก้ไขไม่ได้
- [ ] Issue quotation จาก session ที่ finalized สำเร็จ
- [ ] Snapshot ถูกสร้างและอ่านย้อนหลังได้
- [ ] totals ของ pricing และ quotation ตรงกัน

## Data Integrity
- [ ] สร้างข้อมูลใน V2 แล้ว V1 ไม่เห็นข้อมูลใหม่
- [ ] ลบ/แก้ไขใน V2 ไม่กระทบข้อมูล V1
- [ ] Migration ของ V2 รันซ้ำได้โดยไม่พัง

## Operational Readiness
- [ ] Backup V2 ทำงานผ่าน
- [ ] Restore/Rollback V2 ผ่าน dry-run
- [ ] Deploy ซ้ำ (idempotent) โดยไม่แตะ V1
- [ ] Health endpoint ผ่านหลัง deploy

## Sign-off
- [ ] Product owner sign-off
- [ ] Tech lead sign-off
- [ ] วันเวลาที่พร้อมขึ้น Production V2
