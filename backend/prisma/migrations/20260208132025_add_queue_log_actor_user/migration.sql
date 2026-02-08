-- AlterTable
ALTER TABLE "QueueLog" ADD COLUMN     "actorUserId" TEXT;

-- CreateIndex
CREATE INDEX "QueueLog_actorUserId_idx" ON "QueueLog"("actorUserId");

-- AddForeignKey
ALTER TABLE "QueueLog" ADD CONSTRAINT "QueueLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
