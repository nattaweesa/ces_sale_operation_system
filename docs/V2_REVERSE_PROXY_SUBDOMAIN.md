# V2 Subdomain + Reverse Proxy (Nginx)

เป้าหมาย: เปิดใช้งาน V2 ผ่านโดเมนใหม่โดยไม่แตะ V1

## 1) เตรียม DNS
สร้าง A record ไปที่ IP VPS
- v2.your-domain.com -> 187.77.156.215
- api-v2.your-domain.com -> 187.77.156.215

รอ DNS propagate ก่อน (ปกติ 1-15 นาที, บางกรณีมากกว่า)

## 2) ยืนยัน V2 stack ต้องรันอยู่ก่อน
บน VPS ต้องมี
- frontend v2 ที่ port 5175
- backend v2 ที่ port 8100

## 3) รันสคริปต์ตั้งค่า reverse proxy + TLS
จากเครื่อง local
```bash
./scripts/setup-v2-reverse-proxy.sh \
  --web v2.your-domain.com \
  --api api-v2.your-domain.com \
  --email admin@your-domain.com
```

## 4) ตรวจผล
- https://v2.your-domain.com
- https://api-v2.your-domain.com/health

## Notes สำคัญ
- config นี้ผูกเฉพาะ 2 subdomain ของ V2
- ไม่แก้ server_name ของ V1
- ไม่แก้ compose/env ของ V1
