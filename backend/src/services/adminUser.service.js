const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

const ADMIN_ROLES = {
  admin: "ADMIN",
  warehouse: "WAREHOUSE",
};

const adminSelect = {
  id: true,
  name: true,
  position: true,
  phone: true,
  role: true,
  username: true,
  createdAt: true,
  updatedAt: true,
};

function createHttpError(status, message, details) {
  const err = new Error(message);
  err.status = status;
  if (details) err.details = details;
  return err;
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeRole(role) {
  if (typeof role !== "string") return null;
  const key = role.trim().toLowerCase();
  return ADMIN_ROLES[key] || null;
}

function handlePrismaError(err) {
  if (err && err.code === "P2002" && err.meta && err.meta.target) {
    const targets = Array.isArray(err.meta.target) ? err.meta.target : [err.meta.target];
    if (targets.includes("username")) {
      throw createHttpError(409, "Username sudah digunakan");
    }
  }
  throw err;
}

async function listAdminUsers(query) {
  const search = typeof query.search === "string" ? query.search.trim() : "";
  const where = {};
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { position: { contains: search, mode: "insensitive" } },
      { phone: { contains: search, mode: "insensitive" } },
      { username: { contains: search, mode: "insensitive" } },
    ];
  }

  return prisma.adminUser.findMany({
    where,
    orderBy: [{ createdAt: "desc" }],
    select: adminSelect,
  });
}

async function getAdminUserById(id) {
  if (!id) throw createHttpError(400, "ID admin tidak valid");
  const admin = await prisma.adminUser.findUnique({
    where: { id },
    select: adminSelect,
  });
  if (!admin) {
    throw createHttpError(404, "Admin tidak ditemukan");
  }
  return admin;
}

async function createAdminUser(data) {
  const errors = [];
  if (!isNonEmptyString(data.name)) errors.push("Nama wajib diisi");
  if (!isNonEmptyString(data.position)) errors.push("Jabatan wajib diisi");
  if (!isNonEmptyString(data.phone)) errors.push("Nomor Telp wajib diisi");
  if (!isNonEmptyString(data.username)) errors.push("Username wajib diisi");
  if (!isNonEmptyString(data.password)) errors.push("Password wajib diisi");

  const role = normalizeRole(data.role);
  if (!role) errors.push("Role harus admin atau warehouse");

  if (errors.length) {
    throw createHttpError(400, "Validasi gagal", errors);
  }

  const passwordHash = await bcrypt.hash(data.password.trim(), 10);

  try {
    return await prisma.adminUser.create({
      data: {
        name: data.name.trim(),
        position: data.position.trim(),
        phone: data.phone.trim(),
        role,
        username: data.username.trim(),
        passwordHash,
      },
      select: adminSelect,
    });
  } catch (err) {
    handlePrismaError(err);
  }
}

async function updateAdminUser(id, data) {
  if (!id) throw createHttpError(400, "ID admin tidak valid");

  const errors = [];
  if (!isNonEmptyString(data.name)) errors.push("Nama wajib diisi");
  if (!isNonEmptyString(data.position)) errors.push("Jabatan wajib diisi");
  if (!isNonEmptyString(data.phone)) errors.push("Nomor Telp wajib diisi");
  if (!isNonEmptyString(data.username)) errors.push("Username wajib diisi");

  const role = normalizeRole(data.role);
  if (!role) errors.push("Role harus admin atau warehouse");

  if (errors.length) {
    throw createHttpError(400, "Validasi gagal", errors);
  }

  const updateData = {
    name: data.name.trim(),
    position: data.position.trim(),
    phone: data.phone.trim(),
    role,
    username: data.username.trim(),
  };

  if (isNonEmptyString(data.password)) {
    updateData.passwordHash = await bcrypt.hash(data.password.trim(), 10);
  }

  try {
    return await prisma.adminUser.update({
      where: { id },
      data: updateData,
      select: adminSelect,
    });
  } catch (err) {
    if (err && err.code === "P2025") {
      throw createHttpError(404, "Admin tidak ditemukan");
    }
    handlePrismaError(err);
  }
}

async function deleteAdminUser(id) {
  if (!id) throw createHttpError(400, "ID admin tidak valid");
  try {
    return await prisma.adminUser.delete({
      where: { id },
      select: adminSelect,
    });
  } catch (err) {
    if (err && err.code === "P2025") {
      throw createHttpError(404, "Admin tidak ditemukan");
    }
    throw createHttpError(400, "Admin tidak bisa dihapus");
  }
}

module.exports = {
  listAdminUsers,
  getAdminUserById,
  createAdminUser,
  updateAdminUser,
  deleteAdminUser,
};
