/*
  Warnings:

  - You are about to alter the column `volumeCbm` on the `PickingProgress` table. The data in that column could be lost. The data in that column will be cast from `Decimal` to `Decimal(65,30)`.
  - You are about to alter the column `slaPerBarcodeMinutes` on the `PickingProgress` table. The data in that column could be lost. The data in that column will be cast from `Decimal` to `Decimal(65,30)`.

*/
-- AlterTable
ALTER TABLE "PickingProgress" ALTER COLUMN "volumeCbm" SET DATA TYPE DECIMAL(65,30),
ALTER COLUMN "slaPerBarcodeMinutes" SET DATA TYPE DECIMAL(65,30);
