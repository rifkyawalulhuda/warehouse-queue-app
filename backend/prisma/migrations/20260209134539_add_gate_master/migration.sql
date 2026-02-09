-- CreateEnum
CREATE TYPE "WarehouseGate" AS ENUM ('WH1', 'WH2', 'DG');

-- CreateTable
CREATE TABLE "gates" (
    "id" TEXT NOT NULL,
    "gateNo" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "warehouse" "WarehouseGate" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "gates_gateNo_warehouse_key" ON "gates"("gateNo", "warehouse");
