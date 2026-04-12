# Security Summary (2026-04-12)

เอกสารนี้สรุปงานด้าน Security ที่ทำในรอบนี้แบบอ่านย้อนหลังได้เร็ว ครอบคลุมทั้ง hardening, dependency remediation, และผล VA scan ล่าสุด

## TL;DR

- เพิ่ม security hardening ฝั่ง backend เรียบร้อย
- ปรับ CORS ให้เข้มงวดขึ้นตาม environment
- เพิ่มสคริปต์ VA scan เพื่อรันซ้ำและเก็บ artifact ได้
- อัปเกรด dependency ที่มีช่องโหว่ทั้งสาย FastAPI/Starlette และแพ็กเกจประกอบ
- สถานะล่าสุดจาก `pip-audit` (backend): **0 known vulnerabilities**
- สถานะล่าสุดจาก `npm audit` (frontend): **0 vulnerabilities**

## 1) Runtime Hardening ที่ถูกเพิ่ม

ไฟล์หลัก: `backend/app/main.py`

สิ่งที่เพิ่ม:
- `SecurityHeadersMiddleware` พร้อม header สำคัญ:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy: geolocation=(), microphone=(), camera=()`
  - `Cross-Origin-Opener-Policy: same-origin`
  - `Cross-Origin-Resource-Policy: same-site`
- ปรับ CORS:
  - Production: อนุญาตเฉพาะ `FRONTEND_ORIGIN`
  - Non-production: อนุญาต localhost สำหรับ dev เพิ่มเติม
  - จำกัด `allow_methods` เป็น explicit methods (ไม่ใช้ wildcard)

## 2) Dependency Security Remediation

ไฟล์หลัก: `backend/requirements.txt`, `backend/Dockerfile`

เวอร์ชันสำคัญล่าสุด:
- `fastapi==0.124.4`
- `starlette==0.49.3`
- `python-jose[cryptography]==3.5.0`
- `python-multipart==0.0.22`
- `jinja2==3.1.6`
- `pypdf==6.10.0`
- `pillow==12.1.1`
- `weasyprint==68.0`
- `pydyf==0.11.0`
- `pip==26.0.1` (ใน image build)

หมายเหตุเชิงเทคนิค:
- แก้ Starlette CVE โดยขยับ FastAPI ไป line ที่รองรับ Starlette 0.49.x
- ทำให้ไม่ต้องบังคับ bump `pydantic` ทันที (ยังคง `pydantic==2.7.1`)

## 3) VA Scan Automation

ไฟล์สคริปต์: `scripts/security/va-scan-home.sh`

ความสามารถของสคริปต์:
- ตรวจสถานะ compose services
- ตรวจ health endpoint
- เก็บ response headers ฝั่ง backend
- รัน `npm audit` ฝั่ง frontend
- รัน `pip check` และ `pip-audit` ฝั่ง backend
- เก็บผลลัพธ์เป็น artifact ใต้ `deploy_artifacts/security/`

## 4) ผลลัพธ์ที่ได้ (ก่อน -> หลัง)

Backend (pip-audit):
- ก่อน remediation: `33 vulnerabilities in 8 packages`
- ระหว่างทาง: ลดเหลือ `3 vulnerabilities in 2 packages`
- ล่าสุดหลังอัปเกรด FastAPI/Starlette + pip: **`0 known vulnerabilities`**

Frontend (npm audit):
- ล่าสุด: **`0 vulnerabilities`**

## 5) CVE ที่ปิดได้ในรอบนี้

- Starlette advisory chain ที่ค้างจากเวอร์ชันเก่า (รวมกรณี `CVE-2025-62727`)
- pip tooling advisory ที่กระทบเวอร์ชัน 25.x

## 6) สถานะระบบหลังทำ

- Backend health: `HTTP 200` ที่ `/health`
- Frontend: `HTTP 200`
- OpenAPI โหลดได้ และ route หลักยังครบ

## 7) ไฟล์ที่เกี่ยวข้อง (Reference)

- `backend/app/main.py`
- `backend/requirements.txt`
- `backend/Dockerfile`
- `scripts/security/va-scan-home.sh`
- `docker-compose.v2.hardened.yml`
- `docs/VA_HARDENING_REPORT_2026-04-12.md` (รายงานรอบก่อนหน้า)
- `docs/V2_OPERATIONS_QUICK_START.md`

## 8) แนะนำรอบถัดไป

- ผูก VA scan เข้า CI/CD ให้ fail เมื่อเจอ vulnerability ระดับที่กำหนด
- แยก baseline report ต่อ environment (home/staging/prod)
- เพิ่ม regression tests อัตโนมัติสำหรับ auth/upload/pdf ก่อน deploy
