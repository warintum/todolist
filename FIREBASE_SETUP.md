# คู่มือตั้งค่า Firebase สำหรับ TodoList App

## ภาพรวม

การเพิ่มระบบ Login ด้วย Google และ Sync ข้อมูลผ่าน Firebase ประกอบด้วย:
1. **Firebase Authentication** - สำหรับ Login ด้วย Google Account
2. **Cloud Firestore** - ฐานข้อมูลแบบ Real-time สำหรับเก็บ Todo บน Cloud

---

## ขั้นตอนการตั้งค่า

### 1. สร้าง Firebase Project

1. ไปที่ [Firebase Console](https://console.firebase.google.com/)
2. คลิก **"Create a project"**
3. ตั้งชื่อ project (เช่น `todolist-app`)
4. ปิด **"Enable Google Analytics"** (ไม่จำเป็นสำหรับแอปนี้)
5. คลิก **"Create project"**

### 2. เพิ่ม Web App

1. ใน Firebase Console คลิกไอคอน **</>** (Add app)
2. ตั้งชื่อแอป (เช่น `todolist-web`)
3. คลิก **"Register app"**
4. คัดลอกค่า Firebase SDK config ไว้

### 3. เปิดใช้งาน Google Authentication

1. ไปที่ **Build > Authentication**
2. คลิก **"Get started"**
3. เลือกแท็บ **"Sign-in method"**
4. คลิก **Google** แล้วเปิดใช้งาน (Enable)
5. เลือก **Email support** แล้วบันทึก

### 4. สร้าง Cloud Firestore Database

1. ไปที่ **Build > Firestore Database**
2. คลิก **"Create database"**
3. เลือก **"Start in test mode"** (สำหรับ development)
4. เลือก Location (แนะนำ `asia-southeast1` สำหรับผู้ใช้ในไทย)
5. คลิก **"Enable"**

### 5. ตั้งค่า Security Rules

ไปที่ **Firestore Database > Rules** แล้วแทนที่ด้วย:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // ให้ผู้ใช้เข้าถึงข้อมูลของตัวเองเท่านั้น
    match /users/{userId}/todos/{todoId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // ไม่อนุญาตให้สร้าง/ลบ collection อื่น
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

คลิก **"Publish"**

### 6. ตั้งค่า Environment Variables

1. สร้างไฟล์ `.env` ในโฟลเดอร์ root ของโปรเจค
2. คัดลอกค่าจาก Firebase SDK config มาใส่:

```env
VITE_FIREBASE_API_KEY=AIzaSyxxxxxxxxxxxxxxxxxxxxxxxxxxx
VITE_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789012
VITE_FIREBASE_APP_ID=1:123456789012:web:abcdef1234567890abcdef
```

---

## ทดสอบการทำงาน

### Development Mode

```bash
npm run dev
```

### Build สำหรับ Production

```bash
npm run build
```

---

## ฟีเจอร์ที่เพิ่มเข้ามา

### 1. ปุ่ม Sync Status
- แสดงสถานะการเชื่อมต่อกับ Cloud
- **Cloud icon สีเขียว** = เข้าสู่ระบบแล้ว ข้อมูลซิงค์อัตโนมัติ
- **CloudOff icon สีเทา** = ยังไม่เข้าสู่ระบบ
- **Spinner** = กำลังซิงค์ข้อมูล

### 2. เมนู Authentication
- คลิกที่ปุ่ม Sync เพื่อเปิดเมนู
- **Login with Google** - เข้าสู่ระบบ
- **แสดงข้อมูลผู้ใช้** - รูปโปรไฟล์, ชื่อ, อีเมล
- **Logout** - ออกจากระบบ

### 3. การซิงค์ข้อมูล
- **Login ครั้งแรก**: ข้อมูล Local จะอัพโหลดไป Cloud
- **Login อุปกรณ์ใหม่**: ข้อมูลจาก Cloud จะดาวน์โหลดมาเครื่อง
- **การแก้ไข**: ข้อมูลซิงค์แบบ Real-time ระหว่างอุปกรณ์
- **Offline**: ข้อมูลยังเก็บใน IndexedDB ใช้งานได้ปกติ

---

## การ Deploy บน GitHub Pages

### 1. ตั้งค่า GitHub Secrets

ไปที่ GitHub Repository > Settings > Secrets and variables > Actions

เพิ่ม Secrets ต่อไปนี้:

```
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
```

### 2. อัพเดท GitHub Actions Workflow

สร้าง/แก้ไขไฟล์ `.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [ main ]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        
    - name: Install dependencies
      run: npm ci
      
    - name: Build
      run: npm run build
      env:
        VITE_FIREBASE_API_KEY: ${{ secrets.VITE_FIREBASE_API_KEY }}
        VITE_FIREBASE_AUTH_DOMAIN: ${{ secrets.VITE_FIREBASE_AUTH_DOMAIN }}
        VITE_FIREBASE_PROJECT_ID: ${{ secrets.VITE_FIREBASE_PROJECT_ID }}
        VITE_FIREBASE_STORAGE_BUCKET: ${{ secrets.VITE_FIREBASE_STORAGE_BUCKET }}
        VITE_FIREBASE_MESSAGING_SENDER_ID: ${{ secrets.VITE_FIREBASE_MESSAGING_SENDER_ID }}
        VITE_FIREBASE_APP_ID: ${{ secrets.VITE_FIREBASE_APP_ID }}
      
    - name: Deploy
      uses: peaceiris/actions-gh-pages@v3
      with:
        github_token: ${{ secrets.GITHUB_TOKEN }}
        publish_dir: ./dist
```

### 3. ตั้งค่า Authorized Domains ใน Firebase

1. ไปที่ Firebase Console > Authentication > Settings
2. เพิ่มโดเมน `warintum.github.io` ใน **Authorized domains**
3. บันทึก

---

## แก้ไขปัญหาที่พบบ่อย

### 1. "auth/unauthorized-domain"
**สาเหตุ**: โดเมน GitHub Pages ยังไม่ได้เพิ่มใน Firebase
**แก้ไข**: ไปที่ Firebase Console > Authentication > Settings > Authorized domains > เพิ่ม `warintum.github.io`

### 2. ข้อมูลไม่ซิงค์
**สาเหตุ**: Firestore Security Rules ไม่ถูกต้อง
**แก้ไข**: ตรวจสอบ Rules ให้ตรงกับคู่มือข้างต้น

### 3. Login ไม่ได้
**สาเหตุ**: Google Auth ยังไม่ได้เปิดใช้งาน
**แก้ไข**: ไปที่ Firebase Console > Authentication > Sign-in method > เปิดใช้งาน Google

---

## โครงสร้างข้อมูลใน Firestore

```
users/{userId}/todos/{todoId}
```

ตัวอย่างข้อมูล:
```json
{
  "text": "ทำงานให้เสร็จ",
  "completed": false,
  "createdAt": "2026-02-13T06:30:00.000Z",
  "priority": "high",
  "note": "หมายเหตุ...",
  "updatedAt": "2026-02-13T06:30:00.000Z"
}
```

---

## หมายเหตุ

- **โควต้าฟรี**: Firebase Spark Plan มีโควต้าฟรี 50,000 ครั้งต่อวันสำหรับการอ่าน/เขียน Firestore
- **Offline Support**: แอปยังทำงานได้แม้ไม่มีอินเทอร์เน็ต ข้อมูลจะซิงค์เมื่อออนไลน์
- **Security**: ข้อมูลแยกตามผู้ใช้ ผู้ใช้ A ไม่สามารถเห็นข้อมูลผู้ใช้ B
