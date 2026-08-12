# Tum Pa Guay POS V8.5.5.3 — Mobile Check Bill Print

พัฒนาต่อจาก V8.5.5.1 Fast Lock Release โดยเพิ่มความสามารถ Mobile Checkout ของ V8.5.5.2 และ Mobile Check Bill Print ใน V8.5.5.3
ไม่เกี่ยวข้องกับ Tum Pa Guay Stock V1.1.2

## Workflow บนมือถือ
1. เลือกโต๊ะและเพิ่มอาหาร
2. กด `บิล`
3. กด `🧾 ພິມບິນກວດສອບ`
4. ระบบแสดง `CHECK BILL / บิลตรวจสอบก่อนคิดเงิน`
5. กด `Print / Share บิลตรวจสอบ`
6. ปิดหน้าบิลตรวจสอบและกลับมาแก้รายการอาหารได้
7. เมื่อลูกค้าตรวจถูกต้องแล้ว กด `💰 คิดเงินจากมือถือ`
8. เลือกวิธีชำระและยืนยัน
9. ระบบจึงออก `RECEIPT / ใบรับเงิน`

## ความปลอดภัยของบิลตรวจสอบ
- ไม่สร้าง Payment
- ไม่ปิด Order
- ไม่ปลดโต๊ะ
- ใช้ Multi-device Lock / Fast Lock Release เดิม
- หลังพิมพ์บิลตรวจสอบยังแก้รายการอาหารได้

## Supabase
ไม่ต้อง Run SQL ใหม่ ถ้า V8.5.5.1 ใช้งานอยู่แล้ว

## Mobile Print
บน iPhone / Android ใช้ Browser/System Print หรือ Share Sheet
การพิมพ์ลงเครื่องพิมพ์จริงขึ้นอยู่กับ AirPrint / Android Print Service / แอปของเครื่องพิมพ์
