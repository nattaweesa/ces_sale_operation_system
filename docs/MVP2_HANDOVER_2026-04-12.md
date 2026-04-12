# MVP2 Handover - 2026-04-12

## 1) Executive Summary

วันนี้ปิดงานระดับ MVP2 ได้เรียบร้อย โดยมีการยกระดับทั้งระบบ Deals, Master Data, AI Assistant และ UX หลัก พร้อม deploy production ทุกชุดงานแล้ว

สถานะปัจจุบัน:
- Branch: main
- Production health: OK
- ล่าสุด commit: 06b2758

## 2) What Was Delivered

### 2.1 Deals / Master Data / Forecast
- เพิ่ม Deal Master Data กลาง (Customer Types, Companies, Product/System Types, Project Status, CES Stage)
- เพิ่ม Projects section ใน Deal Master Data page เพื่อจัดการ project จากศูนย์กลาง
- Deals form รองรับ Company/Project แบบ searchable dropdown
- Owner ใน New Deal default เป็นผู้ใช้งานปัจจุบันและแสดงชื่อถูกต้อง
- Forecast รองรับ Expected Value แบบ Product + Month

### 2.2 Navigation / Layout / UX
- ย้าย AI Assistant ออกจาก Admin ไปเมนูหลักใต้ Deals (ยังคงเห็นเฉพาะ Admin/Manager)
- ปรับ profile area: ย้าย role/theme ไป dropdown ด้านขวาบน
- ปรับ branding text ตามที่ตกลง

### 2.3 AI Assistant - Settings + Knowledge
- แก้ UX หน้า Admin AI Settings เรื่อง clear key ให้ไม่ลบ key โดยไม่ตั้งใจ
- เพิ่ม AI Knowledge module สำหรับอัปโหลดเอกสาร (PDF/TXT/MD/CSV/JSON/YAML)
- แยกเอกสารเป็น chunks เพื่อ retrieval ที่แม่นขึ้น
- AI ตอบพร้อม citation รูปแบบ [K1], [K2] จาก knowledge chunks

### 2.4 AI Chat History
- เก็บ chat history ลง DB แล้ว
- ปัจจุบันเป็น single conversation ต่อ user
- มี endpoint โหลด history และ clear history
- ตั้ง limit แล้ว:
  - สูงสุด 100 messages ต่อ conversation
  - retention 30 วัน

## 3) New Data Model / Migrations

- 20260412_04: ai_knowledge_documents
- 20260412_05: ai_knowledge_chunks
- 20260412_06: ai_chat_conversations + ai_chat_messages

## 4) AI Scope (Current)

AI Assistant ตอบได้จาก:
1. ข้อมูลระบบสด (Deals/Pipeline/CES Stage/Project Status)
2. ข้อมูลจาก CES AI Knowledge ที่อัปโหลด

ข้อจำกัดตอนนี้:
- ยังเป็น retrieval แบบ lexical ranking (ไม่ใช่ vector semantic search เต็มรูปแบบ)
- chat history ยังเป็นห้องเดียวต่อ user (ยังไม่มี multi-chat UI)

## 5) Key Commits (Recent)

- 06b2758 chore(ai-chat): refine UI copy to include CES AI Knowledge
- 816cf67 feat(ai-chat): persist history with per-conversation message limits
- e1b592c feat(ai-knowledge): chunk-based retrieval with citations for AI assistant
- 6634a5e feat(ai-knowledge): upload manuals for AI chat retrieval and admin management
- 59657e0 feat(nav): move AI Assistant to main menu under Deals
- 4d4b572 feat(deals): searchable company/project dropdowns + ensure owner default shows current user
- 78d48e7 feat(deal-master): add project management section and remove legacy company helper label
- e3e9392 feat(deals-forecast): support expected value allocation by product and month
- eb34427 feat(deal-master): add CES stage master data and wire deal form to dynamic stage/status options
- 41f23f8 fix(ai-settings): auto-disable clear key when new api key is entered

## 6) Code Quality / Optimization Review (Post-MVP2)

### High Impact (Recommended Next)
1. AI retrieval performance
- ปัจจุบันดึง chunk ได้สูงสุด 1500 แถวทุก query แล้วค่อย score ใน Python
- แนะนำเพิ่ม DB-level filtering/index และทำ prefilter ด้วย title/content keyword
- ระยะถัดไปใช้ pgvector + hybrid retrieval (keyword + semantic)

2. AI chat API cohesion
- ไฟล์ ai_chat endpoint มีทั้ง logic context, retrieval, history persistence อยู่รวมกัน
- แนะนำแยก service layer:
  - ai_chat_context_service
  - ai_knowledge_retrieval_service
  - ai_chat_history_service

3. Config hardcode
- ค่า MAX_MESSAGES_PER_CONVERSATION, RETENTION_DAYS, retrieval limits ควรย้ายไป settings/env

### Medium Impact
4. AI Knowledge delete behavior
- ตอนนี้ disable document แล้วลบ chunks ทันที
- ถ้าต้องการ re-enable ภายหลัง ควรเก็บ chunks ไว้แล้ว filter ด้วย is_active

5. Frontend AIChatPage complexity
- ไฟล์หน้าเดียวมี rendering + network + state management รวมกัน
- แนะนำแยก components:
  - ChatHeader
  - ChatMessageList
  - ChatInput
  - hooks/useAIChat

6. Observability
- เพิ่ม structured logs สำหรับ:
  - retrieval result count
  - context token size
  - response time per request

### Low Impact / Cleanup
7. เพิ่ม unit/integration tests สำหรับ
- chunk split
- history trim policy
- citation rendering expectations

8. เพิ่ม admin page สำหรับ tuning
- message limit
- retention days
- top-k chunk count

## 7) Suggested MVP2.1 Backlog

1. Multi-conversation UI (New Chat + chat list + rename/delete per room)
2. pgvector integration (hybrid search)
3. Service refactor for ai_chat module
4. AI Knowledge versioning + reactivate support
5. Basic telemetry dashboard for AI usage and latency

## 8) Operational Notes

- Production deploy method: docker compose prod + alembic upgrade heads
- ทุกงานที่แก้ production flow ถูก deploy และ health check ผ่านแล้ว
- ใช้แนวทาง incremental commit + immediate deploy verification

## 9) Definition of Done for MVP2

MVP2 ถือว่าปิดได้แล้ว เมื่อพิจารณาจาก:
- Deal flow + master data ใช้งานได้ครบตาม requirement ล่าสุด
- AI สามารถตอบทั้งข้อมูลระบบและ knowledge ที่อัปโหลด
- มี persisted chat history พร้อม retention/limit
- ระบบ production เสถียรและ deploy ได้ต่อเนื่อง
