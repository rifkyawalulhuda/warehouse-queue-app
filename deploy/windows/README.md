# Windows Local Server Scripts

File:
- `start-local-server.bat`
- `stop-local-server.bat`
- `start-local-server.ps1`
- `stop-local-server.ps1`
- `backup-db.bat`
- `restore-db.bat`
- `backup-db.ps1`
- `restore-db.ps1`
- `MIGRATION_A_TO_B.md`

## Cara pakai

1. Pastikan path `NGINX_DIR` di kedua file `.bat` sesuai lokasi Nginx Anda.
2. Jalankan dari Command Prompt / PowerShell:

```bat
cd D:\Github\warehouse-queue-app\deploy\windows
start-local-server.bat
```

Untuk stop:

```bat
cd D:\Github\warehouse-queue-app\deploy\windows
stop-local-server.bat
```

Panduan pindah perangkat (A -> B):
- Lihat: `deploy/windows/MIGRATION_A_TO_B.md`

Backup database:

```bat
cd D:\Github\warehouse-queue-app\deploy\windows
backup-db.bat
```

Backup database pakai mode Docker:

```bat
backup-db.bat -Mode docker
```

Backup database ke file custom:

```bat
backup-db.bat D:\backup\queue_db_manual.backup
```

Restore database (otomatis ambil file backup terbaru di folder `backups`):

```bat
restore-db.bat
```

Restore database pakai mode Docker:

```bat
restore-db.bat -Mode docker
```

Restore dari file tertentu:

```bat
restore-db.bat D:\backup\queue_db.backup
```

## Catatan

- File `.bat` adalah wrapper untuk menjalankan `.ps1`.
- Jika lokasi Nginx berbeda, edit variabel `nginxDir` di file `.ps1`.
- Script `start` akan:
  - cek backend di port `3000`
  - start backend jika belum aktif
  - test config Nginx
  - reload/start Nginx
- Script `stop` akan:
  - stop backend berdasarkan listener port `3000`
  - stop semua proses `nginx.exe`
- Script `backup-db` / `restore-db` membaca `DATABASE_URL` dari `backend/.env`
- `backup-db` / `restore-db` mendukung mode:
  - `auto` (default): host dulu, fallback ke docker jika command host tidak ada
  - `host`: paksa `pg_dump/pg_restore` dari host
  - `docker`: paksa `docker exec` ke container PostgreSQL
- Default nama container docker: `queue_system` (bisa override: `-DockerContainer <nama>`)
