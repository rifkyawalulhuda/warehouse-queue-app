-- CreateTable
CREATE TABLE "DailyJobActivity" (
    "id" TEXT NOT NULL,
    "activityDate" DATE NOT NULL,
    "recCddCde" TEXT,
    "recWingbox" TEXT,
    "recContainer" TEXT,
    "delCddCde" TEXT,
    "delWingboxOther" TEXT,
    "delContainer" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "finalizedAt" TIMESTAMP(3),
    "finalizedById" TEXT,
    "summarySource" TEXT,
    "summarySyncedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyJobActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyJobManpowerItem" (
    "id" TEXT NOT NULL,
    "dailyJobActivityId" TEXT NOT NULL,
    "groupIndex" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "employeeId" TEXT,
    "employeeName" TEXT NOT NULL,
    "jobRole" TEXT NOT NULL,
    "activityType" TEXT NOT NULL,
    "qtyCdd" INTEGER,
    "qtyWb" INTEGER,
    "qtyFuso" INTEGER,
    "qty20ft" INTEGER,
    "qty40ft" INTEGER,
    "timeStart" TEXT,
    "timeFinish" TEXT,
    "isPending" BOOLEAN NOT NULL DEFAULT false,
    "isFinish" BOOLEAN NOT NULL DEFAULT false,
    "confirmation" TEXT,

    CONSTRAINT "DailyJobManpowerItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyJobPickingItem" (
    "id" TEXT NOT NULL,
    "dailyJobActivityId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "totalPicking" TEXT,
    "totalMember" INTEGER,
    "timeWork" TEXT,
    "isPending" BOOLEAN NOT NULL DEFAULT false,
    "isFinish" BOOLEAN NOT NULL DEFAULT false,
    "confirmation" TEXT,

    CONSTRAINT "DailyJobPickingItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyJobStuffingItem" (
    "id" TEXT NOT NULL,
    "dailyJobActivityId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "totalStuffing" TEXT,
    "totalMember" INTEGER,
    "timeWork" TEXT,
    "isPending" BOOLEAN NOT NULL DEFAULT false,
    "isFinish" BOOLEAN NOT NULL DEFAULT false,
    "confirmation" TEXT,

    CONSTRAINT "DailyJobStuffingItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyJobActivityLog" (
    "id" TEXT NOT NULL,
    "dailyJobActivityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "note" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyJobActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DailyJobActivity_status_idx" ON "DailyJobActivity"("status");

-- CreateIndex
CREATE UNIQUE INDEX "DailyJobActivity_activityDate_key" ON "DailyJobActivity"("activityDate");

-- CreateIndex
CREATE INDEX "DailyJobManpowerItem_dailyJobActivityId_groupIndex_sortOrde_idx" ON "DailyJobManpowerItem"("dailyJobActivityId", "groupIndex", "sortOrder");

-- CreateIndex
CREATE INDEX "DailyJobManpowerItem_employeeId_idx" ON "DailyJobManpowerItem"("employeeId");

-- CreateIndex
CREATE INDEX "DailyJobPickingItem_dailyJobActivityId_sortOrder_idx" ON "DailyJobPickingItem"("dailyJobActivityId", "sortOrder");

-- CreateIndex
CREATE INDEX "DailyJobStuffingItem_dailyJobActivityId_sortOrder_idx" ON "DailyJobStuffingItem"("dailyJobActivityId", "sortOrder");

-- CreateIndex
CREATE INDEX "DailyJobActivityLog_dailyJobActivityId_createdAt_idx" ON "DailyJobActivityLog"("dailyJobActivityId", "createdAt");

-- CreateIndex
CREATE INDEX "DailyJobActivityLog_userId_idx" ON "DailyJobActivityLog"("userId");

-- AddForeignKey
ALTER TABLE "DailyJobActivity" ADD CONSTRAINT "DailyJobActivity_finalizedById_fkey" FOREIGN KEY ("finalizedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyJobActivity" ADD CONSTRAINT "DailyJobActivity_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyJobActivity" ADD CONSTRAINT "DailyJobActivity_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyJobManpowerItem" ADD CONSTRAINT "DailyJobManpowerItem_dailyJobActivityId_fkey" FOREIGN KEY ("dailyJobActivityId") REFERENCES "DailyJobActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyJobManpowerItem" ADD CONSTRAINT "DailyJobManpowerItem_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyJobPickingItem" ADD CONSTRAINT "DailyJobPickingItem_dailyJobActivityId_fkey" FOREIGN KEY ("dailyJobActivityId") REFERENCES "DailyJobActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyJobStuffingItem" ADD CONSTRAINT "DailyJobStuffingItem_dailyJobActivityId_fkey" FOREIGN KEY ("dailyJobActivityId") REFERENCES "DailyJobActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyJobActivityLog" ADD CONSTRAINT "DailyJobActivityLog_dailyJobActivityId_fkey" FOREIGN KEY ("dailyJobActivityId") REFERENCES "DailyJobActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyJobActivityLog" ADD CONSTRAINT "DailyJobActivityLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
