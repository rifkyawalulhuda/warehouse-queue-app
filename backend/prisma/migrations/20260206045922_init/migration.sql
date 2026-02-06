-- CreateEnum
CREATE TYPE "QueueStatus" AS ENUM ('MENUNGGU', 'IN_WH', 'PROSES', 'SELESAI', 'BATAL');

-- CreateEnum
CREATE TYPE "QueueCategory" AS ENUM ('RECEIVING', 'DELIVERY');

-- CreateTable
CREATE TABLE "QueueEntry" (
    "id" TEXT NOT NULL,
    "category" "QueueCategory" NOT NULL,
    "customerName" TEXT NOT NULL,
    "driverName" TEXT NOT NULL,
    "truckNumber" TEXT NOT NULL,
    "containerNumber" TEXT,
    "registerTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "inWhTime" TIMESTAMP(3),
    "startTime" TIMESTAMP(3),
    "finishTime" TIMESTAMP(3),
    "status" "QueueStatus" NOT NULL DEFAULT 'MENUNGGU',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QueueEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QueueLog" (
    "id" TEXT NOT NULL,
    "queueEntryId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "oldStatus" "QueueStatus",
    "newStatus" "QueueStatus",
    "userName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QueueLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QueueEntry_status_registerTime_idx" ON "QueueEntry"("status", "registerTime");

-- CreateIndex
CREATE INDEX "QueueEntry_truckNumber_registerTime_idx" ON "QueueEntry"("truckNumber", "registerTime");

-- CreateIndex
CREATE INDEX "QueueEntry_category_registerTime_idx" ON "QueueEntry"("category", "registerTime");

-- CreateIndex
CREATE INDEX "QueueLog_queueEntryId_createdAt_idx" ON "QueueLog"("queueEntryId", "createdAt");

-- AddForeignKey
ALTER TABLE "QueueLog" ADD CONSTRAINT "QueueLog_queueEntryId_fkey" FOREIGN KEY ("queueEntryId") REFERENCES "QueueEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
