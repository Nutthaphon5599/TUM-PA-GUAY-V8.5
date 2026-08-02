# Tum Pa Guay Restaurant V7.1 — POS Edition

พัฒนาต่อจาก V6.2 โดยคงเว็บไซต์ เมนู รูป ราคา การจองโต๊ะ Admin และ Supabase เดิมทั้งหมด พร้อมเพิ่มระบบ POS และใบเสร็จทั่วไป

## ติดตั้ง V7
1. อัปโหลดไฟล์ทั้งหมดขึ้น GitHub แทน/ต่อจาก V6.2
2. เปิด Supabase → SQL Editor
3. เปิดไฟล์ `V7-POS-MIGRATION.sql` แล้ว Copy ทั้งหมด → Run หนึ่งครั้ง
4. เปิด `pos.html` และ Login ด้วยบัญชี Admin เดิม

## URL
- เว็บไซต์: `index.html`
- Admin: `admin.html`
- POS: `pos.html`

## ฟีเจอร์ POS
- โต๊ะ 1–90
- เปิดบิลและกลับมาแก้บิลเดิม
- เลือกเมนูจากฐานข้อมูล V6.2
- เพิ่ม/ลดจำนวน ส่วนลด VAT และหมายเหตุ
- ชำระเงินสด โอนธนาคาร QR หรืออื่น ๆ
- บันทึก orders, order_items และ payments ลง Supabase
- พิมพ์ใบเสร็จ Thermal 80 mm ผ่าน Browser Print
- ประวัติใบเสร็จ 100 รายการล่าสุด

> V7 ระดับแรกเป็นใบเสร็จทั่วไป ไม่ใช่ใบกำกับภาษี VAT อย่างเป็นทางการ


## V7.1
- Direct-tap menu ordering (no item popup)
- Reliable checkout modal close
- 90 huts (ຕູບ) by default
- Add, reduce, or set active hut count from POS
