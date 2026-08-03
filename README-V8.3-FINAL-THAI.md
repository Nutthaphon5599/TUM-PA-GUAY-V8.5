# Tum Pa Guay Restaurant V8.3 Final — Production Ready

เวอร์ชันนี้เน้นความเสถียรและความเร็วสำหรับใช้งานจริงทั้งวัน

## ปรับปรุงหลัก
- ต่ออายุ Supabase JWT/Session อัตโนมัติ
- Retry คำขอที่ได้ 401 หลัง Refresh Session หนึ่งครั้ง
- Timeout การเชื่อมต่อเพื่อไม่ให้หน้าค้างไม่สิ้นสุด
- ตรวจ Session เมื่อกลับมาเปิดแอป, กลับจาก Sleep และอินเทอร์เน็ตกลับมา
- Cache เมนู/หมวดหมู่ในเครื่อง 6 ชั่วโมง เพื่อแสดงรายการเร็วขึ้น
- Lazy loading + async decoding สำหรับรูปอาหาร
- Service Worker แบบ Network First สำหรับโค้ดใหม่ และ Stale-While-Revalidate สำหรับรูป
- ป้องกันการกดบันทึก/ชำระเงินซ้ำตามระบบ V8.3
- คง VAT Inclusive, POS, Reports, Admin, 90 ຕູບ และระบบพิมพ์เดิม

## การติดตั้ง
1. วางไฟล์ทั้งหมดทับ Repository เดิม
2. Commit: `Upgrade to V8.3 Final`
3. Push origin
4. รอ GitHub Pages Deploy
5. ปิด PWA/Browser ทั้งหมดแล้วเปิดใหม่หนึ่งครั้ง
6. ถ้ายังเห็นเวอร์ชันเก่า ให้ถอน PWA เดิมและติดตั้งใหม่

## Supabase
ไม่ต้องรัน SQL เพิ่ม หากฐานข้อมูลเป็น V8.2 และตั้ง VAT สำเร็จแล้ว
