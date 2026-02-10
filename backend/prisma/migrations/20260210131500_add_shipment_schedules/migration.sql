-- CreateEnum
CREATE TYPE "StoreType" AS ENUM ('STORE_IN', 'STORE_OUT');

-- CreateEnum
CREATE TYPE "TruckType" AS ENUM ('CDD', 'CDE', 'FUSO', 'WB', 'FT20', 'FT40', 'OTHER');

-- CreateTable
CREATE TABLE "ShipmentSchedule" (
    "id" TEXT NOT NULL,
    "scheduleDate" DATE NOT NULL,
    "storeType" "StoreType" NOT NULL,
    "customerId" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShipmentSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShipmentScheduleItem" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "truckType" "TruckType" NOT NULL,
    "truckTypeOther" TEXT,
    "qty" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShipmentScheduleItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ShipmentSchedule_scheduleDate_storeType_idx" ON "ShipmentSchedule"("scheduleDate", "storeType");

-- CreateIndex
CREATE INDEX "ShipmentSchedule_customerId_scheduleDate_idx" ON "ShipmentSchedule"("customerId", "scheduleDate");

-- CreateIndex
CREATE INDEX "ShipmentSchedule_createdByUserId_idx" ON "ShipmentSchedule"("createdByUserId");

-- CreateIndex
CREATE INDEX "ShipmentScheduleItem_scheduleId_idx" ON "ShipmentScheduleItem"("scheduleId");

-- CreateIndex
CREATE INDEX "ShipmentScheduleItem_truckType_idx" ON "ShipmentScheduleItem"("truckType");

-- AddForeignKey
ALTER TABLE "ShipmentSchedule" ADD CONSTRAINT "ShipmentSchedule_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentSchedule" ADD CONSTRAINT "ShipmentSchedule_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentScheduleItem" ADD CONSTRAINT "ShipmentScheduleItem_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "ShipmentSchedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
