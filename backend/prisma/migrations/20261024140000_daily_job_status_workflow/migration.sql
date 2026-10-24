-- Rename kolom finalisasi menjadi "selesai" tanpa kehilangan data
ALTER TABLE "DailyJobActivity" DROP CONSTRAINT "DailyJobActivity_finalizedById_fkey";

ALTER TABLE "DailyJobActivity" RENAME COLUMN "finalizedAt" TO "finishedAt";
ALTER TABLE "DailyJobActivity" RENAME COLUMN "finalizedById" TO "finishedById";

-- Kolom baru untuk alur DRAFT -> PROSES -> SELESAI
ALTER TABLE "DailyJobActivity" ADD COLUMN "startedAt" TIMESTAMP(3);
ALTER TABLE "DailyJobActivity" ADD COLUMN "startedById" TEXT;
ALTER TABLE "DailyJobActivity" ADD COLUMN "cancelledAt" TIMESTAMP(3);
ALTER TABLE "DailyJobActivity" ADD COLUMN "cancelledById" TEXT;
ALTER TABLE "DailyJobActivity" ADD COLUMN "cancelReason" TEXT;

-- Normalisasi kosakata status: FINAL menjadi SELESAI
UPDATE "DailyJobActivity" SET "status" = 'SELESAI' WHERE "status" = 'FINAL';

ALTER TABLE "DailyJobActivity" ADD CONSTRAINT "DailyJobActivity_startedById_fkey" FOREIGN KEY ("startedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DailyJobActivity" ADD CONSTRAINT "DailyJobActivity_finishedById_fkey" FOREIGN KEY ("finishedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DailyJobActivity" ADD CONSTRAINT "DailyJobActivity_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
