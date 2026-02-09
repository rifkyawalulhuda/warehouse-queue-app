-- AlterTable
ALTER TABLE "QueueEntry" ADD COLUMN     "gateId" TEXT;

-- CreateIndex
CREATE INDEX "QueueEntry_gateId_idx" ON "QueueEntry"("gateId");

-- AddForeignKey
ALTER TABLE "QueueEntry" ADD CONSTRAINT "QueueEntry_gateId_fkey" FOREIGN KEY ("gateId") REFERENCES "gates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
