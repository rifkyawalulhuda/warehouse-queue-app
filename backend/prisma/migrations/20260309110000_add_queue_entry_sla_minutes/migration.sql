ALTER TABLE "QueueEntry"
ADD COLUMN "slaWaitingMinutes" INTEGER,
ADD COLUMN "slaInWhProcessMinutes" INTEGER;

UPDATE "QueueEntry"
SET
  "slaWaitingMinutes" = 30,
  "slaInWhProcessMinutes" = CASE
    WHEN "category" = 'RECEIVING' THEN 120
    ELSE 90
  END
WHERE "slaWaitingMinutes" IS NULL
   OR "slaInWhProcessMinutes" IS NULL;

ALTER TABLE "QueueEntry"
ALTER COLUMN "slaWaitingMinutes" SET NOT NULL,
ALTER COLUMN "slaInWhProcessMinutes" SET NOT NULL;
