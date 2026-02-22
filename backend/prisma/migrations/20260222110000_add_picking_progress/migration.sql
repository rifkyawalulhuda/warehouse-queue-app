-- CreateEnum
CREATE TYPE "PickingStatus" AS ENUM ('MENUNGGU', 'ON_PROCESS', 'SELESAI', 'BATAL');

-- CreateTable
CREATE TABLE "PickingProgress" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "customerId" TEXT NOT NULL,
    "doNumber" TEXT,
    "destination" TEXT,
    "volumeCbm" DECIMAL,
    "plTimeRelease" TIMESTAMP(3),
    "noContainer" TEXT NOT NULL,
    "noDock" TEXT NOT NULL,
    "pickingQty" INTEGER NOT NULL,
    "pickedQty" INTEGER NOT NULL DEFAULT 0,
    "slaPerBarcodeMinutes" DECIMAL NOT NULL DEFAULT 2.5,
    "startTime" TIMESTAMP(3),
    "finishTime" TIMESTAMP(3),
    "status" "PickingStatus" NOT NULL DEFAULT 'MENUNGGU',
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PickingProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PickingProgressLog" (
    "id" TEXT NOT NULL,
    "pickingId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "note" TEXT,
    "fromStatus" "PickingStatus",
    "toStatus" "PickingStatus",
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PickingProgressLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PickingProgress_date_idx" ON "PickingProgress"("date");

-- CreateIndex
CREATE INDEX "PickingProgress_status_idx" ON "PickingProgress"("status");

-- CreateIndex
CREATE INDEX "PickingProgress_customerId_idx" ON "PickingProgress"("customerId");

-- CreateIndex
CREATE INDEX "PickingProgressLog_pickingId_idx" ON "PickingProgressLog"("pickingId");

-- CreateIndex
CREATE INDEX "PickingProgressLog_createdAt_idx" ON "PickingProgressLog"("createdAt");

-- AddForeignKey
ALTER TABLE "PickingProgress" ADD CONSTRAINT "PickingProgress_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PickingProgress" ADD CONSTRAINT "PickingProgress_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PickingProgress" ADD CONSTRAINT "PickingProgress_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PickingProgressLog" ADD CONSTRAINT "PickingProgressLog_pickingId_fkey" FOREIGN KEY ("pickingId") REFERENCES "PickingProgress"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PickingProgressLog" ADD CONSTRAINT "PickingProgressLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
