# Panduan Deploy Production - Warehouse Queue App

Terakhir diperbarui: 2026-05-09

## Tujuan

Dokumen ini menjelaskan langkah deploy ke production untuk project `warehouse-queue-app` di environment Windows + Nginx secara runut, jelas, dan aman.

Panduan ini juga menjawab kasus umum:

- Perubahan terlihat di development.
- Tetapi perubahan tidak terlihat di production.

Penyebab paling sering adalah frontend production membaca hasil build di folder `dist`, bukan langsung membaca file source `.vue` di folder `src`.

## Ringkasan Struktur

Path penting:

```text
<REPO_ROOT>\backend
<REPO_ROOT>\material-dashboard-shadcn-vue-1.0.0
<REPO_ROOT>\material-dashboard-shadcn-vue-1.0.0\dist
<REPO_ROOT>\nginx-1.28.2\conf\nginx.conf
<REPO_ROOT>\deploy\windows\start-local-server.ps1
<REPO_ROOT>\deploy\windows\stop-local-server.ps1
```

Frontend:

- Source ada di `material-dashboard-shadcn-vue-1.0.0\src`
- Hasil build production ada di `material-dashboard-shadcn-vue-1.0.0\dist`

Backend:

- Source ada di `backend\src`
- Server API berjalan di port `3000`

Nginx:

- Menyajikan frontend dari folder `dist`
- Meneruskan request `/api/` ke backend

## Kenapa Perubahan Dev Bisa Muncul, Tapi Production Tidak

Development:

- Saat `npm run dev`, Vite membaca file source terbaru langsung dari folder `src`.
- Karena itu perubahan kecil langsung terlihat.

Production:

- Nginx tidak membaca file `.vue` di `src`.
- Nginx membaca file hasil build di folder `dist`.
- Jika Anda hanya copy file source tanpa build ulang frontend, production tetap menampilkan versi lama.

Selain itu, folder `assets` pada production bisa ter-cache oleh browser, sehingga setelah deploy kadang perlu hard refresh.

## Kapan Harus Build Frontend

Wajib build ulang frontend jika perubahan ada di area berikut:

- `material-dashboard-shadcn-vue-1.0.0\src\...`
- `material-dashboard-shadcn-vue-1.0.0\index.html`
- `material-dashboard-shadcn-vue-1.0.0\vite.config.ts`
- style, layout, komponen, view, route, atau logic frontend

Contoh:

- mengubah tampilan mobile
- mengubah filter
- mengubah footer
- mengubah modal
- mengubah validasi input frontend

## Kapan Harus Restart Backend

Wajib restart backend jika perubahan ada di area berikut:

- `backend\src\...`
- controller
- service
- route
- middleware
- Prisma/backend logic

Contoh:

- ubah endpoint API
- ubah validasi data di server
- ubah proses set status
- ubah export backend

## Alur Deploy Production yang Direkomendasikan

Ikuti urutan ini setiap deploy.

### 1. Pastikan file yang berubah memang benar

Cek dulu apakah yang berubah frontend, backend, atau keduanya.

Patokan cepat:

- Jika file yang berubah ada di `material-dashboard-shadcn-vue-1.0.0\src`, berarti perlu build frontend.
- Jika file yang berubah ada di `backend\src`, berarti perlu restart backend.

### 2. Backup ringan sebelum deploy

Sangat disarankan:

1. Backup database jika perubahan cukup penting.
2. Simpan copy folder `dist` lama bila ingin rollback cepat.
3. Catat waktu deploy.

Jika perlu backup database, gunakan script di folder `deploy\windows`.

### 3. Build frontend production

Masuk ke folder frontend:

```powershell
cd <REPO_ROOT>\material-dashboard-shadcn-vue-1.0.0
```

Jalankan build:

```powershell
npm run build
```

Hasil yang diharapkan:

- proses build selesai tanpa error
- folder `dist` ter-update
- file `dist\index.html` dan `dist\assets\...` punya timestamp baru

Catatan:

- Jangan hanya copy file `.vue` ke server lalu berharap production berubah.
- Yang harus ikut ter-deploy adalah hasil build di folder `dist`.

### 4. Deploy hasil frontend ke production

Jika production berjalan dari repo/folder yang sama:

- cukup pastikan folder `dist` hasil build terbaru memang ada di lokasi yang dibaca Nginx

Jika production berjalan dari folder lain atau mesin lain:

1. Copy isi folder `material-dashboard-shadcn-vue-1.0.0\dist`
2. Tempatkan ke lokasi frontend production yang dibaca Nginx
3. Pastikan semua file asset baru ikut tercopy

Yang harus dipastikan:

- `index.html` terbaru ikut tercopy
- seluruh isi `dist\assets\` terbaru ikut tercopy
- file asset lama tidak menimpa file baru

### 5. Deploy backend jika ada perubahan backend

Masuk ke folder backend:

```powershell
cd <REPO_ROOT>\backend
```

Jika perubahan hanya file JavaScript backend biasa, biasanya cukup:

1. copy source backend terbaru ke server production
2. restart proses backend

Jika ada perubahan dependency:

```powershell
npm install
```

Jika ada perubahan Prisma schema atau migrasi, lakukan langkah tambahan sesuai perubahan tersebut sebelum start ulang backend.

### 6. Reload atau restart service

Jika hanya frontend berubah:

- biasanya cukup update isi `dist`
- jika perlu, reload Nginx

Jika backend berubah:

- restart backend

Script yang tersedia di repo:

Start server:

```powershell
cd <REPO_ROOT>\deploy\windows
.\start-local-server.ps1
```

Stop server:

```powershell
cd <REPO_ROOT>\deploy\windows
.\stop-local-server.ps1
```

Catatan:

- script start akan mengecek backend dan Nginx
- script start akan reload Nginx jika sudah berjalan
- script start akan memberi peringatan jika `dist` belum ada

### 7. Verifikasi setelah deploy

Setelah deploy, cek ini satu per satu:

1. Buka URL production.
2. Tekan hard refresh.
3. Coba buka mode incognito/private.
4. Cek fitur yang baru diubah.
5. Pastikan API masih berjalan normal.

Untuk frontend mobile, cek langsung perilaku UI yang diubah, misalnya:

- footer mobile tidak sticky
- filter mobile default tersembunyi
- input Tallyman tidak freeze saat hasil pencarian kosong

## Hard Refresh Setelah Deploy

Karena asset production bisa ter-cache, lakukan salah satu:

- `Ctrl + F5`
- `Ctrl + Shift + R`
- buka incognito/private window

Jika di browser biasa belum berubah tetapi di incognito sudah berubah, hampir pasti masalahnya cache browser.

## Checklist Deploy Frontend Sederhana

Gunakan checklist ini untuk perubahan UI kecil:

1. Edit file di `src`
2. Jalankan `npm run build`
3. Pastikan folder `dist` ter-update
4. Copy folder `dist` terbaru ke production
5. Reload Nginx bila perlu
6. Hard refresh browser
7. Verifikasi hasil

## Checklist Deploy Backend Sederhana

Gunakan checklist ini untuk perubahan API/logic server:

1. Copy file backend terbaru
2. Jalankan `npm install` jika dependency berubah
3. Jalankan langkah Prisma jika schema berubah
4. Restart backend
5. Tes endpoint atau fitur yang terkait

## Skenario Paling Umum

### Kasus A - Ubah tampilan frontend saja

Contoh:

- ubah footer mobile
- ubah default filter mobile
- ubah modal frontend

Langkah:

1. Edit source frontend
2. Jalankan `npm run build` di folder frontend
3. Deploy hasil `dist`
4. Hard refresh browser

Tidak perlu restart backend jika backend tidak berubah.

### Kasus B - Ubah backend saja

Contoh:

- ubah validasi API
- ubah service queue

Langkah:

1. Copy source backend terbaru
2. Restart backend
3. Verifikasi fitur

Tidak perlu build frontend jika tidak ada perubahan frontend.

### Kasus C - Ubah frontend dan backend

Langkah:

1. Build frontend
2. Deploy `dist`
3. Deploy backend
4. Restart backend
5. Reload Nginx bila perlu
6. Hard refresh browser

## Troubleshooting

### 1. Production tidak berubah, padahal source sudah dicopy

Penyebab paling mungkin:

- hanya file `src` yang dicopy
- folder `dist` belum dibuild ulang

Solusi:

1. jalankan `npm run build` di frontend
2. deploy folder `dist` terbaru

### 2. Di dev berubah, di production tidak

Penyebab paling mungkin:

- dev membaca source langsung
- production membaca hasil build lama

Solusi:

1. build ulang frontend
2. deploy ulang `dist`

### 3. Sudah build dan deploy, tapi browser tetap tampak lama

Penyebab paling mungkin:

- cache browser

Solusi:

1. hard refresh
2. buka incognito
3. pastikan `index.html` dan `assets` benar-benar versi baru

### 4. Asset campur antara versi lama dan baru

Penyebab paling mungkin:

- file deploy tidak lengkap
- `index.html` baru menunjuk ke asset baru, tetapi asset baru belum ikut tercopy

Solusi:

1. copy seluruh isi `dist`
2. pastikan `dist\assets\` terbaru ikut semua

### 5. Frontend berubah, tapi API error

Penyebab paling mungkin:

- frontend sudah baru
- backend belum di-restart atau belum ikut di-update

Solusi:

1. cek apakah ada perubahan backend
2. restart backend
3. cek log backend

## Rekomendasi Praktis

Untuk setiap deploy kecil frontend, biasakan pola berikut:

1. edit source
2. build frontend
3. deploy `dist`
4. hard refresh

Untuk menghindari lupa, anggap aturan ini selalu benar:

> Jika yang diubah adalah file frontend di `src`, maka production baru berubah setelah `npm run build` dan hasil `dist` dipakai oleh server.

## Catatan Penutup

Jika nanti diinginkan, dokumen ini bisa dikembangkan lagi menjadi:

- SOP deploy singkat 1 halaman
- SOP rollback production
- SOP deploy frontend saja
- SOP deploy backend saja
- checklist verifikasi pasca deploy
