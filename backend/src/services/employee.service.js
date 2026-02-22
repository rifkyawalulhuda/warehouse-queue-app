const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const POSITION_VALUES = new Set(["FOREMAN", "TALLYMAN", "OPR_FORKLIFT"]);

function createHttpError(status, message, details) {
  const err = new Error(message);
  err.status = status;
  if (details) err.details = details;
  return err;
}

function normalizePositionInput(value) {
  if (typeof value !== "string") return "";
  const normalized = value.trim().toUpperCase();
  if (!normalized) return "";
  if (POSITION_VALUES.has(normalized)) return normalized;

  const key = normalized.replace(/[\s-]+/g, "_");
  if (POSITION_VALUES.has(key)) return key;
  return "";
}

function normalizeEmployeeInput(data) {
  const nik = typeof data?.nik === "string" ? data.nik.trim() : "";
  const name = typeof data?.name === "string" ? data.name.trim() : "";
  const position = normalizePositionInput(data?.position);
  return { nik, name, position };
}

function validateEmployeeInput(input) {
  const errors = [];
  if (!input.nik) {
    errors.push("NIK wajib diisi");
  } else if (input.nik.length > 10) {
    errors.push("NIK maksimal 10 karakter");
  }

  if (!input.name) {
    errors.push("Nama wajib diisi");
  }

  if (!input.position || !POSITION_VALUES.has(input.position)) {
    errors.push("Jabatan harus Foreman, Tallyman, atau Opr Forklift");
  }

  if (errors.length > 0) {
    throw createHttpError(400, "Validasi gagal", errors);
  }
}

function handlePrismaError(err) {
  if (err && err.code === "P2002" && err.meta && err.meta.target) {
    const targets = Array.isArray(err.meta.target) ? err.meta.target : [err.meta.target];
    if (targets.includes("nik")) {
      throw createHttpError(409, "NIK sudah terdaftar");
    }
  }
  throw err;
}

async function listEmployees() {
  return prisma.employee.findMany({
    orderBy: [{ name: "asc" }],
  });
}

async function listEmployeesForExport() {
  return prisma.employee.findMany({
    orderBy: [{ createdAt: "desc" }],
  });
}

async function createEmployee(data) {
  const input = normalizeEmployeeInput(data);
  validateEmployeeInput(input);

  try {
    return await prisma.employee.create({
      data: {
        nik: input.nik,
        name: input.name,
        position: input.position,
      },
    });
  } catch (err) {
    handlePrismaError(err);
  }
}

async function updateEmployee(id, data) {
  if (!id) throw createHttpError(400, "ID karyawan tidak valid");
  const input = normalizeEmployeeInput(data);
  validateEmployeeInput(input);

  try {
    return await prisma.employee.update({
      where: { id },
      data: {
        nik: input.nik,
        name: input.name,
        position: input.position,
      },
    });
  } catch (err) {
    if (err && err.code === "P2025") {
      throw createHttpError(404, "Karyawan tidak ditemukan");
    }
    handlePrismaError(err);
  }
}

async function deleteEmployee(id) {
  if (!id) throw createHttpError(400, "ID karyawan tidak valid");
  try {
    return await prisma.employee.delete({ where: { id } });
  } catch (err) {
    if (err && err.code === "P2025") {
      throw createHttpError(404, "Karyawan tidak ditemukan");
    }
    throw createHttpError(400, "Karyawan tidak bisa dihapus");
  }
}

async function importEmployeesFromExcel(rows) {
  if (!Array.isArray(rows)) {
    throw createHttpError(400, "Data Excel tidak valid");
  }

  const errors = [];
  const parsed = [];
  const seenNik = new Set();

  for (const row of rows) {
    const rawNik = typeof row?.nik === "string" ? row.nik.trim() : "";
    const rawName = typeof row?.name === "string" ? row.name.trim() : "";
    const rawPosition = normalizePositionInput(row?.position);
    const rowNumber = row?.rowNumber || 0;

    if (!rawNik && !rawName && !row?.position) {
      continue;
    }

    const rowErrors = [];
    if (!rawNik) rowErrors.push("NIK wajib diisi");
    if (rawNik && rawNik.length > 10) rowErrors.push("NIK maksimal 10 karakter");
    if (!rawName) rowErrors.push("Nama wajib diisi");
    if (!rawPosition) {
      rowErrors.push("Jabatan harus Foreman, Tallyman, atau Opr Forklift");
    }

    if (rowErrors.length > 0) {
      errors.push(`Baris ${rowNumber}: ${rowErrors.join(", ")}`);
      continue;
    }

    if (seenNik.has(rawNik)) {
      continue;
    }
    seenNik.add(rawNik);
    parsed.push({
      nik: rawNik,
      name: rawName,
      position: rawPosition,
    });
  }

  if (errors.length > 0) {
    throw createHttpError(400, "Validasi import gagal", errors);
  }

  if (parsed.length === 0) {
    throw createHttpError(400, "Tidak ada data karyawan yang valid");
  }

  const existing = await prisma.employee.findMany({
    where: { nik: { in: parsed.map((row) => row.nik) } },
    select: { nik: true },
  });
  const existingNik = new Set(existing.map((item) => item.nik));
  const toCreate = parsed.filter((item) => !existingNik.has(item.nik));

  if (toCreate.length > 0) {
    await prisma.employee.createMany({
      data: toCreate,
    });
  }

  return {
    created: toCreate.length,
    skipped: parsed.length - toCreate.length,
  };
}

module.exports = {
  listEmployees,
  listEmployeesForExport,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  importEmployeesFromExcel,
};
