# Context Project - Warehouse Queue App

Terakhir diperbarui: 2026-04-26

## Ringkasan

`warehouse-queue-app` adalah aplikasi manajemen antrian truk dan aktivitas warehouse untuk operasional Sankyu. Project ini terdiri dari frontend Vue/Vite, backend Node.js/Express, database PostgreSQL via Prisma ORM, serta konfigurasi local production di Windows menggunakan Nginx.

Fitur utama:

- Manajemen antrian truk receiving/delivery.
- Display publik antrian truk.
- Dashboard operasional dan laporan SLA.
- Master customer, gate, admin/user, dan karyawan.
- Schedule pengiriman.
- Picking progress, termasuk import/export Excel dan print summary.
- Backup/restore database untuk pindah perangkat A ke B.

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
D:\Github\warehouse-queue-app\MIGRATION_A_TO_B.md
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

- PostgreSQL dapat berjalan via Docker Compose.
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
docs/                                 Diagram workflow draw.io/PDF
nginx-1.28.2/                         Nginx bundled/config reference repo
MIGRATION_A_TO_B.md                   Panduan pindah server/laptop A ke B
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
backend/prisma/schema.prisma          Schema database Prisma
backend/prisma/migrations/            Riwayat migrasi database
backend/prisma/seed.js                Seed admin default
backend/.env                          Runtime env lokal, jangan commit secret baru
backend/.env.example                  Contoh env
```

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
material-dashboard-shadcn-vue-1.0.0/vite.config.ts            Base path, dev server, proxy
```

## Database

Database default lokal:

```text
Host: localhost
Port: 5432
Database: queue_db
User: sankyu
```

Contoh `DATABASE_URL` dari `.env.example`:

```env
DATABASE_URL=postgresql://sankyu:sankyu39@localhost:5432/queue_db
PORT=3000
NODE_ENV=development
JWT_SECRET=change_this_secret
JWT_EXPIRES_IN=12h
```

Docker Compose database berada di:

```text
D:\Github\warehouse-queue-app\docker\docker-compose.yml
```

Service Docker:

```yaml
services:
  postgres:
    image: postgres:16
    container_name: queue_system
    ports:
      - "5432:5432"
```

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

- `QueueEntry`: data antrian truk, status, gate, customer, SLA, timestamp masuk/proses/selesai, catatan WH.
- `QueueLog`: audit log perubahan antrian dan status.
- `Customer`: master customer dan relasi ke antrian, schedule, picking.
- `Employee`: master karyawan/picker.
- `AdminUser`: user login, role, password hash, relasi audit.
- `Gate`: master gate berdasarkan nomor gate dan warehouse.
- `ShipmentSchedule`: header schedule pengiriman.
- `ShipmentScheduleItem`: detail qty truck type per schedule.
- `PickingProgress`: progres picking per DO/customer/destination.
- `PickingProgressLog`: audit log picking progress.

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

## Auth dan Role

Role aplikasi:

```text
ADMIN
WAREHOUSE
CS
```

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
/material-dashboard-shadcn-vue/picking-progress      ADMIN/WAREHOUSE/CS
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
npm ci
npx prisma generate
npx prisma migrate deploy
npm run dev
```

Frontend development:

```bat
cd D:\Github\warehouse-queue-app\material-dashboard-shadcn-vue-1.0.0
npm ci
npm run dev
```

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
npm ci
npm run build
```

Install/generate backend:

```bat
cd D:\Github\warehouse-queue-app\backend
npm ci
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

## Migrasi Perangkat A ke B

Panduan utama:

```text
D:\Github\warehouse-queue-app\MIGRATION_A_TO_B.md
```

Ringkasan ritual pindah laptop/server:

```bat
git pull
cd D:\Github\warehouse-queue-app\docker
docker compose up -d

cd D:\Github\warehouse-queue-app\backend
npm ci
npx prisma generate
npx prisma migrate deploy

cd D:\Github\warehouse-queue-app\material-dashboard-shadcn-vue-1.0.0
npm ci
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
2. Cek port `5432`.
3. Cek `backend/.env` dan `DATABASE_URL`.
4. Jalankan `npx prisma generate`.
5. Jalankan `npx prisma migrate deploy`.

Jika frontend dev API gagal:

- Cek backend hidup di `localhost:3000`.
- Cek Vite proxy di `vite.config.ts`.
- Frontend Axios memakai `baseURL: '/api'`, jadi proxy/Nginx yang menentukan backend target.

## Catatan Untuk Codex / Agent Berikutnya

- Ikuti instruksi RTK lokal: shell command sebaiknya diprefix `rtk`.
- Jangan menghapus atau menghentikan proses Nginx lain sembarangan. Mesin ini juga punya Herd Nginx dan XAMPP Apache.
- Jangan anggap semua proses bernama `nginx` milik project ini. Untuk warehouse, path yang benar adalah `C:\nginx-1.28.2\nginx.exe`.
- Port production warehouse adalah `82`, bukan `80`.
- Backend port adalah `3000`.
- Frontend dev port adalah `5000`.
- Base path frontend adalah `/material-dashboard-shadcn-vue/`; jangan ubah tanpa menyesuaikan router, Vite base, dan Nginx alias.
- Setelah mengubah route backend, pastikan frontend service wrapper dan role guard tetap sinkron.
- Setelah mengubah schema Prisma, jalankan migrasi/generate yang sesuai.
- Setelah mengubah frontend production, jalankan `npm run build` agar `dist/` diperbarui untuk Nginx.
- Setelah perubahan operasional besar, update file ini dan/atau `MIGRATION_A_TO_B.md`.
