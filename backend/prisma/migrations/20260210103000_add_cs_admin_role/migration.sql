DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'AdminRole'
      AND e.enumlabel = 'CS'
  ) THEN
    ALTER TYPE "AdminRole" ADD VALUE 'CS';
  END IF;
END $$;
