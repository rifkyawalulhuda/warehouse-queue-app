# Desain: Integrasi Schedule Pengiriman ↔ Antrian Truk

Status: **draft untuk sign-off**
Tanggal: 2026-11-27
Cakupan: Phase 1 (Schedule Pengiriman dinamis) + Phase 2 (input Antrian Truk terhubung) + Report plan vs actual

---

## 1. Tujuan

1. Schedule Pengiriman berisi data per truk: plat nomor, estimasi start, estimasi finish, transporter, driver (opsional), container (opsional).
2. Antrian Truk bisa mengambil data truk dari Schedule Pengiriman lewat dropdown searchable, dengan autofill dan override.
3. Data plan (estimasi) dan data aktual (antrian) bisa dibandingkan dalam satu report.

Basis waktu:
- **Plan** = `plannedStart` dan `plannedFinish` dari schedule item.
- **Aktual** = `registerTime` (truk tiba) dan `finishTime` (selesai) dari queue entry.

---

## 2. Keputusan yang sudah dikunci

| # | Keputusan |
|---|---|
| Q1 | 1 baris schedule = 1 truk. `qty` dihapus. |
| Q2 | Semua field baru di level item. Customer tetap di header. |
| Q3 | Keterlambatan lintas hari adalah kasus nyata (plan 24/11 09:00, aktual 25/11 10:00). |
| Q4 | Aktual = `registerTime` apa adanya. Tidak ada field jam tiba terpisah. |
| Q5 | Kunci dropdown = `scheduleItemId`, bukan plat. |
| Q6 | Snapshot nilai plan disimpan di queue entry. |
| Q7 | Item schedule yang sudah terpakai tidak bisa dihapus. |
| Q8 | Report = halaman baru + export Excel. |
| Q10/S1 | Sistem menandai no-show otomatis; ADMIN yang menutup. |
| Q11 | `truckType` ditambahkan ke `QueueEntry`, opsional untuk walk-in. |
| Q12/R9 | Transporter = master data, FK + snapshot teks. |
| R1 | `registerTime` bebas diisi; **hanya ADMIN yang boleh mengedit** setelah dibuat. |
| R2/S6 | Report dua tabel (basis plan dan basis aktual), masing-masing dengan kolom variance. |
| R3 | Jendela overdue dropdown = 7 hari ke belakang. |
| R5/S4 | Maksimal 1 antrian aktif per item. Hanya `BATAL` yang membebaskan slot; `SELESAI` tetap menempati. |
| R6/S5 | **1 baris = 1 kedatangan fisik, container boleh banyak.** (S5 membatalkan R6.) |
| R7/S11 | Data lama `qty > 1` dipecah jadi N baris; kolom `qty` dihapus; print summary memakai count. |
| R8 | `truckType` opsional untuk walk-in. |
| R10/S10 | Toleransi on-time = `AppSetting` global, 2 angka (arrival & finish), retroaktif. |
| R11 | Dropdown difilter kategori; kategori terisi otomatis dari `storeType`. |
| S2 | Auto-complete 3 hari memakai `createdAt`, bukan `registerTime`. |
| S3 | Backdate `registerTime` maksimal 7 hari. |
| S7 | Report menampilkan customer plan dan customer aktual. |
| S8 | Plat terkunci saat queue entry terhubung ke schedule item. |
| S9 | Transporter baru bisa ditambah inline dari form antrian. |
| S12 | Item yang sudah dipakai ditolak dengan pesan jelas. |
| T1 | `containerNumbers` array di **kedua** sisi (plan dan aktual). |
| T2 | On-time = tidak terlambat; datang lebih awal tetap on-time. |
| T3 | Backdate 7 hari untuk semua role; ADMIN boleh melebihi dengan log audit. |
| T4 | Grace no-show = 24 jam setelah `plannedFinish`. |
| T5 | Export report terbuka untuk ketiga role. |

### 2.1 Kontradiksi yang diselesaikan

| Konflik | Resolusi |
|---|---|
| Q10 "no-show otomatis" vs R4 "manual ADMIN" | Sistem menandai `NO_SHOW`, ADMIN menutup jadi `NO_SHOW_CLOSED`. Dua langkah, bukan dua mekanisme. |
| R6 "2 container = 2 baris" vs S5 "1 baris, container banyak" | S5 menang. Container menjadi array di satu baris. |
| Q1 "1 baris = 1 truk" vs S5 | Konsisten: satu baris = satu kedatangan truk, container-nya banyak. |
| R1 "registerTime bebas" vs auto-complete 3 hari | Auto-complete memakai `createdAt` (S2). Entri backdate tidak langsung ditutup. |
| R1 "bebas" vs S3 "maks 7 hari" | S3 yang mengikat: create maksimal 7 hari ke belakang, edit hanya ADMIN. |

---

## 3. Perubahan Skema

### 3.1 Enum baru

```prisma
enum ScheduleItemStatus {
  PLANNED          // belum ada antrian
  LINKED           // sudah ada antrian aktif
  NO_SHOW          // ditandai sistem, masih bisa ditautkan
  NO_SHOW_CLOSED   // ditutup ADMIN, final
}
```

### 3.2 Model baru

```prisma
model Transporter {
  id        String   @id @default(uuid())
  name      String   @unique
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  scheduleItems ShipmentScheduleItem[]
  queueEntries  QueueEntry[]

  @@index([name])
}

model AppSetting {
  key             String   @id
  value           String
  updatedAt       DateTime @updatedAt
  updatedByUserId String?

  @@index([updatedByUserId])
}
```

Key `AppSetting` yang dipakai:

| Key | Default | Arti |
|---|---|---|
| `report.onTimeToleranceArrivalMinutes` | `15` | Toleransi keterlambatan tiba |
| `report.onTimeToleranceFinishMinutes` | `15` | Toleransi keterlambatan selesai |
| `schedule.backdateMaxDays` | `7` | Batas backdate `registerTime` |
| `schedule.overdueWindowDays` | `7` | Jendela overdue di dropdown |
| `schedule.noShowGraceHours` | `24` | Jeda setelah `plannedFinish` sebelum ditandai `NO_SHOW` |

### 3.3 `ShipmentScheduleItem`

```prisma
model ShipmentScheduleItem {
  id             String           @id @default(uuid())
  scheduleId     String
  schedule       ShipmentSchedule @relation(fields: [scheduleId], references: [id], onDelete: Cascade)

  truckType      TruckType
  truckTypeOther String?

  plateNumber      String?          // nullable untuk data lama, wajib untuk data baru
  transporterId    String?
  transporter      Transporter?     @relation(fields: [transporterId], references: [id], onDelete: SetNull)
  driverName       String?
  containerNumbers String[]         @default([])

  plannedStart   DateTime?
  plannedFinish  DateTime?

  status               ScheduleItemStatus @default(PLANNED)
  noShowMarkedAt       DateTime?
  noShowClosedAt       DateTime?
  noShowClosedByUserId String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  queueEntries QueueEntry[]

  @@index([scheduleId])
  @@index([plateNumber])
  @@index([plannedStart])
  @@index([status, plannedFinish])
  @@index([transporterId])
}
```

`qty` dihapus. Print summary yang lama menjumlah `qty` per tipe truk diganti `count(*)`.

### 3.4 `QueueEntry`

Field baru:

```prisma
  truckType        TruckType?
  transporterId    String?
  transporter      Transporter? @relation(fields: [transporterId], references: [id], onDelete: SetNull)
  containerNumbers String[]     @default([])

  scheduleItemId String?              @unique(map: "queue_entry_active_schedule_item_unique")
  scheduleItem   ShipmentScheduleItem? @relation(fields: [scheduleItemId], references: [id], onDelete: Restrict)

  // snapshot plan saat antrian dibuat
  plannedStart            DateTime?
  plannedFinish           DateTime?
  plannedPlateNumber      String?
  plannedTruckType        TruckType?
  plannedCustomerId       String?
  plannedCustomerName     String?
  plannedTransporterName  String?
  plannedDriverName       String?
  plannedContainerNumbers String[] @default([])

  // penanda data yang ditutup sistem, bukan operator
  autoCompleted   Boolean   @default(false)
  autoCompletedAt DateTime?
```

Catatan: `@unique` di Prisma **tidak cukup**, karena `BATAL` harus membebaskan slot. Karena itu unique index dibuat sebagai **partial index** di migrasi SQL:

```sql
CREATE UNIQUE INDEX "queue_entry_active_schedule_item_unique"
ON "QueueEntry" ("scheduleItemId")
WHERE "scheduleItemId" IS NOT NULL AND status <> 'BATAL';
```

### 3.5 Kolom yang dihapus

| Kolom | Alasan |
|---|---|
| `ShipmentScheduleItem.qty` | 1 baris = 1 truk (R7) |
| `QueueEntry.containerNumber` | diganti `containerNumbers String[]` (S5) |

---

## 4. Aturan Bisnis

### 4.1 Relasi plan → aktual

1. Queue entry dibuat dengan `scheduleItemId` opsional. Null = walk-in.
2. Saat `scheduleItemId` diisi, server menyalin snapshot plan **dari database**, bukan dari payload. Ini mencegah client memalsukan nilai plan.
3. Override hanya menyentuh field aktual (`truckNumber`, `transporterId`, `customerId`, `driverName`, `containerNumbers`, `truckType`). Snapshot plan tidak pernah berubah karena override.
4. Item schedule yang terhubung tidak bisa dihapus (`onDelete: Restrict` + validasi service).
5. `plateNumber` di queue entry terkunci selama `scheduleItemId` terisi. Untuk mengubah plat, operator harus melepas link.
6. Melepas link (`scheduleItemId = null`) mengosongkan snapshot plan dan mengembalikan item ke `PLANNED`. Hanya ADMIN.

### 4.2 Siklus status item schedule

```
PLANNED ──(antrian dibuat)──> LINKED
   │                             │
   │                             └──(antrian BATAL)──> PLANNED
   │
   └──(plannedFinish + grace lewat, tanpa antrian)──> NO_SHOW
                                                          │
                                        (ADMIN tutup)─────┴──> NO_SHOW_CLOSED
```

- `NO_SHOW` **masih bisa ditautkan** selama masih dalam jendela 7 hari (R3). Ini yang membuat truk telat sehari tetap tercatat, sesuai Q3.
- `NO_SHOW_CLOSED` final, tidak muncul di dropdown.
- Penandaan `NO_SHOW` dijalankan job berkala yang sudah ada (`server.js`), digabung dengan job auto-complete.

### 4.3 Auto-complete antrian (perubahan)

Sekarang: `registerTime < now - 3 hari` → `SELESAI`, `finishTime = now`.
Menjadi: `createdAt < now - 3 hari` → `SELESAI`, `finishTime = now`, `autoCompleted = true`.

Alasan: dengan backdate sampai 7 hari, entri yang baru diinput bisa langsung tertutup dengan durasi palsu.

Entri `autoCompleted = true` dikecualikan dari perhitungan variance finish dan ditandai di report.

### 4.4 Validasi input

| Aturan | Pesan |
|---|---|
| `plannedFinish > plannedStart` | "Estimasi Finish harus setelah Estimasi Start" |
| Shift lewat tengah malam (23:00 → 01:00) | Finish dihitung H+1, tidak ditolak |
| `plannedStart` wajib untuk item baru | "Estimasi Start wajib diisi" |
| `plateNumber` wajib untuk item baru | "Plat Nomor wajib diisi" |
| Plat dinormalisasi | uppercase, spasi dihapus: `b 1234 xyz` → `B1234XYZ` |
| `registerTime` ≥ now − 7 hari (non-ADMIN) | "Tanggal tidak boleh lebih dari 7 hari ke belakang" |
| `registerTime` edit hanya ADMIN | "Hanya Admin yang bisa mengubah waktu registrasi" |
| Item sudah punya antrian aktif | "Truk ini sudah memiliki antrian aktif" |
| Item `NO_SHOW_CLOSED` | "Jadwal ini sudah ditutup" |
| Kategori tidak cocok | Dropdown sudah difilter, server tetap memvalidasi: `storeType` → `RECEIVING`/`DELIVERY` |

---

## 5. Kontrak API

### 5.1 Schedule

`POST /api/schedules` dan `PUT /api/schedules/:id`

```json
{
  "scheduleDate": "2026-11-24",
  "storeType": "STORE_OUT",
  "customerId": "uuid",
  "items": [
    {
      "id": "uuid-atau-null",
      "truckType": "FT20",
      "truckTypeOther": null,
      "plateNumber": "B1234XYZ",
      "transporterId": "uuid",
      "driverName": "Budi",
      "containerNumbers": ["TCLU1234567", "TCLU7654321"],
      "plannedStart": "09:00",
      "plannedFinish": "11:30"
    }
  ]
}
```

- `plannedStart` / `plannedFinish` dikirim sebagai `HH:mm`, digabung dengan `scheduleDate` di server.
- `PUT` memakai diff berbasis `id`: ada `id` → update, tanpa `id` → create, item lama yang hilang → delete. Delete ditolak jika item punya queue entry.
- Field plan (`plannedStart`, `plannedFinish`, `plateNumber`, `transporterId`, `driverName`, `containerNumbers`) **boleh** diubah setelah terhubung, tetapi setiap perubahan dicatat di log. Nilai snapshot di queue entry tidak ikut berubah — itu justru tujuan snapshot (Q6).

`GET /api/schedules/available-items`

Query: `category` (`RECEIVING`/`DELIVERY`), `search`, `dateFrom`, `dateTo`, `limit`.

Filter: `status IN (PLANNED, NO_SHOW)`, `plannedStart` dalam jendela (default 7 hari ke belakang s.d. hari ini), tidak punya queue entry berstatus selain `BATAL`.

Response per item: `id`, `scheduleDate`, `storeType`, `customerName`, `plateNumber`, `truckType`, `plannedStart`, `plannedFinish`, `transporterName`, `driverName`, `containerNumbers`, `status`.

`PATCH /api/schedules/items/:id/close-no-show` (ADMIN) → `NO_SHOW_CLOSED`.
`PATCH /api/schedules/items/:id/reopen` (ADMIN) → `PLANNED`.

### 5.2 Queue

`POST /api/queue` — field tambahan: `scheduleItemId`, `truckType`, `transporterId`, `containerNumbers[]`.

`PATCH /api/queue/:id` — `registerTime` hanya diterima jika `req.user.role === "ADMIN"`; field lain mengikuti aturan yang ada.

`GET /api/queue/:id` — response menyertakan `scheduleItem` dan seluruh field `planned*`.

### 5.3 Transporter

`GET /api/transporters?search=&activeOnly=1`
`POST /api/transporters` `{ name }` — dipakai juga oleh "tambah inline" (S9)
`PATCH /api/transporters/:id` `{ name, isActive }`
`DELETE /api/transporters/:id` — tolak (409) jika masih dipakai; sarankan nonaktifkan.

### 5.4 Settings

`GET /api/settings` (semua role), `PUT /api/settings` (ADMIN).

### 5.5 Report

`GET /api/reports/schedule-vs-actual`

Query: `dateFrom`, `dateTo`, `basis` (`plan` | `actual`), `customerId`, `transporterId`, `truckType`, `status`, `search`, `page`, `limit`.

Response:

```json
{
  "basis": "plan",
  "rows": [
    {
      "scheduleItemId": "uuid",
      "queueEntryId": "uuid",
      "date": "2026-11-24",
      "customerPlan": "PT A",
      "customerActual": "PT A",
      "plateNumber": "B1234XYZ",
      "truckType": "FT20",
      "transporterPlan": "Logistik X",
      "transporterActual": "Logistik X",
      "plannedStart": "2026-11-24T09:00:00",
      "plannedFinish": "2026-11-24T11:30:00",
      "actualArrival": "2026-11-25T10:00:00",
      "actualFinish": "2026-11-25T12:10:00",
      "arrivalVarianceMinutes": 1500,
      "finishVarianceMinutes": 1480,
      "onTimeArrival": false,
      "onTimeFinish": false,
      "itemStatus": "LINKED",
      "autoCompleted": false
    }
  ],
  "summary": {
    "totalPlanned": 40,
    "linked": 36,
    "noShow": 2,
    "noShowClosed": 1,
    "unscheduled": 5,
    "onTimeArrivalPct": 77.8,
    "onTimeFinishPct": 69.4,
    "avgArrivalVarianceMinutes": 42,
    "avgFinishVarianceMinutes": 51
  },
  "meta": { "page": 1, "limit": 25, "totalItems": 41, "totalPages": 2 }
}
```

`GET /api/reports/schedule-vs-actual/export` — Excel dengan dua sheet: `Basis Plan` dan `Basis Aktual`, plus sheet `Ringkasan`.

---

## 6. Definisi Metrik

```
arrivalVarianceMinutes = round((registerTime  - plannedStart)  / 60000)
finishVarianceMinutes  = round((finishTime    - plannedFinish) / 60000)

onTimeArrival = registerTime <= plannedStart  + toleransiArrival
onTimeFinish  = finishTime   <= plannedFinish + toleransiFinish
```

- Nilai positif = terlambat, negatif = lebih awal.
- Datang lebih awal dihitung **on-time**.
- Variance bernilai `null` jika: tidak ada link, salah satu waktu kosong, atau `autoCompleted = true`.
- Walk-in tidak masuk penyebut `onTimeArrivalPct`, dihitung terpisah sebagai `unscheduled`.
- Toleransi dibaca saat query (retroaktif, S10), bukan disimpan per baris.

Dua tabel pada halaman report:

| Tabel | Dikelompokkan per | Isi |
|---|---|---|
| Basis Plan | `scheduleDate` | Semua item plan, termasuk `NO_SHOW` tanpa aktual |
| Basis Aktual | tanggal `registerTime` | Semua queue entry, termasuk walk-in tanpa plan |

Kolom variance muncul di kedua tabel.

---

## 7. Alur UI

### 7.1 Schedule Pengiriman

- Form item berubah dari `{truckType, truckTypeOther, qty}` menjadi `{truckType, truckTypeOther, plateNumber, transporter, driverName, containerNumbers[], plannedStart, plannedFinish}`.
- Tombol "Tambah Truk" per baris, bukan qty.
- Validasi inline: finish harus setelah start.
- Kolom tabel: Plat, Tipe, Transporter, Driver, Container, Estimasi Start, Estimasi Finish, Status.
- Badge status: `PLANNED` abu, `LINKED` hijau, `NO_SHOW` kuning, `NO_SHOW_CLOSED` merah.
- Print summary **tidak berubah tampilannya**; sumber angkanya jadi `count(*)`.
- Export Excel menambah kolom plat, transporter, driver, container, estimasi start/finish, status.

### 7.2 Form Antrian Truk

1. Field "No Truck" menjadi combobox searchable (plat nomor sebagai label, `scheduleItemId` sebagai nilai).
2. Di atasnya ada toggle `Terjadwal` / `Walk-in`. Walk-in menyembunyikan combobox dan membebaskan semua field.
3. Setelah item dipilih: `truckNumber`, `truckType`, `transporterId`, `customerId`, `driverName`, `containerNumbers` terisi otomatis.
4. Field hasil autofill tetap bisa diedit (override), kecuali plat yang terkunci (S8).
5. Panel ringkas menampilkan plan: "Rencana: 24/11 09:00 – 11:30 (telat 1 hari 1 jam)" dihitung live dari `registerTime` yang diisi.
6. Jika item yang dipilih baru saja dipakai operator lain, submit mengembalikan 409 dengan pesan: "Truk B1234XYZ sudah memiliki antrian aktif (No. Antrian #A-012)."

### 7.3 Halaman Report

- Filter: rentang tanggal, customer, transporter, tipe truk, status, pencarian plat.
- Tab: `Basis Plan` / `Basis Aktual`.
- Kartu ringkasan: total plan, linked, no-show, unscheduled, on-time arrival %, on-time finish %.
- Tabel dengan kolom variance berwarna (hijau on-time, merah terlambat).
- Tombol Export Excel.
- Baris `NO_SHOW` tampil dengan sel aktual kosong dan label jelas, bukan nol.

### 7.4 Settings

Halaman kecil (atau tab di master data) untuk 2 angka toleransi + 3 angka operasional di §3.2. Akses ADMIN.

---

## 8. Migrasi Data

Sebelum menjalankan migrasi di database berisi data nyata, jalankan
`node prisma/backup-before-integration.js` untuk menyalin kolom yang akan diubah
(`qty`, `truckType`, `containerNumber`, `transporter`) ke
`prisma/backups/pre-schedule-integration-<timestamp>.json`. Skrip ini hanya
membaca, tidak mengubah data.

Urutan eksekusi dalam satu migrasi Prisma:

1. `CREATE TYPE "ScheduleItemStatus"`.
2. `CREATE TABLE "Transporter"`, `CREATE TABLE "AppSetting"`.
3. `ALTER TABLE "ShipmentScheduleItem"` tambah kolom baru (semua nullable).
4. Pecah `qty > 1` menjadi N baris:

```sql
INSERT INTO "ShipmentScheduleItem"
  (id, "scheduleId", "truckType", "truckTypeOther", qty, "createdAt", "updatedAt", status, "containerNumbers")
SELECT gen_random_uuid()::text, s."scheduleId", s."truckType", s."truckTypeOther", 1,
       s."createdAt", now(), 'PLANNED', ARRAY[]::text[]
FROM "ShipmentScheduleItem" s, generate_series(1, s.qty - 1) g
WHERE s.qty > 1;

UPDATE "ShipmentScheduleItem" SET qty = 1 WHERE qty > 1;
```

5. Backfill transporter:

```sql
INSERT INTO "Transporter" (id, name, "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, trimmed.name, true, now(), now()
FROM (
  SELECT DISTINCT trim(transporter) AS name
  FROM "QueueEntry"
  WHERE transporter IS NOT NULL AND trim(transporter) <> ''
) trimmed
ON CONFLICT (name) DO NOTHING;

UPDATE "QueueEntry" q
SET "transporterId" = t.id
FROM "Transporter" t
WHERE q.transporter IS NOT NULL AND trim(q.transporter) = t.name;
```

6. Container lama → array, lalu drop kolom:

```sql
UPDATE "QueueEntry"
SET "containerNumbers" = ARRAY[trim("containerNumber")]
WHERE "containerNumber" IS NOT NULL AND trim("containerNumber") <> '';

ALTER TABLE "QueueEntry" DROP COLUMN "containerNumber";
```

7. `ALTER TABLE "ShipmentScheduleItem" DROP COLUMN qty`.
8. Buat partial unique index (§3.4).
9. Seed `AppSetting` default.
10. Backfill status item: `LINKED` untuk item yang punya queue entry non-`BATAL`, sisanya `PLANNED`.

Data lama tidak punya `plannedStart`/`plannedFinish`/`plateNumber`, jadi tampil sebagai "-" dan tidak masuk perhitungan variance sampai dilengkapi.

---

## 9. Rencana Uji

### 9.1 Schedule

1. Buat schedule 3 truk dengan plat, transporter, driver, 2 container, estimasi start/finish.
2. Estimasi finish lebih awal dari start → ditolak.
3. Shift 23:00 → 01:00 diterima, finish tersimpan H+1.
4. Plat `b 1234 xyz` tersimpan `B1234XYZ`.
5. Edit schedule yang itemnya sudah terhubung: ubah jam boleh, hapus item ditolak.
6. Hapus schedule yang punya antrian ditolak dengan pesan jelas.
7. Print summary tetap sama bentuknya, angka = jumlah baris.

### 9.2 Antrian

8. Pilih item dari dropdown → semua field terisi.
9. Override transporter dan customer → tersimpan sebagai aktual, snapshot plan tetap.
10. Plat tidak bisa diedit selama terhubung.
11. Dua operator submit item yang sama → yang kedua 409.
12. Batalkan antrian → item kembali muncul di dropdown, bisa dipakai lagi.
13. Antrian `SELESAI` tetap menempati slot.
14. Walk-in tanpa `truckType` diterima.
15. Walk-in dengan transporter baru via tambah inline → master bertambah dan terpilih.
16. Backdate 8 hari → ditolak; 7 hari → diterima.
17. Non-ADMIN mengubah `registerTime` pada antrian lama → ditolak; ADMIN → diterima.
18. Antrian backdate 6 hari tidak langsung `SELESAI` (uji job auto-complete).

### 9.3 No-show

19. Item plan kemarin tanpa antrian → job menandai `NO_SHOW`, masih muncul di dropdown.
20. Item `NO_SHOW` ditautkan pada H+1 → variance 1500 menit, tercatat benar.
21. ADMIN menutup `NO_SHOW` → hilang dari dropdown.
22. Item `NO_SHOW_CLOSED` dipaksa lewat API → ditolak.

### 9.4 Report

23. Truk plan 24/11 09:00, aktual 25/11 10:00 → variance +1500, on-time false.
24. Datang 15 menit lebih awal → on-time true, variance negatif.
25. Toleransi diubah ke 60 → report lama ikut berubah (retroaktif).
26. `autoCompleted` → variance finish `null`, bukan angka palsu.
27. Walk-in muncul di Basis Aktual, tidak masuk penyebut on-time.
28. Basis Plan vs Basis Aktual untuk data yang sama menghasilkan total berbeda dan keduanya benar.
29. Customer plan ≠ customer aktual → kedua kolom terisi.
30. Export Excel: 3 sheet, angka identik dengan layar.

---

## 10. Urutan Implementasi

| Fase | Isi | Status |
|---|---|---|
| 1 | Skema + migrasi + seed AppSetting | Selesai |
| 2 | Master Transporter + Settings API & UI | Selesai |
| 3 | Schedule API & UI (item per truk) | Selesai |
| 4 | Queue API & UI (dropdown, autofill, override, snapshot, partial index) | Selesai |
| 5 | Job no-show + auto-complete `createdAt` | Selesai |
| 6 | Report API, halaman, export | Selesai |

---

## 11. Sign-off

Semua pertanyaan pada draft awal sudah dijawab (lihat §2). Ringkasannya:

1. `containerNumbers String[]` dipakai di **kedua** sisi. Pencarian container memakai
   query array (`has`), tabel antrian, drawer, dan display ikut menampilkan gabungan.
2. On-time = tidak terlambat. Datang lebih awal tetap on-time.
3. Backdate 7 hari untuk semua role; ADMIN boleh melebihi dengan log audit.
4. Grace no-show 24 jam setelah `plannedFinish` (bisa diubah di Pengaturan).
5. Report dan export terbuka untuk ketiga role.

### 11.1 Catatan implementasi yang menyimpang dari draft

- Plat Nomor pada item schedule **dikunci** selama item terhubung ke antrian aktif,
  termasuk dari sisi schedule (bukan hanya dari form antrian).
- Perubahan waktu/transporter/driver pada item yang sudah terhubung tetap boleh,
  tetapi **tidak** mengubah snapshot plan pada antrian yang sudah ada.
- Antrian dengan `autoCompleted = true` dikecualikan dari statistik on-time, karena
  `finishTime`-nya diisi sistem, bukan kejadian nyata.
