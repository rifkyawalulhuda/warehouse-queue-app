-- Backfill canonical columns from legacy columns before dropping them.
UPDATE "PickingProgress"
SET
  "doNumber" = COALESCE("doNumber", "noContainer"),
  "destination" = COALESCE("destination", "noDock");

-- Canonical columns must be the only source of truth.
ALTER TABLE "PickingProgress"
ALTER COLUMN "doNumber" SET NOT NULL,
ALTER COLUMN "destination" SET NOT NULL;

-- Remove duplicated legacy columns.
ALTER TABLE "PickingProgress"
DROP COLUMN "noContainer",
DROP COLUMN "noDock";
