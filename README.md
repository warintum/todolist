# TodoList App

แอปพลิเคชันสำหรับบันทึกรายการงานที่ต้องทำในแต่ละวัน สร้างด้วย React + TypeScript + Vite + Firebase

🔗 **Live Demo**: https://warintum.github.io/todolist/

## ฟีเจอร์หลัก

- ✅ เพิ่มรายการงานใหม่ พร้อมระดับความสำคัญและหมายเหตุ
- ✅ แก้ไขรายการงาน
- ✅ ลบรายการงาน (พร้อม Undo)
- ✅ ทำเครื่องหมายว่าเสร็จแล้ว
- ✅ กรองรายการงาน (ทั้งหมด/ยังไม่เสร็จ/เสร็จแล้ว)
- ✅ กรองตามเดือน
- ✅ ธีมมืด/สว่าง
- 🔐 **Login ด้วย Google Account**
- ☁️ **Sync ข้อมูลอัตโนมัติระหว่างอุปกรณ์**
- 📤 ส่งออก CSV / Excel
- 📥 นำเข้าจาก CSV
- ⌨️ Command Palette (Ctrl+K)

## เทคโนโลยีที่ใช้

- **React 19.2.0** พร้อม TypeScript
- **Vite** สำหรับ development server
- **Tailwind CSS** สำหรับ styling
- **Firebase**
  - **Authentication** - Login ด้วย Google
  - **Cloud Firestore** - ฐานข้อมูลแบบ Real-time
- **Lucide React** สำหรับ icons

## การติดตั้ง

```bash
npm install
```

## การตั้งค่า Firebase

ดูรายละเอียดที่ [FIREBASE_SETUP.md](./FIREBASE_SETUP.md)

### สร้างไฟล์ `.env`

```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdef
```

## การรัน Development

```bash
npm run dev
```

## การ Build

```bash
npm run build
```

## การใช้งาน

### ไม่ Login (Offline Mode)
- ข้อมูลจะเก็บในเครื่อง (IndexedDB)
- ใช้งานได้ปกติแต่ไม่สามารถ Sync ระหว่างอุปกรณ์ได้

### Login ด้วย Google
1. คลิกปุ่ม "ไม่ซิงค์" ที่มุมขวาบน
2. เลือก "เข้าสู่ระบบด้วย Google"
3. ข้อมูลจะ Sync อัตโนมัติ

### Sync ข้อมูล
- เมื่อ Login ข้อมูลจะ Sync อัตโนมัติ
- สามารถใช้งานบนอุปกรณ์อื่นได้โดย Login ด้วย Google Account เดียวกัน
- ข้อมูลยังคงอยู่แม้ออกจากระบบ (Offline support)

## การ Deploy บน GitHub Pages

### ตั้งค่า GitHub Secrets

ไปที่ Settings > Secrets and variables > Actions > New repository secret

เพิ่ม secrets ต่อไปนี้:
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

Push ไปยัง branch `main` จะ trigger deployment อัตโนมัติ

## โครงสร้างโปรเจค

```
src/
├── components/       # React Components
│   ├── TodoList.tsx
│   ├── TodoItem.tsx
│   └── CommandPalette.tsx
├── contexts/         # React Contexts
│   ├── AuthContext.tsx    # จัดการ Authentication
│   └── ToastContext.tsx
├── firebase/         # Firebase Configuration
│   ├── config.ts
│   └── todoService.ts     # จัดการข้อมูลใน Firestore
├── hooks/            # Custom Hooks
├── utils/            # Utilities
└── App.tsx
```

## License

MIT
