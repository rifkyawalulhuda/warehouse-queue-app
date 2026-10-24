-- Bersihkan data demo lama sebelum struktur diubah
DELETE FROM "DailyJobActivityLog";
DELETE FROM "DailyJobActivity";

-- DropForeignKey
ALTER TABLE "DailyJobActivity" DROP CONSTRAINT "DailyJobActivity_cancelledById_fkey";

-- DropForeignKey
ALTER TABLE "DailyJobActivity" DROP CONSTRAINT "DailyJobActivity_finishedById_fkey";

-- DropForeignKey
ALTER TABLE "DailyJobActivity" DROP CONSTRAINT "DailyJobActivity_startedById_fkey";

-- DropForeignKey
ALTER TABLE "DailyJobManpowerItem" DROP CONSTRAINT "DailyJobManpowerItem_dailyJobActivityId_fkey";

-- DropForeignKey
ALTER TABLE "DailyJobManpowerItem" DROP CONSTRAINT "DailyJobManpowerItem_employeeId_fkey";

-- DropForeignKey
ALTER TABLE "DailyJobPickingItem" DROP CONSTRAINT "DailyJobPickingItem_dailyJobActivityId_fkey";

-- DropForeignKey
ALTER TABLE "DailyJobStuffingItem" DROP CONSTRAINT "DailyJobStuffingItem_dailyJobActivityId_fkey";

-- DropIndex
DROP INDEX "DailyJobActivity_status_idx";

-- AlterTable
ALTER TABLE "DailyJobActivity" DROP COLUMN "cancelReason",
DROP COLUMN "cancelledAt",
DROP COLUMN "cancelledById",
DROP COLUMN "delCddCde",
DROP COLUMN "delContainer",
DROP COLUMN "delWingboxOther",
DROP COLUMN "finishedAt",
DROP COLUMN "finishedById",
DROP COLUMN "recCddCde",
DROP COLUMN "recContainer",
DROP COLUMN "recWingbox",
DROP COLUMN "startedAt",
DROP COLUMN "startedById",
DROP COLUMN "status",
DROP COLUMN "summarySource",
DROP COLUMN "summarySyncedAt",
ADD COLUMN     "notes" TEXT;

-- DropTable
DROP TABLE "DailyJobManpowerItem";

-- DropTable
DROP TABLE "DailyJobPickingItem";

-- DropTable
DROP TABLE "DailyJobStuffingItem";

-- CreateTable
CREATE TABLE "JobTransaction" (
    "id" TEXT NOT NULL,
    "dailyJobActivityId" TEXT NOT NULL,
    "transactionDate" DATE NOT NULL,
    "activityType" TEXT NOT NULL,
    "jobRole" TEXT,
    "employeeId" TEXT,
    "employeeName" TEXT NOT NULL,
    "truckType" TEXT,
    "truckTypeOther" TEXT,
    "qty" INTEGER NOT NULL DEFAULT 1,
    "totalDo" INTEGER,
    "totalMember" INTEGER,
    "startAt" TIMESTAMP(3),
    "finishAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "confirmation" TEXT,
    "cancelReason" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobTransactionLog" (
    "id" TEXT NOT NULL,
    "jobTransactionId" TEXT,
    "action" TEXT NOT NULL,
    "note" TEXT,
    "fromStatus" TEXT,
    "toStatus" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobTransactionLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JobTransaction_dailyJobActivityId_startAt_idx" ON "JobTransaction"("dailyJobActivityId", "startAt");

-- CreateIndex
CREATE INDEX "JobTransaction_transactionDate_status_idx" ON "JobTransaction"("transactionDate", "status");

-- CreateIndex
CREATE INDEX "JobTransaction_transactionDate_activityType_idx" ON "JobTransaction"("transactionDate", "activityType");

-- CreateIndex
CREATE INDEX "JobTransaction_employeeId_idx" ON "JobTransaction"("employeeId");

-- CreateIndex
CREATE INDEX "JobTransactionLog_jobTransactionId_createdAt_idx" ON "JobTransactionLog"("jobTransactionId", "createdAt");

-- CreateIndex
CREATE INDEX "JobTransactionLog_userId_idx" ON "JobTransactionLog"("userId");

-- AddForeignKey
ALTER TABLE "JobTransaction" ADD CONSTRAINT "JobTransaction_dailyJobActivityId_fkey" FOREIGN KEY ("dailyJobActivityId") REFERENCES "DailyJobActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobTransaction" ADD CONSTRAINT "JobTransaction_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobTransaction" ADD CONSTRAINT "JobTransaction_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobTransaction" ADD CONSTRAINT "JobTransaction_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobTransactionLog" ADD CONSTRAINT "JobTransactionLog_jobTransactionId_fkey" FOREIGN KEY ("jobTransactionId") REFERENCES "JobTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobTransactionLog" ADD CONSTRAINT "JobTransactionLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
