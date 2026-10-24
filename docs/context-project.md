# Context Project - Warehouse Queue App

Terakhir diperbarui: 2026-10-25 (modul Transaksi Pekerjaan + laporan turunan + export Excel transaksi)

## Ringkasan

`warehouse-queue-app` adalah aplikasi manajemen antrian truk dan aktivitas warehouse untuk operasional Sankyu. Project ini terdiri dari frontend Vue/Vite, backend Node.js/Express, database PostgreSQL via Prisma ORM, serta konfigurasi local production di Windows menggunakan Nginx.

Fitur utama:

- Manajemen antrian truk receiving/delivery.
- Display publik antrian truk (papan panggil industrial, auto-refresh 12 detik, TTS panggilan suara).
- Dashboard operasional dan laporan SLA.
- Master customer, gate, admin/user, dan karyawan.
- Schedule pengiriman.
- Picking progress, termasuk import/export Excel dan print summary.
- Transaksi Pekerjaan: pencatatan pekerjaan manpower (receiving/delivery per tipe truk), picking, dan stuffing dengan Start/Finish manual serta alur DRAFT -> PROSES -> SELESAI.
- Daily Job Activity: laporan harian yang **terbentuk otomatis** dari Transaksi Pekerjaan (sheet preview, print A4 landscape, export Excel berformat). Laporan bersifat read-only.
- Loading Type wajib saat Proses ke Selesai (PALETIZE / COMBINE / LOOSE).
- Driver Phone opsional pada transaksi antrian truk.
- Backup/restore database untuk pindah perangkat A ke B.

Aturan role terbaru:

- Role `ADMIN` dapat mengedit data yang sudah final (`SELESAI`/`BATAL`) tanpa blokir, termasuk mengubah `Loading Type` (tidak boleh dikosongkan) dan membatalkan Picking Progress.
- Role selain `ADMIN` tetap diblokir saat mengedit data status final.
- Mengubah status data yang sudah final tetap diblokir untuk semua role.

## Lokasi Project

Root project:

```text
D:\Github\warehouse-queue-app
```

Path penting:

```text
D:\Github\warehouse-queue-app\backend
D:\Github\warehouse-queue-app\material-dashboard-shadcn-vue-1.0.0
D:\Github\warehouse-queue-app\deploy\windows
D:\Github\warehouse-queue-app\docker
D:\Github\warehouse-queue-app\nginx-1.28.2
D:\Github\warehouse-queue-app\docs
D:\Github\warehouse-queue-app\docs\MIGRATION_A_TO_B.md
D:\Github\warehouse-queue-app\docs\context-project.md
```

## Stack Teknologi

Backend:

- Node.js.
- Express 4.
- Prisma ORM 6.
- PostgreSQL.
- JWT authentication.
- bcryptjs untuk password hashing.
- multer untuk upload file Excel.
- exceljs dan xlsx untuk import/export Excel.

Frontend:

- Vue 3.
- Vite 7.
- TypeScript.
- Vue Router.
- Axios.
- Tailwind CSS.
- Radix Vue / shadcn-style UI components.
- Chart.js dan vue-chartjs.

Infra lokal Windows:

- PostgreSQL dapat berjalan via Docker Compose (image `postgres:18`, host port `5433`).
- Pada server production, PostgreSQL berjalan native (versi 18).
- Backend berjalan di port `3000`.
- Frontend development berjalan di port `5000`.
- Frontend production build dilayani Nginx di port `82`.
- Nginx production proxy `/api` ke `http://127.0.0.1:3000`.

## Arsitektur Runtime

Mode production/local Windows:

```text
Browser
  -> http://localhost:82/material-dashboard-shadcn-vue/
  -> C:\nginx-1.28.2\nginx.exe
  -> frontend dist alias:
     D:/Github/warehouse-queue-app/material-dashboard-shadcn-vue-1.0.0/dist/

Browser /api/*
  -> Nginx location /api/
  -> http://127.0.0.1:3000
  -> Express backend
  -> Prisma Client
  -> PostgreSQL queue_db
```

Health checks:

```text
http://localhost:82/nginx-health
http://localhost:3000/health
```

Expected response backend:

```json
{"ok":true}
```

## Struktur Folder

Root:

```text
backend/                              Backend Express + Prisma
material-dashboard-shadcn-vue-1.0.0/  Frontend Vue/Vite
deploy/windows/                       Script start/stop/backup/restore Windows
docker/                               Docker Compose PostgreSQL
docs/                                 Dokumentasi, diagram workflow, dan panduan migrasi
nginx-1.28.2/                         Nginx bundled/config reference repo
docs/MIGRATION_A_TO_B.md              Panduan pindah server/laptop A ke B
docs/context-project.md               Dokumen konteks project ini
README.md                             Catatan script local server Windows
Note.txt                              Catatan operasional cepat
DB Auth.txt                           Catatan kredensial DB lokal/server
```

Backend:

```text
backend/src/app.js                    Express app, middleware, route mount
backend/src/server.js                 Entry point server, membaca PORT dari env
backend/src/routes/                   Definisi endpoint Express
backend/src/controllers/              HTTP controller per domain
backend/src/services/                 Business logic dan query Prisma
backend/src/middlewares/              Auth, role, validation, error handling
backend/src/utils/response.js         Helper response
backend/src/utils/prisma.js           Singleton PrismaClient (wajib dipakai semua service)
backend/src/utils/loadingType.js      Konstanta & label Loading Type
backend/src/utils/phone.js            Validasi nomor HP (opsional, 9-15 digit)
backend/prisma/schema.prisma          Schema database Prisma
backend/prisma/migrations/            Riwayat migrasi database
backend/prisma/seed.js                Seed admin default
backend/.env                          Runtime env lokal, jangan commit secret baru
backend/.env.example                  Contoh env
```

> Catatan penting: semua service dan controller WAJIB memakai `require("../utils/prisma")` (singleton). Jangan membuat `new PrismaClient()` di file lain. Membuat banyak instance PrismaClient pernah menyebabkan backend crash saat banyak request concurrent.

Frontend:

```text
material-dashboard-shadcn-vue-1.0.0/src/router/index.ts       Route dan guard role
material-dashboard-shadcn-vue-1.0.0/src/services/api.ts       Axios base client
material-dashboard-shadcn-vue-1.0.0/src/services/             API wrapper per domain
material-dashboard-shadcn-vue-1.0.0/src/views/                Halaman utama aplikasi
material-dashboard-shadcn-vue-1.0.0/src/components/queue/     Komponen antrian
material-dashboard-shadcn-vue-1.0.0/src/components/picking/   Komponen picking
material-dashboard-shadcn-vue-1.0.0/src/components/dashboard/ Komponen chart/dashboard
material-dashboard-shadcn-vue-1.0.0/src/composables/          Auth, theme, TTS queue
material-dashboard-shadcn-vue-1.0.0/src/lib/datetime.ts       Format tanggal/jam Indonesia (24 jam, tanpa detik)
material-dashboard-shadcn-vue-1.0.0/src/lib/loadingType.ts    Opsi & label Loading Type
material-dashboard-shadcn-vue-1.0.0/src/lib/phone.ts          Sanitasi & validasi nomor HP
material-dashboard-shadcn-vue-1.0.0/src/lib/utils.ts          Helper cn() shadcn
material-dashboard-shadcn-vue-1.0.0/vite.config.ts            Base path, dev server, proxy
```

## Database

Database default lokal (Docker Compose):

```text
Host: localhost
Port: 5433   (host) -> 5432 (container)
Database: queue_db
User: sankyu
Password: sankyu39
```

> Port host diubah ke `5433` karena port `5432` sudah dipakai container PostgreSQL project lain di mesin development.

Contoh `DATABASE_URL` dari `.env.example`:

```env
DATABASE_URL=postgresql://sankyu:sankyu39@localhost:5432/queue_db
PORT=3000
NODE_ENV=development
JWT_SECRET=change_this_secret
JWT_EXPIRES_IN=12h
```

Contoh `DATABASE_URL` yang dipakai lokal Docker (port `5433`, ada limit koneksi):

```env
DATABASE_URL="postgresql://sankyu:sankyu39@localhost:5433/queue_db?connection_limit=30&pool_timeout=20"
```

Docker Compose database berada di:

```text
D:\Github\warehouse-queue-app\docker\docker-compose.yml
```

Service Docker:

```yaml
services:
  postgres:
    image: postgres:18
    container_name: queue_system
    ports:
      - "5433:5432"
    volumes:
      - queue_pgdata:/var/lib/postgresql
```

Catatan PostgreSQL 18 Docker:

- Image `postgres:18` mengubah mount point volume. Volume harus di-mount ke `/var/lib/postgresql` (bukan `/var/lib/postgresql/data`). Jika salah, container akan crash-loop.
- Data PostgreSQL 16 tidak kompatibel langsung dengan 18; perlu dump/restore, bukan sekadar ganti image.

Perintah Docker yang sering dipakai:

```bat
cd D:\Github\warehouse-queue-app\docker
docker compose up -d
docker ps
docker logs queue_system
docker stop queue_system
docker start queue_system
```

## Model Prisma Utama

Enums penting:

```text
QueueStatus: MENUNGGU, IN_WH, PROSES, SELESAI, BATAL
QueueCategory: RECEIVING, DELIVERY
AdminRole: ADMIN, WAREHOUSE, CS
WarehouseGate: WH1, WH2, DG
StoreType: STORE_IN, STORE_OUT
EmployeePosition: FOREMAN, TALLYMAN, OPR_FORKLIFT
PickingStatus: MENUNGGU, ON_PROCESS, SELESAI, BATAL
TruckType: CDD, CDE, FUSO, WB, FT20, FT40, OTHER
```

Model utama:

- `QueueEntry`: data antrian truk, status, gate, customer, Tallyman saat mulai proses, SLA, timestamp masuk/proses/selesai, catatan WH, `driverPhone` (opsional), `loadingType` (diisi saat SELESAI).
- `QueueLog`: audit log perubahan antrian dan status.
- `Customer`: master customer dan relasi ke antrian, schedule, picking.
- `Employee`: master karyawan/picker.
- `AdminUser`: user login, role, password hash, relasi audit.
- `Gate`: master gate berdasarkan nomor gate dan warehouse.
- `ShipmentSchedule`: header schedule pengiriman.
- `ShipmentScheduleItem`: detail qty truck type per schedule.
- `PickingProgress`: progres picking per DO/customer/destination.
- `PickingProgressLog`: audit log picking progress.
- `DailyJobActivity`: header laporan per tanggal (`@@unique([activityDate])`). Hanya menyimpan tanggal, `notes`, dan audit. Seluruh angka laporan **tidak** disimpan di sini, melainkan dihitung dari `JobTransaction`.
- `JobTransaction`: sumber kebenaran modul ini. Satu baris = satu pekerjaan: `activityType` (RECEIVING/DELIVERY/PICKING/STUFFING), `jobRole` (TALLY/OPERATOR), `employeeId` (wajib untuk manpower), `truckType` + `truckTypeOther` + `qty` (manpower), `totalDo` + `totalMember` (picking/stuffing), `startAt` + `finishAt` (DateTime manual), `status` (DRAFT/PROSES/SELESAI/BATAL), `confirmation`, `cancelReason`.
- `JobTransactionLog`: audit log CREATE/START/FINISH/REOPEN/CANCEL/UPDATE/DELETE per transaksi. `jobTransactionId` nullable + `onDelete: SetNull` agar jejak hapus tetap tersimpan.
- `DailyJobActivityLog`: audit log perubahan header laporan (mis. `NOTES`).

## Backend API

Semua route backend dipasang di `backend/src/app.js` dengan prefix `/api`, kecuali health check `/health`.

Auth:

```text
POST /api/auth/login
GET  /api/auth/me
POST /api/auth/logout
```

Queue/antrian:

```text
GET   /api/queue/display
POST  /api/queue
GET   /api/queue
GET   /api/queue/export
GET   /api/queue/:id
PATCH /api/queue/:id
PATCH /api/queue/:id/wh-notes
PATCH /api/queue/:id/status
PATCH /api/queue/:id/set-in-wh
```

Aturan otomatis antrian:

- Data `QueueEntry` yang umur `registerTime`-nya sudah lebih dari 3 hari dan statusnya masih `MENUNGGU`, `IN_WH`, atau `PROSES` akan otomatis diubah menjadi `SELESAI` oleh sistem.
- Proses ini dijalankan di backend saat server start dan diulang otomatis setiap 1 jam.
- Perubahan otomatis tetap membuat `QueueLog` bertipe `STATUS_CHANGE` dengan `userName: system`.
- Auto-selesai sistem mengisi `loadingType = SYSTEM` agar aturan "Loading Type wajib" tetap konsisten.
- Saat status antrian berubah dari `IN_WH` ke `PROSES`, input `Tallyman` bersifat opsional. Jika diisi, nilainya harus berasal dari `Master Karyawan` dengan posisi `TALLYMAN`.
- Nama Tallyman tidak ditampilkan di Table View antrian, tetapi ditampilkan di Detail Antrian drawer.
- Hasil export Excel `Antrian Truk` juga menyertakan kolom `Nama Tallyman`.

Aturan Loading Type:

- Saat transisi `PROSES` ke `SELESAI`, user WAJIB memilih `loadingType` lewat dropdown.
- Nilai yang sah: `PALETIZE`, `COMBINE`, `LOOSE` (ditambah `SYSTEM` internal untuk auto-selesai).
- Label tampilan: `Paletize`, `Combine`, `Loose (Curah)`, `Sistem`.
- Hanya role `ADMIN` yang boleh mengubah `loadingType` setelah tersimpan, dan tidak boleh dikosongkan saat status `SELESAI`/`BATAL`.
- `loadingType` tampil di Drawer Detail dan export Excel Antrian Truk. Tidak ditampilkan di tabel utama maupun display board.

Aturan Driver Phone:

- `driverPhone` bersifat opsional pada form Tambah/Edit Transaksi.
- Hanya boleh berisi digit, `+`, `-`, dan spasi, dengan jumlah digit 9-15.
- Ikut dicari pada pencarian antrian, tampil di Drawer Detail dan export Excel.

Customers:

```text
GET    /api/customers
POST   /api/customers
GET    /api/customers/template
POST   /api/customers/import
GET    /api/customers/export
PATCH  /api/customers/:id
PUT    /api/customers/:id
DELETE /api/customers/:id
```

Gates:

```text
GET    /api/gates
GET    /api/master-gates
POST   /api/gates
PATCH  /api/gates/:id
PUT    /api/gates/:id
DELETE /api/gates/:id
GET    /api/gates/template
POST   /api/gates/import
GET    /api/gates/export
```

Employees:

```text
GET    /api/employees
POST   /api/employees
GET    /api/employees/template
POST   /api/employees/import
GET    /api/employees/export
PATCH  /api/employees/:id
PUT    /api/employees/:id
DELETE /api/employees/:id
```

Admin users:

```text
GET    /api/admin-users
POST   /api/admin-users
PATCH  /api/admin-users/:id
DELETE /api/admin-users/:id
```

Dashboard:

```text
GET /api/dashboard/summary
GET /api/dashboard/schedule-summary
GET /api/dashboard/progress-summary
GET /api/dashboard/picking-progress-summary
GET /api/dashboard/hourly
GET /api/dashboard/status
GET /api/dashboard/top-customers
GET /api/dashboard/over-sla
GET /api/dashboard/monthly-schedule-truck-summary
GET /api/dashboard/monthly-report
```

Schedules:

```text
POST   /api/schedules
GET    /api/schedules
GET    /api/schedules/export
GET    /api/schedules/print-summary
GET    /api/schedules/:id
PUT    /api/schedules/:id
DELETE /api/schedules/:id
```

Picking progress:

```text
POST  /api/picking-progress
GET   /api/picking-progress
GET   /api/picking-progress/template
GET   /api/picking-progress/print-summary
POST  /api/picking-progress/import
GET   /api/picking-progress/export
GET   /api/picking-progress/:id
PATCH /api/picking-progress/:id
PATCH /api/picking-progress/:id/start
PATCH /api/picking-progress/:id/picked-qty
PATCH /api/picking-progress/:id/wh-notes
PATCH /api/picking-progress/:id/finish
PATCH /api/picking-progress/:id/cancel
```

Job Transactions (sumber data modul laporan harian):

```text
GET    /api/job-transactions                  Daftar transaksi (date/dateFrom/dateTo/status/activityType/search + pagination)
GET    /api/job-transactions/export           Export Excel semua baris sesuai filter yang sama (maks 5000 baris)
POST   /api/job-transactions                  Buat transaksi (startAt terisi -> PROSES, startAt+finishAt -> SELESAI, tanpa startAt -> DRAFT)
GET    /api/job-transactions/:id
PUT    /api/job-transactions/:id
PATCH  /api/job-transactions/:id/start        DRAFT -> PROSES (startAt wajib)
PATCH  /api/job-transactions/:id/finish       PROSES -> SELESAI (finishAt wajib, > startAt)
PATCH  /api/job-transactions/:id/reopen       Turun satu langkah, ADMIN only
PATCH  /api/job-transactions/:id/cancel       BATAL + alasan wajib, ADMIN only
DELETE /api/job-transactions/:id
```

Daily Job Activity (laporan turunan, read-only):

```text
GET    /api/daily-job-activities              Daftar laporan per tanggal (date/dateFrom/dateTo + pagination)
GET    /api/daily-job-activities?date=YYYY-MM-DD  Laporan tanggal tersebut (selalu ada, status KOSONG bila belum ada transaksi)
GET    /api/daily-job-activities/:id
PATCH  /api/daily-job-activities/:id/notes    Satu-satunya field yang bisa diubah manual
GET    /api/daily-job-activities/:id/export-excel
```

Aturan Job Transaction:

- Akses `ADMIN`, `WAREHOUSE`, `CS` setara untuk create/update/start/finish. `reopen`, `cancel`, dan delete transaksi `SELESAI` hanya ADMIN.
- Status: `DRAFT` (belum ada `startAt`) -> `PROSES` (Confirm) -> `SELESAI` (Finish), plus `BATAL`. `SELESAI` dan `BATAL` mengunci edit untuk WAREHOUSE/CS.
- Satu transaksi = satu pekerjaan. Manpower (`RECEIVING`/`DELIVERY`) wajib punya `employeeId` dari Master Karyawan dengan posisi yang cocok (`TALLYMAN` untuk TALLY, `OPR_FORKLIFT` untuk OPERATOR), `truckType`, dan `qty` minimal 1. Picking/Stuffing wajib punya `totalDo` atau `totalMember`.
- `activityType` menentukan `jobRole` di server: RECEIVING -> TALLY, DELIVERY -> OPERATOR. Klien tidak boleh mengirim `jobRole`.
- `truckType` memakai enum `CDD | CDE | FUSO | WB | FT20 | FT40 | OTHER`; `OTHER` wajib disertai `truckTypeOther`.
- **Waktu disimpan sebagai wall-clock UTC.** Input `2026-10-26T13:00` disimpan menjadi `2026-10-26T13:00:00.000Z`, sehingga jam yang dibaca selalu sama dengan yang diketik, tanpa pergeseran timezone server. Jangan memakai `new Date(localString)` saat membandingkan; gunakan parser wall-clock.
- `transactionDate` diturunkan dari `startAt` dan dipakai untuk mengelompokkan transaksi ke laporan harian. Header `DailyJobActivity` dibuat otomatis saat transaksi pertama pada tanggal itu dibuat.
- Transaksi `PROSES` milik karyawan yang sama tidak boleh beririsan waktu. Pelanggaran dibalas `422` dengan `details.code = "EMPLOYEE_OVERLAP"`.
- `finish` hanya boleh dari `PROSES`; `finishAt` wajib dan harus lebih besar dari `startAt`.
- Export Excel Transaksi Pekerjaan memakai filter aktif di halaman (tanggal, status, pekerjaan, pencarian) dan mengabaikan pagination, jadi yang terunduh selalu seluruh baris yang cocok. Batas keras 5000 baris; bila terlewati, file diberi baris peringatan di atas tabel.

Aturan Daily Job Activity (turunan):

- **Tidak ada input angka di laporan.** Semua angka dihitung ulang dari `JobTransaction` setiap kali laporan dibuka.
- Ringkasan unit: `CDD`/`CDE` -> CDD / CDE, `WB`/`FUSO`/`OTHER` -> WINGBOX, `FT20`/`FT40` -> CONTAINER; dipisah RECEIVING dan DELIVERY. Nilai 0 ditampilkan kosong.
- Status laporan diturunkan: tidak ada transaksi aktif -> `KOSONG`; ada `PROSES` -> `BERJALAN`; semua `SELESAI` -> `SELESAI`; semua `BATAL` -> `BATAL`. Tidak ada status manual, sehingga laporan tidak bisa bertentangan dengan transaksinya.
- Hanya transaksi `PROSES` dan `SELESAI` yang masuk lembar. `DRAFT` belum punya `startAt` sehingga tidak bisa ditempatkan di timeline; `BATAL` berarti pekerjaan tidak terjadi.
- Sesi manpower = gabungan transaksi satu karyawan pada satu tanggal. `timeStart` = `startAt` paling awal, `timeFinish` = `finishAt` paling akhir (kosong bila masih ada yang berjalan), `isFinish` = semua transaksinya SELESAI.
- Pasangan TALLY+OPERATOR dibentuk otomatis: urutkan sesi tally dan operator menurut `startAt`, lalu untuk tiap tally pilih operator yang waktunya beririsan (paling awal). Bila tidak ada yang beririsan, pakai operator berikutnya yang belum terpakai; bila habis, baris pasangan dibiarkan kosong.
- Picking/Stuffing menjadi satu baris per transaksi sesi, ditampilkan `"N DO"` dari `totalDo`.
- Filter tanggal memakai ekuivalen UTC-midnight karena `activityDate` bertipe `@db.Date`. Jangan memakai `getStartOfDay` lokal untuk kolom ini.
- Export Excel: satu sheet, header `#B4C6E7` / `#FFFF00` / `#33CC33`, border tipis, merge cell, baris spacer antar grup, dan sel angka ditulis sebagai number bila isinya murni digit.
- Export Excel: satu sheet, header `#B4C6E7` / `#FFFF00` / `#33CC33`, border tipis, merge cell, baris spacer antar grup, dan sel angka ditulis sebagai number bila isinya murni digit.

## Auth dan Role

Role aplikasi:

```text
ADMIN
WAREHOUSE
CS
```

Aturan edit data final (status `SELESAI`/`BATAL`):

- `ADMIN` boleh mengedit data status final (tanpa blokir), termasuk mengubah `loadingType` (wajib tidak kosong) dan membatalkan Picking Progress.
- `WAREHOUSE` dan `CS` tetap diblokir saat mengedit data status final.
- Mengubah status data yang sudah final tetap diblokir untuk SEMUA role.

Frontend route guard berada di:

```text
material-dashboard-shadcn-vue-1.0.0/src/router/index.ts
```

Token JWT disimpan di localStorage menggunakan key dari:

```text
material-dashboard-shadcn-vue-1.0.0/src/constants/auth.ts
```

Axios interceptor otomatis:

- Menambahkan header `Authorization: Bearer <token>` jika token ada.
- Menghapus token dan redirect ke login saat API mengembalikan `401`.

Seed admin default:

```text
username: admin
password: admin123
role: ADMIN
```

Seed berada di:

```text
backend/prisma/seed.js
```

## Frontend Routing

Base path production:

```text
/material-dashboard-shadcn-vue/
```

Public routes:

```text
/material-dashboard-shadcn-vue/login
/material-dashboard-shadcn-vue/display/antrian-truk
```

Authenticated routes:

```text
/material-dashboard-shadcn-vue/dashboard
/material-dashboard-shadcn-vue/master-customer       ADMIN
/material-dashboard-shadcn-vue/master-gate           ADMIN/WAREHOUSE/CS
/material-dashboard-shadcn-vue/master-admin          ADMIN
/material-dashboard-shadcn-vue/master-karyawan       ADMIN
/material-dashboard-shadcn-vue/antrian-truk          ADMIN/WAREHOUSE/CS
/material-dashboard-shadcn-vue/antrian-truk/mobile    ADMIN/WAREHOUSE/CS
/material-dashboard-shadcn-vue/picking-progress      ADMIN/WAREHOUSE/CS
/material-dashboard-shadcn-vue/transaksi-pekerjaan        ADMIN/WAREHOUSE/CS  (input + tabel transaksi)
/material-dashboard-shadcn-vue/daily-job-activity         ADMIN/WAREHOUSE/CS  (daftar laporan turunan)
/material-dashboard-shadcn-vue/daily-job-activity/:id     ADMIN/WAREHOUSE/CS  (lembar read-only, print, Excel)
/material-dashboard-shadcn-vue/schedule-pengiriman   ADMIN/WAREHOUSE/CS
```

Jika user `WAREHOUSE` atau `CS` login dan membuka login/dashboard tidak sesuai, frontend diarahkan ke `/antrian-truk`.

## Cara Running Development

Database:

```bat
cd D:\Github\warehouse-queue-app\docker
docker compose up -d
```

Backend:

```bat
cd D:\Github\warehouse-queue-app\backend
npm install
npx prisma generate
npx prisma migrate deploy
npm run dev
```

Catatan: `backend/.env` tidak ikut git (gitignored). Salin dari `backend/.env.example` lalu sesuaikan `DATABASE_URL` ke port `5433` bila memakai Docker.

Frontend development:

```bat
cd D:\Github\warehouse-queue-app\material-dashboard-shadcn-vue-1.0.0
npm install
npm run dev
```

Menjalankan backend + frontend development sekaligus:

```bat
cd D:\Github\warehouse-queue-app\deploy\windows
start-dev-fullstack.bat
```

Menghentikan backend + frontend development repo ini:

```bat
cd D:\Github\warehouse-queue-app\deploy\windows
stop-dev-fullstack.bat
```

Catatan:

- Script akan berhenti jika port backend `3000` sudah dipakai proses lain.
- Untuk frontend, script akan mencoba port `5000`, lalu fallback otomatis ke `5001` sampai `5010`.
- Jika lolos pengecekan port, script membuka 2 window `cmd` terpisah untuk backend dan frontend.
- Script stop hanya menghentikan proses Node yang command line-nya terdeteksi berasal dari folder repo ini.

URL development frontend:

```text
http://localhost:5000/material-dashboard-shadcn-vue/
```

Vite dev server proxy:

```text
/api -> http://localhost:3000
```

## Cara Running Local Production Windows

Build frontend:

```bat
cd D:\Github\warehouse-queue-app\material-dashboard-shadcn-vue-1.0.0
npm install
npm run build
```

Install/generate backend:

```bat
cd D:\Github\warehouse-queue-app\backend
npm install
npx prisma generate
npx prisma migrate deploy
```

Start semua service:

```bat
cd D:\Github\warehouse-queue-app\deploy\windows
start-local-server.bat
```

Stop service warehouse:

```bat
cd D:\Github\warehouse-queue-app\deploy\windows
stop-local-server.bat
```

URL local production:

```text
http://localhost:82/material-dashboard-shadcn-vue/
```

URL display publik:

```text
http://localhost:82/material-dashboard-shadcn-vue/display/antrian-truk
```

## Update di Mesin Server Production

Ringkasan langkah update (tanpa merusak DB/aplikasi). Detail: `docs/MIGRATION_A_TO_B.md`.

```bat
:: 0. Catat kondisi: cek /nginx-health dan /health
:: 1. WAJIB backup DB dulu
cd D:\backups
"C:\Program Files\PostgreSQL\18\bin\pg_dump" -h localhost -U sankyu -d queue_db -F c -b -v -f queue_db_pre_update.backup
"C:\Program Files\PostgreSQL\18\bin\pg_restore" --list queue_db_pre_update.backup > nul && echo BACKUP OK

:: 2. Stop backend (tutup window CMD, atau matikan listener port 3000)
:: 3. Copy file update (src, prisma, package.json; JANGAN .env / node_modules / dist)

:: 4. Backend
cd D:\Github\warehouse-queue-app\backend
npm install
npx prisma generate
npm run migrate:deploy
node src/server.js

:: 5. Frontend (build DI SERVER)
cd D:\Github\warehouse-queue-app\material-dashboard-shadcn-vue-1.0.0
npm install
npm run build

:: 6. Reload Nginx, verifikasi end-to-end
```

Aturan penting update server:

- Server production memakai PostgreSQL 18 native; pastikan `pg_dump`/`pg_restore` juga versi 18.
- Selalu verifikasi backup dengan `pg_restore --list` sebelum dianggap valid.
- JANGAN `prisma migrate dev` di server; WAJIB `npm run migrate:deploy`.
- JANGAN `npm run seed` di server (data production sudah punya user).
- JANGAN timpa `backend/.env` server dengan `.env` development.
- Frontend di-build langsung di server (`npm run build`), `dist` tidak perlu dikirim dari laptop.
- Migrasi hanya menambah kolom (`ADD COLUMN ... NULL`), sehingga rollback aplikasi tidak merusak DB.

## Tampilan Display Antrian Truk

Halaman `DisplayAntrianTruk.vue` memakai desain "papan panggil" industrial, terpisah dari tema aplikasi (selalu gelap):

- Header: jam live + tombol Sound dan Fullscreen.
- Hero "Sedang Diproses": truk `IN_WH`/`PROSES` dengan nomor truk dan gate besar.
- Daftar "Antrian Menunggu": truk `MENUNGGU` bernomor urut; ada auto-scroll halus bila melebihi tinggi layar.
- Strip ringkasan bawah: Total, Delivery, Receiving, Menunggu, Diproses, Selesai.
- Truk `SELESAI` tidak lagi ditampilkan sebagai baris; hanya dihitung pada angka ringkasan "Selesai".
- Over SLA ditandai tepi merah + badge + pulse; hampir over ditandai amber.
- Font condensed (Barlow Condensed) dimuat dari Google Fonts, hanya untuk halaman ini, dengan fallback font sistem.
- Animasi diminimalkan dan menghormati `prefers-reduced-motion`.
- Tetap mempertahankan: TTS panggilan suara, toggle suara, fullscreen, auto-refresh 12 detik, banner SLA, jam live, dan akses publik tanpa login.

## Nginx Windows

Path Nginx aktif yang dipakai script:

```text
C:\nginx-1.28.2
```

Config aktif:

```text
C:\nginx-1.28.2\conf\nginx.conf
```

Config reference dalam repo:

```text
D:\Github\warehouse-queue-app\nginx-1.28.2\conf\nginx.conf
```

Port frontend production:

```text
82
```

Nginx route penting:

```nginx
location /material-dashboard-shadcn-vue/ {
    alias D:/Github/warehouse-queue-app/material-dashboard-shadcn-vue-1.0.0/dist/;
    index index.html;
    try_files $uri $uri/ /material-dashboard-shadcn-vue/index.html;
}

location /api/ {
    proxy_pass http://queue_backend;
}

location = /nginx-health {
    return 200 "ok\n";
}
```

Catatan penting 2026-04-26:

- Port `80` di mesin ini dipakai XAMPP Apache dan Herd Nginx.
- Warehouse Queue App memakai port `82` agar tidak bentrok.
- `start-local-server.ps1` harus mendeteksi Nginx berdasarkan path `C:\nginx-1.28.2\nginx.exe`, bukan sekadar nama proses `nginx`, karena Herd juga menjalankan proses bernama `nginx`.
- `stop-local-server.ps1` juga hanya boleh menghentikan Nginx warehouse, jangan menghentikan Nginx Herd/project lain.

## Backup dan Restore Database

Script berada di:

```text
D:\Github\warehouse-queue-app\deploy\windows
```

Backup default:

```bat
cd D:\Github\warehouse-queue-app\deploy\windows
backup-db.bat
```

Backup mode Docker:

```bat
backup-db.bat -Mode docker
```

Backup ke file custom:

```bat
backup-db.bat D:\backup\queue_db_manual.backup
```

Restore backup terbaru:

```bat
restore-db.bat
```

Restore mode Docker:

```bat
restore-db.bat -Mode docker
```

Restore file tertentu:

```bat
restore-db.bat D:\backup\queue_db.backup
```

Script backup/restore membaca `DATABASE_URL` dari:

```text
backend/.env
```

Default container Docker:

```text
queue_system
```

Catatan backup/restore:

- Ukuran/versi dump harus cocok dengan versi PostgreSQL target. Dump dari PostgreSQL 18 tidak bisa di-restore ke PostgreSQL 16 (errornya: `unsupported version (1.16) in file header`).
- Selalu verifikasi file backup valid sebelum dianggap berhasil, misalnya dengan `pg_restore --list <file>`.
- Backup lama bisa corrupt bila tidak selesai ditulis atau rusak saat transfer; buat ulang bila gagal restore.
- Database development saat ini berisi hasil restore dari backup production (PostgreSQL 18).

## Migrasi Perangkat A ke B

Panduan utama:

```text
D:\Github\warehouse-queue-app\docs\MIGRATION_A_TO_B.md
```

Ringkasan ritual pindah laptop/server:

```bat
git pull
cd D:\Github\warehouse-queue-app\docker
docker compose up -d

cd D:\Github\warehouse-queue-app\backend
npm install
npx prisma generate
npx prisma migrate deploy

cd D:\Github\warehouse-queue-app\material-dashboard-shadcn-vue-1.0.0
npm install
npm run build

cd D:\Github\warehouse-queue-app\deploy\windows
start-local-server.bat
```

Firewall untuk akses LAN port `82`:

```bat
netsh advfirewall firewall add rule name="WarehouseQueue HTTP 82" dir=in action=allow protocol=TCP localport=82
```

Akses LAN:

```text
http://<IP_SERVER>:82/material-dashboard-shadcn-vue/
```

## Dokumentasi Visual

Folder docs berisi diagram workflow antrian trucking:

```text
D:\Github\warehouse-queue-app\docs\flowchart-workflow-antrian-trucking.drawio
D:\Github\warehouse-queue-app\docs\flowchart-workflow-antrian-trucking.drawio.pdf
```

Gunakan file draw.io untuk update diagram workflow jika proses bisnis berubah.

## Perintah Verifikasi Cepat

Cek backend:

```bat
curl.exe -i http://localhost:3000/health
```

Cek Nginx warehouse:

```bat
curl.exe -i http://localhost:82/nginx-health
```

Cek frontend production:

```bat
curl.exe -I http://localhost:82/material-dashboard-shadcn-vue/
```

Cek listener port:

```powershell
Get-NetTCPConnection -State Listen | Where-Object { $_.LocalPort -in 80,82,3000 }
```

Cek config Nginx harus dari folder Nginx, bukan folder repo:

```bat
cd C:\nginx-1.28.2
nginx.exe -t
```

Jika menjalankan `nginx.exe -t` dari folder repo, Nginx bisa mencari `conf/nginx.conf` di folder yang salah.

## Troubleshooting Penting

Jika `localhost:82` tidak bisa dibuka:

1. Cek apakah port `82` listen oleh `C:\nginx-1.28.2\nginx.exe`.
2. Jalankan `deploy\windows\start-local-server.bat`.
3. Cek `C:\nginx-1.28.2\conf\nginx.conf` listen `82`.
4. Cek `dist/index.html` ada di frontend.
5. Cek backend `http://localhost:3000/health`.

Jika Nginx tidak start:

1. Jalankan `cd C:\nginx-1.28.2`.
2. Jalankan `nginx.exe -t`.
3. Pastikan folder temp Nginx ada. Script start membuat folder temp otomatis.
4. Pastikan config alias mengarah ke path project yang benar.

Jika API 401:

- Normal jika belum login atau token expired.
- Frontend akan hapus token dan redirect login.

Jika database gagal connect:

1. Cek Docker container `queue_system` hidup.
2. Cek port `5433` di host (bukan `5432`, karena dipakai project lain).
3. Cek `backend/.env` dan `DATABASE_URL`.
4. Jalankan `npx prisma generate`.
5. Jalankan `npx prisma migrate deploy`.
6. Jika backend crash saat banyak request concurrent, pastikan semua service memakai singleton `backend/src/utils/prisma.js` dan `DATABASE_URL` menyertakan `connection_limit`.

Jika frontend dev API gagal:

- Cek backend hidup di `localhost:3000`.
- Cek Vite proxy di `vite.config.ts`.
- Frontend Axios memakai `baseURL: '/api'`, jadi proxy/Nginx yang menentukan backend target.

Jika `prisma migrate dev` minta reset database:

Gejala: `We need to reset the "public" schema` karena beberapa migrasi lama "was modified after it was applied" (checksum di tabel `_prisma_migrations` tidak cocok dengan file `migration.sql` di repo).

- **JANGAN** menjalankan `prisma migrate reset`. Database dev berisi hasil restore production.
- Migrasi baru bisa dibuat tanpa reset:
  1. `npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script`
  2. Buang statement yang tidak terkait (misalnya drift `PickingProgress.volumeCbm`), simpan ke `prisma/migrations/<timestamp>_<nama>/migration.sql` tanpa BOM UTF-8.
  3. `npx prisma db execute --file <file.sql> --schema prisma/schema.prisma`
  4. `npx prisma migrate resolve --applied <timestamp>_<nama>`
- `prisma generate` gagal dengan `EPERM ... query_engine-windows.dll.node` bila backend sedang berjalan. Hentikan proses `node src/server.js` dulu, generate, lalu jalankan ulang.

## Catatan Untuk Codex / Agent Berikutnya

- Ikuti instruksi RTK lokal: shell command sebaiknya diprefix `rtk`.
- Jangan menghapus atau menghentikan proses Nginx lain sembarangan. Mesin ini juga punya Herd Nginx dan XAMPP Apache.
- Jangan anggap semua proses bernama `nginx` milik project ini. Untuk warehouse, path yang benar adalah `C:\nginx-1.28.2\nginx.exe`.
- Port production warehouse adalah `82`, bukan `80`.
- Backend port adalah `3000`.
- Frontend dev port adalah `5000`.
- Port host PostgreSQL Docker adalah `5433` (port `5432` dipakai project lain).
- Gunakan `deploy\windows\start-dev-fullstack.bat` jika ingin menyalakan backend dan frontend dev sekaligus dalam dua window terpisah.
- Gunakan `deploy\windows\stop-dev-fullstack.bat` jika ingin menghentikan backend dan frontend dev repo ini tanpa mencari PID manual.
- Route `antrian-truk` akan auto-redirect ke `antrian-truk/mobile` pada layar kecil.
- Base path frontend adalah `/material-dashboard-shadcn-vue/`; jangan ubah tanpa menyesuaikan router, Vite base, dan Nginx alias.
- `.env` dan `node_modules` sudah di-gitignore. Jangan commit `.env` atau `node_modules`. Gunakan `.env.example` sebagai template.
- Jangan buat `new PrismaClient()` baru di service/controller; pakai singleton `backend/src/utils/prisma.js`.
- Format tanggal/jam UI memakai helper `src/lib/datetime.ts` (Indonesia, 24 jam, tanpa detik).
- Setelah mengubah route backend, pastikan frontend service wrapper dan role guard tetap sinkron.
- Setelah mengubah schema Prisma, jalankan migrasi/generate yang sesuai.
- Modul Daily Job Activity **tidak menyimpan angka**. Semua nilai dihitung dari `JobTransaction`; kalau angka laporan salah, betulkan transaksinya, jangan menambah field angka di header.
- Waktu transaksi disimpan sebagai wall-clock UTC (input `13:00` disimpan `13:00Z`). Saat membandingkan atau menghitung durasi di frontend, pakai parser wall-clock (`wallClockToMs`), jangan `new Date(localString)`.
- Jangan menambahkan kembali input angka atau tombol auto-fill ke halaman laporan. Laporan bersifat read-only kecuali `notes`.
- Print Daily Job Activity memakai `window.open` + `document.write` dengan `print-color-adjust: exact` agar warna `#B4C6E7`, `#FFFF00`, dan `#33CC33` ikut tercetak.
- Laporan `BATAL` tetap bisa di-print dan di-export, dengan pita merah BATAL + alasan di sheet/print dan prefix `BATAL_` pada nama file Excel.
- Halaman `/transaksi-pekerjaan` adalah tempat input dan tabel transaksi berstatus. Halaman `/daily-job-activity` hanya membaca laporan turunan; detailnya menampilkan lembar kertas, print, dan Excel.
- Query `?date=YYYY-MM-DD` pada `/transaksi-pekerjaan` memfilter satu tanggal; tombol "Transaksi" di halaman laporan memakai mekanisme ini.
- Tampilan modul memakai bahasa visual "dokumen operasional": lembar laporan dirender sebagai kertas putih (selalu putih, termasuk dark mode) dengan angka tabular monospace, dan status ditampilkan sebagai stempel tinta (BERJALAN biru, SELESAI hijau, BATAL merah).
- Daftar laporan memakai chip status berisi hitungan (Semua/Berjalan/Selesai/Kosong/Batal). Hitungan berasal dari `meta.counts`.
- Aksi status transaksi (Proses/Finish/Kembali/Batal/Hapus) ada di tabel Transaksi Pekerjaan, baik baris desktop maupun kartu mobile. Halaman laporan tidak punya aksi status.
- Form transaksi memakai modal: pilih jenis pekerjaan (Receiving/Delivery/Picking/Stuffing), lalu karyawan dari Master Karyawan, tipe truk, qty, dan waktu mulai manual (`datetime-local`). Tombol "Confirm" membuat transaksi berstatus PROSES; "Simpan Draft" menyimpan tanpa waktu mulai.
- Modal Finish hanya meminta tanggal & waktu selesai manual (plus confirmation opsional); validasi `finishAt > startAt` dilakukan di klien dan server.
- Di layar < 1280px lembar kertas diperkecil (zoom 0.62) agar muat tanpa scroll horizontal, dengan tombol Perbesar/Perkecil.
- Setelah mengubah frontend production, jalankan `npm run build` agar `dist/` diperbarui untuk Nginx.
- Setelah perubahan operasional besar, update file ini dan/atau `docs/MIGRATION_A_TO_B.md`.
