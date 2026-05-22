# Dokumentasi Lengkap Warehouse Queue App

Terakhir diperbarui: 2026-05-22

## 1. Ringkasan

`warehouse-queue-app` adalah aplikasi operasional warehouse untuk mengelola:

- antrian truk receiving dan delivery,
- display publik antrian truk,
- dashboard SLA dan laporan operasional,
- master data customer, gate, admin, dan karyawan,
- schedule pengiriman,
- picking progress berbasis proses dan Excel import/export,
- backup, restore, dan migrasi aplikasi antar perangkat Windows.

Project ini terdiri dari:

- backend `Node.js + Express + Prisma`,
- frontend `Vue 3 + Vite + TypeScript`,
- database `PostgreSQL`,
- reverse proxy dan static hosting lokal menggunakan `Nginx` di Windows.

## 2. Modul Utama

### 2.1 Antrian Truk

Modul ini dipakai untuk mencatat truk masuk dan mengawal status proses dari registrasi sampai selesai atau batal.

Fitur utama:

- registrasi antrian receiving atau delivery,
- assignment gate,
- update status operasional,
- catatan warehouse,
- audit log perubahan status,
- export Excel,
- display publik untuk monitor antrian.

### 2.2 Dashboard

Dashboard menampilkan ringkasan operasional dan SLA, antara lain:

- summary total antrian,
- status distribution,
- hourly trend,
- top customer,
- data over SLA,
- monthly report,
- schedule summary,
- picking progress summary.

### 2.3 Master Data

Master data yang dikelola:

- customer,
- gate,
- admin user,
- employee.

### 2.4 Schedule Pengiriman

Schedule dipakai untuk perencanaan pengiriman berdasarkan tanggal, customer, store type, dan komposisi truck type.

### 2.5 Picking Progress

Modul ini dipakai untuk memonitor progres picking per DO, customer, destination, picker, dan target barcode/qty.

Fitur utama:

- create/edit data picking,
- start picking,
- update picked quantity,
- finish picking,
- cancel picking,
- import/export Excel,
- print summary,
- audit log perubahan.

## 3. Workflow Bisnis

### 3.1 Workflow Antrian Truk

Status utama antrian:

`MENUNGGU -> IN_WH -> PROSES -> SELESAI`

Status alternatif:

`MENUNGGU/IN_WH -> BATAL`

Aturan bisnis penting:

- Entry baru selalu dibuat dengan status `MENUNGGU`.
- Warehouse memanggil driver dan mengubah status menjadi `IN_WH`.
- Warehouse memulai bongkar/muat dan mengubah status menjadi `PROSES`.
- Saat pindah ke `PROSES`, Tallyman dapat dipilih. Jika diisi, employee harus ada di master karyawan dengan posisi `TALLYMAN`.
- Entry dapat dibatalkan hanya sampai status `IN_WH` dan alasan cancel wajib diisi.
- `notesFromWh` tidak bisa diubah jika status sudah `SELESAI` atau `BATAL`.
- Backend menjalankan auto-complete setiap 1 jam. Data antrian berumur lebih dari 3 hari yang masih `MENUNGGU`, `IN_WH`, atau `PROSES` akan otomatis ditandai `SELESAI` oleh sistem.

```mermaid
flowchart LR
    A[CS/Admin input antrian] --> B[Status MENUNGGU]
    B --> C[Warehouse panggil driver]
    C --> D[Status IN_WH]
    D --> E[Warehouse proses bongkar atau muat]
    E --> F[Status PROSES]
    F --> G[Status SELESAI]
    B --> H[BATAL dengan alasan]
    D --> H
```

Sumber alur ini sejalan dengan diagram `docs/flowchart-workflow-antrian-trucking.drawio`.

### 3.2 Workflow Picking Progress

Status utama picking:

`MENUNGGU -> ON_PROCESS -> SELESAI`

Status alternatif:

`MENUNGGU/ON_PROCESS -> BATAL`

Aturan bisnis penting:

- Data picking baru dibuat dengan status `MENUNGGU`.
- Start hanya boleh dari status `MENUNGGU`.
- Update `pickedQty` hanya boleh saat status `ON_PROCESS`.
- Finish hanya boleh saat status `ON_PROCESS` dan `pickedQty` harus sama dengan `pickingQty`.
- Cancel mewajibkan alasan.
- `notesFromWh` tidak bisa diubah jika status sudah `SELESAI` atau `BATAL`.

```mermaid
flowchart LR
    A[Create atau import picking] --> B[Status MENUNGGU]
    B --> C[Start picking]
    C --> D[Status ON_PROCESS]
    D --> E[Update pickedQty]
    E --> F{pickedQty = pickingQty?}
    F -- Ya --> G[Finish]
    G --> H[Status SELESAI]
    F -- Belum --> E
    B --> I[BATAL dengan alasan]
    D --> I
```

### 3.3 Workflow Schedule Pengiriman

Alur high level schedule:

1. Admin atau CS membuat schedule pengiriman.
2. Schedule menyimpan tanggal, customer, store type, dan item truck type.
3. Data schedule dipakai untuk monitoring, export, print summary, dan dashboard bulanan.

## 4. Role dan Hak Akses

Role aplikasi:

- `ADMIN`
- `WAREHOUSE`
- `CS`

Ringkasan akses utama:

| Area | ADMIN | WAREHOUSE | CS |
| --- | --- | --- | --- |
| Dashboard | Ya | Ya | Ya |
| Queue list dan detail | Ya | Ya | Ya |
| Queue display publik | Publik | Publik | Publik |
| Create/update/status queue | Ya | Ya | Ya |
| Edit WH notes queue | Tidak | Ya | Tidak |
| Master customer | Ya | Tidak | Tidak |
| Master gate | CRUD | Read | Read |
| Master admin | Ya | Tidak | Tidak |
| Master karyawan | Ya | Tidak | Tidak |
| Picking progress list | Ya | Ya | Ya |
| Edit header picking | Ya | Tidak | Ya |
| Update WH notes picking | Tidak | Ya | Tidak |
| Schedule create/update/delete | Ya | Read only | Ya |

Catatan implementasi:

- Route frontend mengarahkan `WAREHOUSE` dan `CS` ke `/antrian-truk` setelah login.
- Route publik tanpa login adalah `/login` dan `/display/antrian-truk`.
- Token auth disimpan di `localStorage` dan dikirim sebagai `Authorization: Bearer <token>`.

## 5. Tech Stack

### 5.1 Backend

- `Node.js`
- `Express 4`
- `Prisma ORM 6`
- `PostgreSQL`
- `jsonwebtoken`
- `bcryptjs`
- `multer`
- `exceljs`
- `xlsx`

### 5.2 Frontend

- `Vue 3`
- `Vite 7`
- `TypeScript`
- `Vue Router 4`
- `Axios`
- `Tailwind CSS`
- `Radix Vue`
- `Chart.js`
- `vue-chartjs`

### 5.3 Infrastruktur Lokal Windows

- `Nginx for Windows`
- `Docker Compose` untuk PostgreSQL opsional
- `PowerShell` untuk script operasional

## 6. Arsitektur Sistem

### 6.1 Arsitektur Runtime

```mermaid
flowchart TD
    A[Browser Client] --> B[Nginx Windows port 82]
    B --> C[Frontend dist /material-dashboard-shadcn-vue/]
    B --> D[/api proxy/]
    D --> E[Express API port 3000]
    E --> F[Prisma Client]
    F --> G[PostgreSQL queue_db port 5432]
```

### 6.2 URL Penting

- Frontend production lokal: `http://localhost:82/material-dashboard-shadcn-vue/`
- Display publik: `http://localhost:82/material-dashboard-shadcn-vue/display/antrian-truk`
- Backend health check: `http://localhost:3000/health`
- Nginx health check: `http://localhost:82/nginx-health`

### 6.3 Port Penting

| Komponen | Port |
| --- | --- |
| Backend Express | `3000` |
| Frontend dev Vite | `5000` |
| Frontend prod via Nginx | `82` |
| PostgreSQL | `5432` |

## 7. Struktur Repository

```text
backend/                              Backend Express + Prisma
material-dashboard-shadcn-vue-1.0.0/  Frontend Vue + Vite
deploy/windows/                       Script start/stop/backup/restore Windows
docker/                               Docker Compose PostgreSQL
docs/                                 Dokumentasi dan flowchart
nginx-1.28.2/                         Bundled Nginx reference
README.md                             Ringkasan script operasional Windows
```

Folder penting:

- `backend/src/app.js`: mount route dan middleware.
- `backend/src/server.js`: entrypoint backend dan auto-complete job.
- `backend/src/routes/`: definisi endpoint per domain.
- `backend/src/services/`: business logic dan query database.
- `backend/prisma/schema.prisma`: schema relasional utama.
- `backend/prisma/migrations/`: histori perubahan schema.
- `backend/prisma/seed.js`: seed admin default.
- `material-dashboard-shadcn-vue-1.0.0/src/router/index.ts`: route frontend dan guard role.
- `material-dashboard-shadcn-vue-1.0.0/src/services/api.ts`: axios client dengan auth interceptor.
- `material-dashboard-shadcn-vue-1.0.0/vite.config.ts`: base path, dev server, dan proxy `/api`.
- `deploy/windows/start-local-server.ps1`: start backend dan Nginx.
- `deploy/windows/backup-db.ps1`: backup database.
- `deploy/windows/restore-db.ps1`: restore database.

## 8. Database Relasional

### 8.1 Database Default

Contoh konfigurasi dari `backend/.env.example`:

```env
DATABASE_URL=postgresql://sankyu:sankyu39@localhost:5432/queue_db
PORT=3000
NODE_ENV=development
JWT_SECRET=change_this_secret
JWT_EXPIRES_IN=12h
```

### 8.2 Enum Penting

- `QueueStatus`: `MENUNGGU`, `IN_WH`, `PROSES`, `SELESAI`, `BATAL`
- `QueueCategory`: `RECEIVING`, `DELIVERY`
- `AdminRole`: `ADMIN`, `WAREHOUSE`, `CS`
- `WarehouseGate`: `WH1`, `WH2`, `DG`
- `StoreType`: `STORE_IN`, `STORE_OUT`
- `EmployeePosition`: `FOREMAN`, `TALLYMAN`, `OPR_FORKLIFT`
- `PickingStatus`: `MENUNGGU`, `ON_PROCESS`, `SELESAI`, `BATAL`
- `TruckType`: `CDD`, `CDE`, `FUSO`, `WB`, `FT20`, `FT40`, `OTHER`

### 8.3 Entitas Inti

| Tabel/Model | Fungsi |
| --- | --- |
| `QueueEntry` | header antrian truk |
| `QueueLog` | audit log perubahan antrian |
| `Customer` | master customer |
| `Employee` | master karyawan/picker/tallyman |
| `AdminUser` | user login dan role |
| `Gate` | master gate warehouse |
| `ShipmentSchedule` | header schedule pengiriman |
| `ShipmentScheduleItem` | detail truck type per schedule |
| `PickingProgress` | header progres picking |
| `PickingProgressLog` | audit log progres picking |

### 8.4 Relasi Database

```mermaid
erDiagram
    Customer ||--o{ QueueEntry : has
    Gate ||--o{ QueueEntry : assigned_to
    Employee ||--o{ QueueEntry : tallyman
    QueueEntry ||--o{ QueueLog : logs
    AdminUser ||--o{ QueueLog : acts

    Customer ||--o{ ShipmentSchedule : has
    AdminUser ||--o{ ShipmentSchedule : creates
    ShipmentSchedule ||--o{ ShipmentScheduleItem : contains

    Customer ||--o{ PickingProgress : has
    Employee ||--o{ PickingProgress : picks
    AdminUser ||--o{ PickingProgress : creates
    AdminUser ||--o{ PickingProgress : updates
    PickingProgress ||--o{ PickingProgressLog : logs
    AdminUser ||--o{ PickingProgressLog : acts
```

### 8.5 Detail Model Operasional

#### QueueEntry

Kolom penting:

- `customerId`
- `gateId`
- `pickerEmployeeId`
- `category`
- `driverName`
- `truckNumber`
- `containerNumber`
- `transporter`
- `registerTime`
- `inWhTime`
- `startTime`
- `finishTime`
- `slaWaitingMinutes`
- `slaInWhProcessMinutes`
- `status`
- `notes`
- `notesFromWh`

#### QueueLog

Menyimpan histori status/action antrian, termasuk perubahan otomatis oleh sistem.

#### ShipmentSchedule dan ShipmentScheduleItem

Model ini membentuk relasi header-detail schedule:

- `ShipmentSchedule` menyimpan tanggal, customer, store type, pembuat.
- `ShipmentScheduleItem` menyimpan truck type, truck type other, dan qty.

#### PickingProgress

Kolom penting:

- `date`
- `customerId`
- `doNumber`
- `destination`
- `volumeCbm`
- `plTimeRelease`
- `pickingQty`
- `pickedQty`
- `slaPerBarcodeMinutes`
- `startTime`
- `finishTime`
- `status`
- `notesFromWh`
- `pickerEmployeeId`

## 9. API Overview

Semua endpoint dipasang di prefix `/api`, kecuali `/health`.

### 9.1 Auth

- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/logout`

### 9.2 Queue

- `GET /api/queue/display`
- `POST /api/queue`
- `GET /api/queue`
- `GET /api/queue/export`
- `GET /api/queue/:id`
- `PATCH /api/queue/:id`
- `PATCH /api/queue/:id/wh-notes`
- `PATCH /api/queue/:id/status`
- `PATCH /api/queue/:id/set-in-wh`

### 9.3 Customers

- `GET /api/customers`
- `POST /api/customers`
- `GET /api/customers/template`
- `POST /api/customers/import`
- `GET /api/customers/export`
- `PATCH /api/customers/:id`
- `PUT /api/customers/:id`
- `DELETE /api/customers/:id`

### 9.4 Gates

- `GET /api/gates`
- `GET /api/master-gates`
- `POST /api/gates`
- `PATCH /api/gates/:id`
- `PUT /api/gates/:id`
- `DELETE /api/gates/:id`
- `GET /api/gates/template`
- `POST /api/gates/import`
- `GET /api/gates/export`

### 9.5 Employees

- `GET /api/employees`
- `POST /api/employees`
- `GET /api/employees/template`
- `POST /api/employees/import`
- `GET /api/employees/export`
- `PATCH /api/employees/:id`
- `PUT /api/employees/:id`
- `DELETE /api/employees/:id`

### 9.6 Admin Users

- `GET /api/admin-users`
- `POST /api/admin-users`
- `PATCH /api/admin-users/:id`
- `DELETE /api/admin-users/:id`

### 9.7 Dashboard

- `GET /api/dashboard/summary`
- `GET /api/dashboard/schedule-summary`
- `GET /api/dashboard/progress-summary`
- `GET /api/dashboard/picking-progress-summary`
- `GET /api/dashboard/hourly`
- `GET /api/dashboard/status`
- `GET /api/dashboard/top-customers`
- `GET /api/dashboard/over-sla`
- `GET /api/dashboard/monthly-schedule-truck-summary`
- `GET /api/dashboard/monthly-report`

### 9.8 Schedules

- `POST /api/schedules`
- `GET /api/schedules`
- `GET /api/schedules/export`
- `GET /api/schedules/print-summary`
- `GET /api/schedules/:id`
- `PUT /api/schedules/:id`
- `DELETE /api/schedules/:id`

### 9.9 Picking Progress

- `POST /api/picking-progress`
- `GET /api/picking-progress`
- `GET /api/picking-progress/template`
- `GET /api/picking-progress/print-summary`
- `POST /api/picking-progress/import`
- `GET /api/picking-progress/export`
- `GET /api/picking-progress/:id`
- `PATCH /api/picking-progress/:id`
- `PATCH /api/picking-progress/:id/start`
- `PATCH /api/picking-progress/:id/picked-qty`
- `PATCH /api/picking-progress/:id/wh-notes`
- `PATCH /api/picking-progress/:id/finish`
- `PATCH /api/picking-progress/:id/cancel`

## 10. Frontend Overview

### 10.1 Base Path dan Routing

Frontend dibuild dengan base path:

`/material-dashboard-shadcn-vue/`

Implikasinya:

- produksi harus diakses melalui prefix path tersebut,
- router menggunakan `createWebHistory('/material-dashboard-shadcn-vue/')`,
- Vite juga dibuild dengan `base: "/material-dashboard-shadcn-vue/"`.

### 10.2 Route Penting

- `/login`
- `/display/antrian-truk`
- `/dashboard`
- `/master-customer`
- `/master-gate`
- `/master-admin`
- `/master-karyawan`
- `/antrian-truk`
- `/antrian-truk/mobile`
- `/picking-progress`
- `/schedule-pengiriman`

### 10.3 Integrasi API

Frontend menggunakan `axios` client dengan:

- `baseURL: "/api"`
- auto-attach bearer token dari `localStorage`
- auto logout redirect ke `/login` saat menerima `401`

## 11. Cara Development

### 11.1 Prasyarat

- `Node.js` LTS
- `npm`
- `PostgreSQL` lokal atau `Docker`
- opsional `Nginx` jika ingin meniru mode production lokal

### 11.2 Setup Database dengan Docker

```bash
cd docker
docker compose up -d
```

Database default:

- host: `localhost`
- port: `5432`
- db: `queue_db`
- user: `sankyu`

### 11.3 Setup Backend

```bash
cd backend
copy .env.example .env
npm ci
npx prisma generate
npx prisma migrate deploy
npm run seed
```

Catatan:

- `migrate:dev` tersedia untuk pengembangan schema.
- `migrate:deploy` dipakai untuk sinkronisasi schema yang sudah ada.
- seed default membuat user:
  - username: `admin`
  - password: `admin123`
- password default harus segera diganti setelah setup awal.

### 11.4 Setup Frontend

```bash
cd material-dashboard-shadcn-vue-1.0.0
npm ci
```

### 11.5 Menjalankan Development Mode

Opsi 1, manual:

```bash
cd backend
npm run dev
```

```bash
cd material-dashboard-shadcn-vue-1.0.0
npm run dev
```

Opsi 2, helper script Windows:

```bat
cd deploy\windows
start-dev-fullstack.bat
```

Perilaku helper script:

- membuka window backend dan frontend terpisah,
- backend berjalan di port `3000`,
- frontend mencoba port `5000`,
- jika port `5000` sudah dipakai, script akan mencoba `5001` sampai `5010`.

### 11.6 URL Development

- frontend dev: `http://localhost:5000/material-dashboard-shadcn-vue/`
- backend health: `http://localhost:3000/health`

### 11.7 Verifikasi Development

Checklist cepat:

1. `http://localhost:3000/health` mengembalikan `{"ok":true}`.
2. Frontend bisa membuka halaman login.
3. Login berhasil dengan user valid.
4. Data dashboard dan antrian dapat dimuat.

## 12. Cara Deployment

Dokumen ini merangkum deployment lokal Windows yang memang dipakai repo saat ini.

### 12.1 Pola Deployment Production Lokal

Mode ini memakai:

- backend Node.js di port `3000`,
- frontend hasil build `dist`,
- `Nginx` Windows di port `82`,
- proxy `/api` ke `http://127.0.0.1:3000`.

### 12.2 Build Frontend

```bash
cd material-dashboard-shadcn-vue-1.0.0
npm ci
npm run build
```

Output build:

`material-dashboard-shadcn-vue-1.0.0/dist`

### 12.3 Setup Backend Production

```bash
cd backend
npm ci
npx prisma generate
npx prisma migrate deploy
```

Pastikan `backend/.env` berisi minimal:

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/queue_db
PORT=3000
NODE_ENV=production
JWT_SECRET=ganti_dengan_secret_yang_aman
JWT_EXPIRES_IN=12h
```

### 12.4 Start Production Lokal di Windows

```bat
cd deploy\windows
start-local-server.bat
```

Apa yang dilakukan script ini:

- memastikan file backend dan Nginx tersedia,
- mengecek apakah `dist/index.html` sudah ada,
- start backend dengan `node src/server.js` jika port `3000` belum aktif,
- mengetes dan me-reload Nginx,
- menampilkan URL akses lokal dan jaringan.

Konfigurasi penting di script:

- `nginxDir = C:\nginx-1.28.2`
- backend port `3000`
- frontend/Nginx port `82`

Jika lokasi Nginx berbeda, ubah variabel `nginxDir` di:

- `deploy/windows/start-local-server.ps1`
- `deploy/windows/stop-local-server.ps1`

### 12.5 Stop Production Lokal

```bat
cd deploy\windows
stop-local-server.bat
```

Script stop akan:

- menghentikan proses backend yang listen di port `3000`,
- menghentikan proses `nginx.exe` dari direktori Nginx yang dikonfigurasi.

### 12.6 Checklist Deployment

1. Build frontend berhasil dan folder `dist` terbaru tersedia.
2. `backend/.env` sudah benar untuk environment target.
3. Migrasi database sudah dijalankan.
4. `http://localhost:3000/health` merespons normal.
5. `http://localhost:82/material-dashboard-shadcn-vue/` dapat dibuka.
6. Login, dashboard, queue, export, dan display publik sudah diuji.

## 13. Backup, Restore, dan Migrasi Perangkat

### 13.1 Backup Database

```bat
cd deploy\windows
backup-db.bat
```

Fitur script backup:

- membaca `DATABASE_URL` dari `backend/.env`,
- mode `auto`, `host`, atau `docker`,
- default container docker: `queue_system`,
- output default ke `deploy/windows/backups/*.backup`.

Contoh:

```bat
backup-db.bat -Mode docker
backup-db.bat D:\backup\queue_db_manual.backup
```

### 13.2 Restore Database

```bat
cd deploy\windows
restore-db.bat
```

Fitur script restore:

- membaca `DATABASE_URL` dari `backend/.env`,
- default memakai file backup terbaru jika path tidak diberikan,
- meminta konfirmasi manual `YES`,
- mendukung mode `auto`, `host`, dan `docker`.

Contoh:

```bat
restore-db.bat -Mode docker
restore-db.bat D:\backup\queue_db.backup
```

### 13.3 Migrasi Perangkat A ke B

Panduan rinci sudah tersedia di:

- `docs/MIGRATION_A_TO_B.md`

Ringkasan migrasi:

1. Stop service di perangkat lama.
2. Backup database.
3. Salin source project ke perangkat baru.
4. Install dependency backend dan frontend.
5. Build frontend.
6. Set `backend/.env`.
7. Restore database.
8. Jalankan `npx prisma migrate deploy`.
9. Sesuaikan `nginx.conf` dan `nginxDir`.
10. Start aplikasi dan verifikasi dari localhost serta jaringan.

## 14. Operasional Harian

### 14.1 Start Service

```bat
deploy\windows\start-local-server.bat
```

### 14.2 Stop Service

```bat
deploy\windows\stop-local-server.bat
```

### 14.3 Start Development

```bat
deploy\windows\start-dev-fullstack.bat
```

### 14.4 Stop Development

```bat
deploy\windows\stop-dev-fullstack.bat
```

### 14.5 Backup Berkala

```bat
deploy\windows\backup-db.bat
```

## 15. Troubleshooting

### 15.1 Frontend berubah di source tapi production tidak ikut berubah

Penyebab umum:

- frontend belum dibuild ulang,
- folder `dist` yang aktif masih versi lama,
- browser cache.

Solusi:

1. jalankan `npm run build` di folder frontend,
2. pastikan folder `dist` terbaru yang dilayani Nginx,
3. lakukan hard refresh atau incognito.

### 15.2 Frontend bisa dibuka tapi API error

Penyebab umum:

- backend belum berjalan,
- backend belum ikut di-update,
- database tidak reachable,
- token login sudah tidak valid.

Solusi:

1. cek `http://localhost:3000/health`,
2. restart backend,
3. cek `backend/.env`,
4. login ulang.

### 15.3 `404` pada path `/material-dashboard-shadcn-vue/`

Penyebab umum:

- base path frontend tidak cocok dengan path yang dilayani server,
- alias Nginx ke folder `dist` salah,
- hasil build belum tersedia.

Solusi:

1. cek `material-dashboard-shadcn-vue-1.0.0/dist/index.html`,
2. cek path alias di `nginx.conf`,
3. pastikan akses memakai prefix `/material-dashboard-shadcn-vue/`.

### 15.4 `pg_dump` atau `pg_restore` tidak dikenali

Solusi:

1. tambahkan PostgreSQL `bin` ke `PATH`,
2. atau gunakan mode Docker pada script backup/restore.

### 15.5 Port bentrok

Port yang perlu dicek:

- `3000` untuk backend,
- `5000-5010` untuk frontend dev,
- `82` untuk Nginx,
- `5432` untuk PostgreSQL.

## 16. Known Notes

- Root `package.json` bukan aplikasi utama; package utama ada di `backend/` dan `material-dashboard-shadcn-vue-1.0.0/`.
- Project saat ini belum menyediakan script automated test di package utama backend/frontend.
- Dokumentasi deploy frontend detail tambahan juga tersedia di `docs/deploy-production.md`.
- Flowchart operasional queue tersedia di `docs/flowchart-workflow-antrian-trucking.drawio`.

## 17. Referensi Dokumen Lain

- `docs/context-project.md`
- `docs/deploy-production.md`
- `docs/MIGRATION_A_TO_B.md`
- `README.md`
