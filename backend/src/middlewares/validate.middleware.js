const { sendError } = require("../utils/response");

const ALLOWED_CATEGORIES = ["RECEIVING", "DELIVERY"];
const ALLOWED_STATUSES = ["MENUNGGU", "IN_WH", "PROSES", "SELESAI", "BATAL"];
const ALLOWED_STORE_TYPES = ["STORE_IN", "STORE_OUT"];
const ALLOWED_TRUCK_TYPES = ["CDD", "CDE", "FUSO", "WB", "FT20", "FT40", "OTHER"];

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidDateString(dateStr) {
  if (typeof dateStr !== "string") return false;
  const parts = dateStr.trim().split("-");
  if (parts.length !== 3) return false;
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function validateQueueCreate(req, res, next) {
  const errors = [];
  const { category, customerId, driverName, truckNumber } = req.body;

  if (!ALLOWED_CATEGORIES.includes(category)) {
    errors.push("category harus RECEIVING atau DELIVERY");
  }
  if (!isNonEmptyString(customerId)) {
    errors.push("customerId wajib diisi");
  }
  if (!isNonEmptyString(driverName)) {
    errors.push("driverName wajib diisi");
  }
  if (!isNonEmptyString(truckNumber)) {
    errors.push("truckNumber wajib diisi");
  }

  if (errors.length > 0) {
    return sendError(res, 400, "Validasi gagal", errors);
  }

  return next();
}

function validateQueueUpdate(req, res, next) {
  const { category, customerId, driverName, truckNumber, containerNumber, notes } = req.body;
  const errors = [];

  if (category !== undefined && !ALLOWED_CATEGORIES.includes(category)) {
    errors.push("category harus RECEIVING atau DELIVERY");
  }
  if (customerId !== undefined && !isNonEmptyString(customerId)) {
    errors.push("customerId tidak boleh kosong");
  }
  if (driverName !== undefined && !isNonEmptyString(driverName)) {
    errors.push("driverName tidak boleh kosong");
  }
  if (truckNumber !== undefined && !isNonEmptyString(truckNumber)) {
    errors.push("truckNumber tidak boleh kosong");
  }
  if (containerNumber !== undefined && typeof containerNumber !== "string") {
    errors.push("containerNumber harus string");
  }
  if (notes !== undefined && typeof notes !== "string") {
    errors.push("notes harus string");
  }

  if (errors.length > 0) {
    return sendError(res, 400, "Validasi gagal", errors);
  }

  return next();
}

function validateStatusChange(req, res, next) {
  const { newStatus } = req.body;
  if (!ALLOWED_STATUSES.includes(newStatus)) {
    return sendError(res, 400, "Validasi gagal", ["newStatus tidak valid"]);
  }
  return next();
}

function validateSetInWh(req, res, next) {
  const { gateId } = req.body;
  if (!isNonEmptyString(gateId)) {
    return sendError(res, 400, "Validasi gagal", ["gateId wajib diisi"]);
  }
  return next();
}

function validateSchedulePayload(req, res, next) {
  const errors = [];
  const { scheduleDate, storeType, customerId, items } = req.body || {};

  if (!isNonEmptyString(scheduleDate) || !isValidDateString(scheduleDate)) {
    errors.push("scheduleDate wajib format YYYY-MM-DD");
  }

  if (!ALLOWED_STORE_TYPES.includes(storeType)) {
    errors.push("storeType harus STORE_IN atau STORE_OUT");
  }

  if (!isNonEmptyString(customerId)) {
    errors.push("customerId wajib diisi");
  }

  if (!Array.isArray(items) || items.length === 0) {
    errors.push("items wajib diisi minimal 1");
  } else {
    items.forEach((item, index) => {
      const row = index + 1;
      const truckType = typeof item?.truckType === "string" ? item.truckType.trim().toUpperCase() : "";
      const qty = Number(item?.qty);
      const truckTypeOther =
        typeof item?.truckTypeOther === "string" ? item.truckTypeOther.trim() : "";

      if (!ALLOWED_TRUCK_TYPES.includes(truckType)) {
        errors.push(`items[${row}] truckType tidak valid`);
      }
      if (!Number.isInteger(qty) || qty < 1) {
        errors.push(`items[${row}] qty harus angka bulat minimal 1`);
      }
      if (truckType === "OTHER" && !truckTypeOther) {
        errors.push(`items[${row}] truckTypeOther wajib diisi jika truckType OTHER`);
      }
    });
  }

  if (errors.length > 0) {
    return sendError(res, 400, "Validasi gagal", errors);
  }

  return next();
}

module.exports = {
  validateQueueCreate,
  validateQueueUpdate,
  validateStatusChange,
  validateSetInWh,
  validateScheduleCreate: validateSchedulePayload,
  validateScheduleUpdate: validateSchedulePayload,
};
