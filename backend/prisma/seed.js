const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
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
  console.log("Seed: admin user created (username: admin, password: admin123)");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
