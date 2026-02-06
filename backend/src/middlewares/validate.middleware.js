const { sendError } = require("../utils/response");

const ALLOWED_CATEGORIES = ["RECEIVING", "DELIVERY"];
const ALLOWED_STATUSES = ["MENUNGGU", "IN_WH", "PROSES", "SELESAI", "BATAL"];

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
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

module.exports = {
  validateQueueCreate,
  validateQueueUpdate,
  validateStatusChange,
};
