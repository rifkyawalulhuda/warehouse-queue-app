// Backup kolom yang akan diubah oleh migrasi 20261127120000_schedule_queue_integration.
// Jalankan SEBELUM migrate deploy. Hasil: prisma/backups/pre-schedule-integration-<ts>.json
const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

(async () => {
  const scheduleItems = await prisma.$queryRawUnsafe(
    'SELECT "id", "scheduleId", "truckType", "truckTypeOther", "qty", "createdAt" FROM "ShipmentScheduleItem" ORDER BY "createdAt"'
  );
  const queueContainers = await prisma.$queryRawUnsafe(
    'SELECT "id", "containerNumber", "transporter" FROM "QueueEntry" WHERE ("containerNumber" IS NOT NULL AND trim("containerNumber") <> \'\') OR ("transporter" IS NOT NULL AND trim("transporter") <> \'\')'
  );

  const dir = path.join(__dirname, "backups");
  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const file = path.join(dir, `pre-schedule-integration-${stamp}.json`);
  fs.writeFileSync(
    file,
    JSON.stringify({ scheduleItems, queueContainers }, null, 2),
    "utf8"
  );

  console.log(
    `Backup ditulis: ${file} (${scheduleItems.length} schedule item, ${queueContainers.length} queue entry)`
  );
  await prisma.$disconnect();
})().catch((e) => {
  console.error("ERR", e.message);
  process.exit(1);
});
