const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const WAREHOUSE_VALUES = new Set(["WH1", "WH2", "DG"]);
const SORTABLE_FIELDS = new Set(["gateNo", "area", "warehouse", "createdAt", "updatedAt"]);

function createHttpError(status, message, details) {
  const err = new Error(message);
  err.status = status;
  if (details) err.details = details;
  return err;
}

function normalizeSort(query) {
  const rawSortBy = typeof query.sortBy === "string" ? query.sortBy : "";
  const rawSortDir = typeof query.sortDir === "string" ? query.sortDir.toLowerCase() : "";
  const sortBy = SORTABLE_FIELDS.has(rawSortBy) ? rawSortBy : "createdAt";
  const sortDir = rawSortDir === "asc" ? "asc" : "desc";
  return { sortBy, sortDir };
}

function buildOrderBy(sortBy, sortDir) {
  const orderBy = [{ [sortBy]: sortDir }];
  if (sortBy !== "createdAt") {
    orderBy.push({ createdAt: "desc" });
  }
  return orderBy;
}

function normalizeInput(data) {
  const gateNo = typeof data.gateNo === "string" ? data.gateNo.trim() : "";
  const area = typeof data.area === "string" ? data.area.trim() : "";
  const warehouse =
    typeof data.warehouse === "string" ? data.warehouse.trim().toUpperCase() : "";
  return { gateNo, area, warehouse };
}

function validateInput({ gateNo, area, warehouse }) {
  if (!gateNo) throw createHttpError(400, "Gate No wajib diisi");
  if (!area) throw createHttpError(400, "Area wajib diisi");
  if (!warehouse || !WAREHOUSE_VALUES.has(warehouse)) {
    throw createHttpError(400, "Warehouse tidak valid");
  }
}

async function listGates(query) {
  const search = typeof query.search === "string" ? query.search.trim() : "";
  const warehouse =
    typeof query.warehouse === "string" ? query.warehouse.trim().toUpperCase() : "";
  const { sortBy, sortDir } = normalizeSort(query);
  const where = {};
  if (search) {
    where.OR = [
      { gateNo: { contains: search, mode: "insensitive" } },
      { area: { contains: search, mode: "insensitive" } },
    ];
  }
  if (warehouse) {
    where.warehouse = warehouse;
  }

  return prisma.gate.findMany({
    where,
    orderBy: buildOrderBy(sortBy, sortDir),
  });
}

async function createGate(data) {
  const input = normalizeInput(data);
  validateInput(input);
  try {
    return await prisma.gate.create({
      data: {
        gateNo: input.gateNo,
        area: input.area,
        warehouse: input.warehouse,
      },
    });
  } catch (err) {
    if (err && err.code === "P2002") {
      throw createHttpError(400, "Gate No sudah terdaftar untuk warehouse ini");
    }
    throw err;
  }
}

async function updateGate(id, data) {
  if (!id) throw createHttpError(400, "ID gate tidak valid");
  const input = normalizeInput(data);
  validateInput(input);
  try {
    return await prisma.gate.update({
      where: { id },
      data: {
        gateNo: input.gateNo,
        area: input.area,
        warehouse: input.warehouse,
      },
    });
  } catch (err) {
    if (err && err.code === "P2002") {
      throw createHttpError(400, "Gate No sudah terdaftar untuk warehouse ini");
    }
    if (err && err.code === "P2025") {
      throw createHttpError(404, "Gate tidak ditemukan");
    }
    throw err;
  }
}

async function deleteGate(id) {
  if (!id) throw createHttpError(400, "ID gate tidak valid");
  try {
    return await prisma.gate.delete({ where: { id } });
  } catch (err) {
    if (err && err.code === "P2025") {
      throw createHttpError(404, "Gate tidak ditemukan");
    }
    throw err;
  }
}

module.exports = {
  listGates,
  createGate,
  updateGate,
  deleteGate,
  importGatesFromExcel: async function importGatesFromExcel(rows) {
    if (!Array.isArray(rows)) {
      throw createHttpError(400, "Data Excel tidak valid");
    }

    const errors = [];
    const toCreate = [];
    const seen = new Set();
    let totalRows = 0;

    for (const row of rows) {
      const gateNo = typeof row.gateNo === "string" ? row.gateNo.trim() : "";
      const area = typeof row.area === "string" ? row.area.trim() : "";
      const warehouse =
        typeof row.warehouse === "string" ? row.warehouse.trim().toUpperCase() : "";
      const rowNumber = row.rowNumber;

      if (!gateNo && !area && !warehouse) {
        continue;
      }

      totalRows += 1;

      if (!gateNo) {
        errors.push({ rowNumber, gateNo, warehouse, message: "Gate No wajib diisi" });
        continue;
      }
      if (!area) {
        errors.push({ rowNumber, gateNo, warehouse, message: "Area wajib diisi" });
        continue;
      }
      if (!warehouse) {
        errors.push({ rowNumber, gateNo, warehouse, message: "Warehouse wajib diisi" });
        continue;
      }
      if (!WAREHOUSE_VALUES.has(warehouse)) {
        errors.push({ rowNumber, gateNo, warehouse, message: "Warehouse tidak valid" });
        continue;
      }

      const key = `${gateNo}||${warehouse}`;
      if (seen.has(key)) {
        errors.push({
          rowNumber,
          gateNo,
          warehouse,
          message: "Duplicate gate (gateNo+warehouse) already exists",
        });
        continue;
      }
      seen.add(key);
      toCreate.push({ rowNumber, gateNo, area, warehouse });
    }

    if (toCreate.length === 0) {
      return {
        totalRows,
        successRows: 0,
        failedRows: totalRows,
        errors,
      };
    }

    const existing = await prisma.gate.findMany({
      where: {
        OR: toCreate.map((row) => ({ gateNo: row.gateNo, warehouse: row.warehouse })),
      },
      select: { gateNo: true, warehouse: true },
    });
    const existingSet = new Set(existing.map((row) => `${row.gateNo}||${row.warehouse}`));

    const finalRows = [];
    for (const row of toCreate) {
      const key = `${row.gateNo}||${row.warehouse}`;
      if (existingSet.has(key)) {
        errors.push({
          rowNumber: row.rowNumber,
          gateNo: row.gateNo,
          warehouse: row.warehouse,
          message: "Duplicate gate (gateNo+warehouse) already exists",
        });
        continue;
      }
      finalRows.push(row);
    }

    let createdCount = 0;
    if (finalRows.length > 0) {
      const result = await prisma.gate.createMany({
        data: finalRows.map((row) => ({
          gateNo: row.gateNo,
          area: row.area,
          warehouse: row.warehouse,
        })),
        skipDuplicates: true,
      });
      createdCount = result.count || 0;
    }

    return {
      totalRows,
      successRows: createdCount,
      failedRows: Math.max(0, totalRows - createdCount),
      errors,
    };
  },
  listGatesForExport: async function listGatesForExport() {
    return prisma.gate.findMany({
      orderBy: [{ createdAt: "desc" }],
    });
  },
};
