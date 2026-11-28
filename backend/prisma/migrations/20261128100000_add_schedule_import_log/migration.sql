-- Ringkasan satu kali import Schedule dari Excel.
-- Dibuat manual (bukan `migrate dev`) karena riwayat migrasi proyek ini
-- sudah drift: beberapa migrasi lama diedit setelah diterapkan, sehingga
-- `migrate dev` ingin mereset seluruh schema.

CREATE TABLE "ScheduleImportLog" (
    "id" TEXT NOT NULL,
    "fileName" TEXT,
    "rowCount" INTEGER NOT NULL,
    "createdCount" INTEGER NOT NULL,
    "skippedCount" INTEGER NOT NULL,
    "scheduleCount" INTEGER NOT NULL,
    "note" TEXT,
    "actorUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScheduleImportLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ScheduleImportLog_createdAt_idx" ON "ScheduleImportLog"("createdAt");
CREATE INDEX "ScheduleImportLog_actorUserId_idx" ON "ScheduleImportLog"("actorUserId");

ALTER TABLE "ScheduleImportLog"
    ADD CONSTRAINT "ScheduleImportLog_actorUserId_fkey"
    FOREIGN KEY ("actorUserId") REFERENCES "AdminUser"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
