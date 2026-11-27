-- ============================================================================
-- Phase 1: Integrasi Schedule Pengiriman <-> Antrian Truk
-- Desain lengkap: docs/design/schedule-queue-integration.md
--
-- Ringkasan:
--   1. ShipmentScheduleItem menjadi 1 baris = 1 truk (qty dipecah jadi N baris).
--   2. Tambah plat, transporter (master), driver, container[], plannedStart/Finish.
--   3. Tambah status siklus item (PLANNED/LINKED/NO_SHOW/NO_SHOW_CLOSED).
--   4. QueueEntry dapat link ke item schedule + snapshot nilai plan.
--   5. containerNumber (tunggal) -> containerNumbers (array).
--   6. Master Transporter di-backfill dari teks transporter lama.
--   7. AppSetting untuk toleransi on-time dan parameter operasional.
--
-- CATATAN PENTING
-- Index "queue_entry_active_schedule_item_unique" adalah PARTIAL UNIQUE INDEX
-- (WHERE status <> 'BATAL') yang tidak dapat diekspresikan di schema.prisma.
-- Index ini SENGAJA tidak ada di schema.prisma. Jangan dihapus, dan jangan
-- biarkan `prisma migrate dev` menghasilkannya ulang sebagai index biasa.
-- ============================================================================

-- CreateEnum
CREATE TYPE "ScheduleItemStatus" AS ENUM ('PLANNED', 'LINKED', 'NO_SHOW', 'NO_SHOW_CLOSED');

-- ---------------------------------------------------------------------------
-- Tabel baru
-- ---------------------------------------------------------------------------
CREATE TABLE "Transporter" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transporter_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AppSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedByUserId" TEXT,

    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("key")
);

CREATE UNIQUE INDEX "Transporter_name_key" ON "Transporter"("name");
CREATE INDEX "AppSetting_updatedByUserId_idx" ON "AppSetting"("updatedByUserId");

ALTER TABLE "AppSetting" ADD CONSTRAINT "AppSetting_updatedByUserId_fkey"
  FOREIGN KEY ("updatedByUserId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- ShipmentScheduleItem: 1 baris = 1 truk
-- ---------------------------------------------------------------------------
ALTER TABLE "ShipmentScheduleItem"
  ADD COLUMN "plateNumber" TEXT,
  ADD COLUMN "transporterId" TEXT,
  ADD COLUMN "driverName" TEXT,
  ADD COLUMN "containerNumbers" TEXT[],
  ADD COLUMN "plannedStart" TIMESTAMP(3),
  ADD COLUMN "plannedFinish" TIMESTAMP(3),
  ADD COLUMN "status" "ScheduleItemStatus" NOT NULL DEFAULT 'PLANNED',
  ADD COLUMN "noShowMarkedAt" TIMESTAMP(3),
  ADD COLUMN "noShowClosedAt" TIMESTAMP(3),
  ADD COLUMN "noShowClosedByUserId" TEXT,
  ADD COLUMN "updatedAt" TIMESTAMP(3);

-- Pecah qty > 1 menjadi N baris. Baris asli dipertahankan sebagai baris ke-1.
-- Data lama tidak punya plat/waktu, jadi kolom baru dibiarkan NULL.
INSERT INTO "ShipmentScheduleItem"
  ("id", "scheduleId", "truckType", "truckTypeOther", "qty", "createdAt", "updatedAt", "status", "containerNumbers")
SELECT gen_random_uuid()::text, s."scheduleId", s."truckType", s."truckTypeOther", 1, s."createdAt", now(), 'PLANNED', ARRAY[]::TEXT[]
FROM "ShipmentScheduleItem" s
CROSS JOIN generate_series(1, s.qty - 1) AS g
WHERE s.qty > 1;

UPDATE "ShipmentScheduleItem" SET "qty" = 1 WHERE "qty" > 1;
UPDATE "ShipmentScheduleItem" SET "containerNumbers" = ARRAY[]::TEXT[] WHERE "containerNumbers" IS NULL;
UPDATE "ShipmentScheduleItem" SET "updatedAt" = "createdAt" WHERE "updatedAt" IS NULL;

ALTER TABLE "ShipmentScheduleItem"
  ALTER COLUMN "containerNumbers" SET NOT NULL,
  ALTER COLUMN "containerNumbers" SET DEFAULT ARRAY[]::TEXT[],
  ALTER COLUMN "updatedAt" SET NOT NULL,
  DROP COLUMN "qty";

CREATE INDEX "ShipmentScheduleItem_plateNumber_idx" ON "ShipmentScheduleItem"("plateNumber");
CREATE INDEX "ShipmentScheduleItem_plannedStart_idx" ON "ShipmentScheduleItem"("plannedStart");
CREATE INDEX "ShipmentScheduleItem_status_plannedFinish_idx" ON "ShipmentScheduleItem"("status", "plannedFinish");
CREATE INDEX "ShipmentScheduleItem_transporterId_idx" ON "ShipmentScheduleItem"("transporterId");
CREATE INDEX "ShipmentScheduleItem_noShowClosedByUserId_idx" ON "ShipmentScheduleItem"("noShowClosedByUserId");

ALTER TABLE "ShipmentScheduleItem" ADD CONSTRAINT "ShipmentScheduleItem_transporterId_fkey"
  FOREIGN KEY ("transporterId") REFERENCES "Transporter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ShipmentScheduleItem" ADD CONSTRAINT "ShipmentScheduleItem_noShowClosedByUserId_fkey"
  FOREIGN KEY ("noShowClosedByUserId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- QueueEntry: link ke schedule item + snapshot plan
-- ---------------------------------------------------------------------------
ALTER TABLE "QueueEntry"
  ADD COLUMN "truckType" "TruckType",
  ADD COLUMN "transporterId" TEXT,
  ADD COLUMN "containerNumbers" TEXT[],
  ADD COLUMN "scheduleItemId" TEXT,
  ADD COLUMN "plannedStart" TIMESTAMP(3),
  ADD COLUMN "plannedFinish" TIMESTAMP(3),
  ADD COLUMN "plannedPlateNumber" TEXT,
  ADD COLUMN "plannedTruckType" "TruckType",
  ADD COLUMN "plannedCustomerId" TEXT,
  ADD COLUMN "plannedCustomerName" TEXT,
  ADD COLUMN "plannedTransporterName" TEXT,
  ADD COLUMN "plannedDriverName" TEXT,
  ADD COLUMN "plannedContainerNumbers" TEXT[],
  ADD COLUMN "autoCompleted" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "autoCompletedAt" TIMESTAMP(3);

-- containerNumber (tunggal) -> containerNumbers (array)
UPDATE "QueueEntry"
SET "containerNumbers" = ARRAY[trim("containerNumber")]
WHERE "containerNumber" IS NOT NULL AND trim("containerNumber") <> '';

UPDATE "QueueEntry" SET "containerNumbers" = ARRAY[]::TEXT[] WHERE "containerNumbers" IS NULL;

ALTER TABLE "QueueEntry"
  ALTER COLUMN "containerNumbers" SET NOT NULL,
  ALTER COLUMN "containerNumbers" SET DEFAULT ARRAY[]::TEXT[],
  DROP COLUMN "containerNumber";

CREATE INDEX "QueueEntry_truckType_idx" ON "QueueEntry"("truckType");
CREATE INDEX "QueueEntry_transporterId_idx" ON "QueueEntry"("transporterId");
CREATE INDEX "QueueEntry_scheduleItemId_idx" ON "QueueEntry"("scheduleItemId");

-- Partial unique: satu item schedule hanya boleh punya satu antrian non-BATAL.
-- BATAL membebaskan slot; SELESAI tetap menempatinya (keputusan S4).
CREATE UNIQUE INDEX "queue_entry_active_schedule_item_unique"
  ON "QueueEntry" ("scheduleItemId")
  WHERE "scheduleItemId" IS NOT NULL AND "status" <> 'BATAL';

ALTER TABLE "QueueEntry" ADD CONSTRAINT "QueueEntry_transporterId_fkey"
  FOREIGN KEY ("transporterId") REFERENCES "Transporter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "QueueEntry" ADD CONSTRAINT "QueueEntry_scheduleItemId_fkey"
  FOREIGN KEY ("scheduleItemId") REFERENCES "ShipmentScheduleItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Backfill master Transporter dari teks bebas lama
-- Normalisasi: trim + rapatkan spasi; duplikat case-insensitive digabung,
-- memilih ejaan terpendek sebagai nama kanonik.
-- ---------------------------------------------------------------------------
INSERT INTO "Transporter" ("id", "name", "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, src.name, true, now(), now()
FROM (
  SELECT DISTINCT ON (lower(trim(regexp_replace("transporter", '\s+', ' ', 'g'))))
         trim(regexp_replace("transporter", '\s+', ' ', 'g')) AS name
  FROM "QueueEntry"
  WHERE "transporter" IS NOT NULL AND trim("transporter") <> ''
  ORDER BY lower(trim(regexp_replace("transporter", '\s+', ' ', 'g'))), length("transporter")
) src
ON CONFLICT ("name") DO NOTHING;

UPDATE "QueueEntry" q
SET "transporterId" = t."id"
FROM "Transporter" t
WHERE q."transporter" IS NOT NULL
  AND lower(trim(regexp_replace(q."transporter", '\s+', ' ', 'g'))) = lower(t."name");

-- Backfill status item. No-op untuk data lama (belum ada yang terhubung),
-- tetapi menjaga konsistensi bila migrasi dijalankan ulang pada data uji.
UPDATE "ShipmentScheduleItem" i
SET "status" = 'LINKED'
WHERE EXISTS (
  SELECT 1 FROM "QueueEntry" q
  WHERE q."scheduleItemId" = i."id" AND q."status" <> 'BATAL'
);

-- ---------------------------------------------------------------------------
-- AppSetting default
-- ---------------------------------------------------------------------------
INSERT INTO "AppSetting" ("key", "value", "updatedAt") VALUES
  ('report.onTimeToleranceArrivalMinutes', '15', now()),
  ('report.onTimeToleranceFinishMinutes', '15', now()),
  ('schedule.backdateMaxDays', '7', now()),
  ('schedule.overdueWindowDays', '7', now()),
  ('schedule.noShowGraceHours', '24', now())
ON CONFLICT ("key") DO NOTHING;
