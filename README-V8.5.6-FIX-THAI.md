# V8.5.6 Fix – Mobile Button Actions

แก้จาก V8.5.5.3 โดยเฉพาะปุ่มบนมือถือที่แสดงแต่กดแล้วไม่ทำงาน

- `🧾 ພິມບິນກວດສອບ` → บันทึก order เป็น ready_to_pay และเปิด CHECK BILL สำหรับ Print/Share
- `💰 ຄິດເງິນຈາກມືຖື` → บันทึก order และเปิดหน้ารับเงิน
- รักษา Fast Lock Release / Multi-device เดิม
- ไม่เกี่ยวข้องกับ Stock V1.1.2
- ไม่ต้อง Run SQL ใหม่

หลังอัปโหลด GitHub Pages แนะนำปิดหน้าเว็บเดิมแล้วเปิดใหม่ หากยังเห็นเวอร์ชันเก่าให้ refresh เพื่อให้ Service Worker โหลดไฟล์ V8.5.6 ใหม่
