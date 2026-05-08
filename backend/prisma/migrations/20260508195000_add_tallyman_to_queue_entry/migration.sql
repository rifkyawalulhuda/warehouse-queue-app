ALTER TABLE "QueueEntry"
  ADD COLUMN IF NOT EXISTS "pickerEmployeeId" TEXT;

DO $$
BEGIN
  ALTER TABLE "QueueEntry"
    ADD CONSTRAINT "QueueEntry_pickerEmployeeId_fkey"
    FOREIGN KEY ("pickerEmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "QueueEntry_pickerEmployeeId_idx" ON "QueueEntry"("pickerEmployeeId");
