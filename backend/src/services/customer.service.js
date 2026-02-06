const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

function createHttpError(status, message, details) {
  const err = new Error(message);
  err.status = status;
  if (details) err.details = details;
  return err;
}

async function listCustomers() {
  return prisma.customer.findMany({
    orderBy: { name: "asc" },
  });
}

async function createCustomer(data) {
  if (!data.name || typeof data.name !== "string" || !data.name.trim()) {
    throw createHttpError(400, "Nama Customer wajib diisi");
  }
  return prisma.customer.create({
    data: {
      name: data.name.trim(),
    },
  });
}

module.exports = {
  listCustomers,
  createCustomer,
};
