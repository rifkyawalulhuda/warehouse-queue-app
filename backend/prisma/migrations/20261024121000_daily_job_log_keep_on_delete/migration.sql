-- DropForeignKey
ALTER TABLE "DailyJobActivityLog" DROP CONSTRAINT "DailyJobActivityLog_dailyJobActivityId_fkey";

-- AlterTable
ALTER TABLE "DailyJobActivityLog" ALTER COLUMN "dailyJobActivityId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "DailyJobActivityLog" ADD CONSTRAINT "DailyJobActivityLog_dailyJobActivityId_fkey" FOREIGN KEY ("dailyJobActivityId") REFERENCES "DailyJobActivity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
