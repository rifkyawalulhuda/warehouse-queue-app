ALTER TABLE "PickingProgress"
  ADD COLUMN IF NOT EXISTS "pickerEmployeeId" TEXT;

DO $$
BEGIN
  ALTER TABLE "PickingProgress"
    ADD CONSTRAINT "PickingProgress_pickerEmployeeId_fkey"
    FOREIGN KEY ("pickerEmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "PickingProgress_pickerEmployeeId_idx" ON "PickingProgress"("pickerEmployeeId");
