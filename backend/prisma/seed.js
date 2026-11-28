const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

// Default AppSetting. Kunci yang sudah ada tidak ditimpa, supaya nilai yang
// diubah lewat halaman Settings tidak hilang saat seed dijalankan ulang.
const DEFAULT_SETTINGS = {
  "report.onTimeToleranceArrivalMinutes": "15",
  "report.onTimeToleranceFinishMinutes": "15",
  "schedule.backdateMaxDays": "7",
  "schedule.overdueWindowDays": "7",
  "schedule.noShowGraceHours": "24",
};

async function seedAdminUser() {
  const username = "admin";
  const existing = await prisma.adminUser.findUnique({ where: { username } });
  if (existing) {
    console.log("Seed: admin user already exists");
    return;
  }

  const passwordHash = await bcrypt.hash("admin123", 10);
  await prisma.adminUser.create({
    data: {
      name: "Admin",
      position: "Administrator",
      phone: "0000000000",
      role: "ADMIN",
      username,
      passwordHash,
    },
  });
  console.log("Seed: admin user created (username: admin)");
}

async function seedAppSettings() {
  let created = 0;
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    const existing = await prisma.appSetting.findUnique({ where: { key } });
    if (existing) continue;
    await prisma.appSetting.create({ data: { key, value } });
    created += 1;
  }
  console.log(
    created > 0
      ? `Seed: ${created} AppSetting dibuat`
      : "Seed: AppSetting sudah lengkap"
  );
}

async function main() {
  await seedAdminUser();
  await seedAppSettings();
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
