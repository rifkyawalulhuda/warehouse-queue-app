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

async function deleteCustomer(id) {
  if (!id) throw createHttpError(400, "ID customer tidak valid");
  try {
    return await prisma.customer.delete({ where: { id } });
  } catch (err) {
    throw createHttpError(400, "Customer tidak bisa dihapus (mungkin sudah dipakai)");
  }
}

async function importCustomersFromExcel(rows) {
  if (!Array.isArray(rows)) {
    throw createHttpError(400, "Data Excel tidak valid");
  }

  const rawNames = rows
    .map((row) => (row && row["Nama Customer"]) || (row && row.name) || (row && row.Nama) || "")
    .map((name) => (typeof name === "string" ? name.trim() : ""))
    .filter((name) => name.length > 0);

  const uniqueNames = Array.from(new Set(rawNames));
  if (uniqueNames.length === 0) {
    throw createHttpError(400, "Tidak ada data Nama Customer yang valid");
  }

  const existing = await prisma.customer.findMany({
    where: { name: { in: uniqueNames } },
    select: { name: true },
  });

  const existingSet = new Set(existing.map((e) => e.name));
  const toCreate = uniqueNames.filter((name) => !existingSet.has(name));

  if (toCreate.length === 0) {
    return { created: 0, skipped: uniqueNames.length };
  }

  await prisma.customer.createMany({
    data: toCreate.map((name) => ({ name })),
  });

  return { created: toCreate.length, skipped: uniqueNames.length - toCreate.length };
}

module.exports = {
  listCustomers,
  createCustomer,
  deleteCustomer,
  importCustomersFromExcel,
};
