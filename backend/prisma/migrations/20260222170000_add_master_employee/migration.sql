DO $$
BEGIN
  CREATE TYPE "EmployeePosition" AS ENUM ('FOREMAN', 'TALLYMAN', 'OPR_FORKLIFT');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "Employee" (
  "id" TEXT NOT NULL,
  "nik" VARCHAR(10) NOT NULL,
  "name" TEXT NOT NULL,
  "position" "EmployeePosition" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Employee_nik_key" ON "Employee"("nik");
CREATE INDEX IF NOT EXISTS "Employee_name_idx" ON "Employee"("name");
CREATE INDEX IF NOT EXISTS "Employee_position_idx" ON "Employee"("position");
