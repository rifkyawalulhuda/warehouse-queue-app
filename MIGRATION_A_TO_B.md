# Panduan Pindah Server Perangkat A ke Perangkat B (Windows)

Dokumen ini menjelaskan langkah pindah aplikasi `warehouse-queue-app` dari perangkat lama (A) ke perangkat baru (B) secara lengkap, termasuk backup dan restore database.

## 1. Ringkasan Arsitektur

1. Frontend Vue diakses melalui Nginx:
   - URL: `http://<IP_SERVER>/material-dashboard-shadcn-vue/`
2. Backend Node.js berjalan di:
   - `http://127.0.0.1:3000`
3. API diproxy oleh Nginx:
   - `/api/*` -> `127.0.0.1:3000`
4. Database:
   - PostgreSQL (`queue_db`)

## 2. Prasyarat di Perangkat B

1. Node.js LTS terpasang (`node -v`, `npm -v`)
2. PostgreSQL terpasang (`psql --version`)
3. Git terpasang (`git --version`)
4. Nginx for Windows terpasang (contoh: `C:\Users\rifky\Downloads\nginx-1.28.2`)
5. Port `80` dibuka pada firewall Windows

## 3. Langkah di Perangkat A (Sumber)

### 3.1 Hentikan service aplikasi

```bat
cd D:\Github\warehouse-queue-app\deploy\windows
stop-local-server.bat
```

### 3.2 Backup database

```bat
cd D:\Github\warehouse-queue-app\deploy\windows
backup-db.bat
```

Jika PostgreSQL berjalan di Docker dan `pg_dump` tidak ada di host:

```bat
backup-db.bat -Mode docker
```

Catatan:
1. File backup otomatis tersimpan di:
   - `deploy\windows\backups\*.backup`
2. Anda juga bisa set output custom:

```bat
backup-db.bat D:\backup\queue_db_A_to_B.backup
```

### 3.3 Siapkan file yang dipindahkan

1. Folder project:
   - `D:\Github\warehouse-queue-app`
2. File backup database:
   - hasil dari langkah 3.2
3. Opsional, file konfigurasi referensi:
   - `backend\.env`
   - `deploy\windows\start-local-server.ps1`
   - `deploy\windows\stop-local-server.ps1`
   - `C:\Users\rifky\Downloads\nginx-1.28.2\conf\nginx.conf`

## 4. Langkah di Perangkat B (Tujuan)

### 4.1 Letakkan source project

Contoh:
1. Salin folder ke:
   - `D:\Github\warehouse-queue-app`

### 4.2 Install dependency backend

```bat
cd D:\Github\warehouse-queue-app\backend
npm ci
npx prisma generate
```

### 4.3 Install dependency frontend dan build

```bat
cd D:\Github\warehouse-queue-app\material-dashboard-shadcn-vue-1.0.0
npm ci
npm run build
```

### 4.4 Set file `.env` backend

Edit file:
- `D:\Github\warehouse-queue-app\backend\.env`

Contoh:

```env
DATABASE_URL="postgresql://sankyu:sankyu39@localhost:5432/queue_db"
PORT=3000
NODE_ENV=production
JWT_SECRET=ganti_dengan_secret_baru_yang_aman
JWT_EXPIRES_IN=12h
```

## 5. Database Restore di Perangkat B

### 5.1 Pastikan database target ada

Jika belum ada:

```bat
createdb -h localhost -p 5432 -U sankyu queue_db
```

### 5.2 Restore data dari file backup

Opsi 1 (pakai file terbaru di folder `backups`):

```bat
cd D:\Github\warehouse-queue-app\deploy\windows
restore-db.bat
```

Jika PostgreSQL berjalan di Docker dan `pg_restore` tidak ada di host:

```bat
restore-db.bat -Mode docker
```

Opsi 2 (pakai file tertentu):

```bat
restore-db.bat D:\backup\queue_db_A_to_B.backup
```

Saat diminta konfirmasi, ketik:
- `YES`

### 5.3 Jalankan migrasi deploy (aman untuk sinkron schema)

```bat
cd D:\Github\warehouse-queue-app\backend
npx prisma migrate deploy
```

## 6. Konfigurasi Nginx di Perangkat B

### 6.1 Edit `nginx.conf`

File:
- `<NGINX_DIR>\conf\nginx.conf`

Pastikan `alias` frontend mengarah ke path perangkat B:
- `D:/Github/warehouse-queue-app/material-dashboard-shadcn-vue-1.0.0/dist/`

### 6.2 Uji config Nginx

```bat
cd <NGINX_DIR>
nginx.exe -t
```

## 7. Sesuaikan Script Deploy Windows

Edit file:
- `D:\Github\warehouse-queue-app\deploy\windows\start-local-server.ps1`
- `D:\Github\warehouse-queue-app\deploy\windows\stop-local-server.ps1`

Ubah variabel:
- `$nginxDir = "<path_nginx_di_perangkat_B>"`

## 8. Buka Firewall di Perangkat B

```bat
netsh advfirewall firewall add rule name="WarehouseQueue HTTP" dir=in action=allow protocol=TCP localport=80
```

## 9. Jalankan Aplikasi di Perangkat B

```bat
cd D:\Github\warehouse-queue-app\deploy\windows
start-local-server.bat
```

## 10. Checklist Verifikasi

1. Dari perangkat B:
   - `http://localhost/material-dashboard-shadcn-vue/` harus terbuka
2. Dari perangkat B:
   - `http://localhost:3000/health` harus balas `{"ok":true}`
3. Dari perangkat lain di jaringan:
   - `http://<IP_PERANGKAT_B>/material-dashboard-shadcn-vue/` harus terbuka
4. Login berhasil
5. Data dashboard, antrian, schedule tampil normal
6. Export/print/paging suara berjalan normal

## 11. Troubleshooting Cepat

1. `401 Unauthorized` saat akses `/api/*`:
   - normal jika belum login
2. `404` untuk `/material-dashboard-shadcn-vue/`:
   - cek `nginx.conf` dan path `alias` dist
3. `pg_dump` atau `pg_restore` tidak dikenali:
   - tambahkan PostgreSQL `bin` ke PATH
   - atau jalankan mode Docker:
     - `backup-db.bat -Mode docker`
     - `restore-db.bat -Mode docker`
4. Port `80` tidak bisa listen:
   - ada aplikasi lain pakai port 80, hentikan dulu
5. Akses LAN gagal:
   - cek firewall, IP server, dan pastikan 1 subnet

## 12. Operasional Harian

1. Start:
   - `deploy\windows\start-local-server.bat`
2. Stop:
   - `deploy\windows\stop-local-server.bat`
3. Backup berkala:
   - `deploy\windows\backup-db.bat`
