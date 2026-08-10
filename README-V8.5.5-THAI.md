# Tum Pa Guay POS V8.5.5 — Multi-device Safety + Realtime Sync

## สิ่งที่เพิ่ม
- ล็อกเฉพาะตูบที่กำลังแก้ไข: 1 ตูบ = 1 อุปกรณ์แก้ไขในเวลาเดียวกัน
- มือถือและคอมทำงานคนละตูบพร้อมกันได้
- แสดง 🔒 พร้อมชื่อ `Mobile POS` / `Computer POS` เมื่ออีกเครื่องกำลังใช้งานตูบนั้น
- Lock ต่ออายุอัตโนมัติทุก 30 วินาที และหมดอายุเองเมื่อเครื่องหลุด/ปิดไปประมาณ 2 นาที
- Realtime Sync สำหรับ Orders, Order Items และสถานะ Lock
- ป้องกันฐานข้อมูลไม่ให้มีบิลที่ยังเปิดซ้ำ 2 บิลในตูบเดียวกัน
- ป้องกัน Payment ซ้ำสำหรับบิลเดียวกัน

## สำคัญ — ต้อง Run SQL 1 ครั้ง
ก่อนใช้ V8.5.5 หลายเครื่อง ให้เปิด Supabase > SQL Editor แล้ว Run ไฟล์:

`V8.5.5-MULTI-DEVICE.sql`

จากนั้นอัปโหลดไฟล์ V8.5.5 ขึ้น GitHub และเปิด/ปิด PWA ใหม่หนึ่งครั้ง

## GitHub Desktop Summary
`Upgrade to V8.5.5 Multi-device Safety + Realtime Sync`
