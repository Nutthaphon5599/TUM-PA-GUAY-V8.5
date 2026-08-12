# Tum Pa Guay POS V8.5.5.2 — Mobile Checkout & Customer Bill

พัฒนาต่อจาก **V8.5.5.1 Fast Lock Release เท่านั้น**
ไม่เกี่ยวข้องกับ Tum Pa Guay Stock V1.1.2

## สิ่งที่เพิ่ม
- มือถือกด `บิล` แล้วเพิ่ม/ลด/ลบอาหารได้เหมือนเดิม
- เพิ่มปุ่มใหญ่ `💰 ຄິດເງິນຈາກມືຖື`
- ปุ่มนี้ใช้ระบบ Pending Payment + Multi-device Lock เดิมของ V8.5.5.1
- เปิดหน้ารับชำระเงินบนมือถือได้
- เลือก Cash / Bank Transfer / QR / Other
- กรอกเงินรับและคำนวณเงินทอน
- กดยืนยันแล้วปิดบิลและแสดง Receipt 80mm
- Receipt แสดงวิธีชำระ, เงินรับ และเงินทอน
- บนมือถือซ่อน QZ Direct Print เพราะ QZ Tray เป็น desktop workflow
- ปุ่ม `ພິມ / Share Bill` ใช้ Browser/System Print ของ iPhone/Android
- Desktop ยังคง QZ Tray / SL-253 เหมือนเดิม
- ไม่เปลี่ยนระบบ Stock ใด ๆ

## Supabase
ไม่ต้อง Run SQL ใหม่ ถ้า V8.5.5.1 และ SQL Multi-device/Fast Lock เดิมทำงานอยู่แล้ว

## Test
1. เปิด POS บนมือถือ
2. เลือกโต๊ะและเพิ่มอาหาร
3. กด `บิล`
4. กด `ຄິດເງິນຈາກມືຖື`
5. เลือกวิธีชำระ/กรอกเงินรับ
6. กด Confirm
7. ต้องขึ้น Receipt
8. กด `ພິມ / Share Bill`
9. บน iPhone/Android จะเปิดหน้าพิมพ์/แชร์ของระบบ

หมายเหตุ: การพิมพ์จากมือถือไปเครื่องพิมพ์จริงขึ้นอยู่กับเครื่องพิมพ์และระบบมือถือ เช่น AirPrint/Android Print Service หรือแอปของเครื่องพิมพ์นั้น ๆ
