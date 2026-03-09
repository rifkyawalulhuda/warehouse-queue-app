const { sendError } = require("../utils/response");

const ALLOWED_CATEGORIES = ["RECEIVING", "DELIVERY"];
const ALLOWED_STATUSES = ["MENUNGGU", "IN_WH", "PROSES", "SELESAI", "BATAL"];
const ALLOWED_STORE_TYPES = ["STORE_IN", "STORE_OUT"];
const ALLOWED_TRUCK_TYPES = ["CDD", "CDE", "FUSO", "WB", "FT20", "FT40", "OTHER"];
const SLA_STEP_MINUTES = 15;
const MAX_SLA_MINUTES = 24 * 60;

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

function isValidDateInput(value) {
  if (!value) return false;
  if (isValidDateString(value)) return true;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime());
}

function parseSlaMinutes(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return null;
  return parsed;
}

function isValidSlaMinutes(value) {
  return (
    Number.isInteger(value) &&
    value >= SLA_STEP_MINUTES &&
    value <= MAX_SLA_MINUTES &&
    value % SLA_STEP_MINUTES === 0
  );
}

function validateQueueCreate(req, res, next) {
  const errors = [];
  const {
    category,
    customerId,
    driverName,
    truckNumber,
    registerTime,
    slaWaitingMinutes,
    slaInWhProcessMinutes,
  } = req.body;
  const waitingSla = parseSlaMinutes(slaWaitingMinutes);
  const inWhProcessSla = parseSlaMinutes(slaInWhProcessMinutes);

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
  if (registerTime !== undefined && registerTime !== null && registerTime !== "" && !isValidDateInput(registerTime)) {
    errors.push("registerTime tidak valid");
  }
  if (!isValidSlaMinutes(waitingSla)) {
    errors.push("slaWaitingMinutes wajib angka kelipatan 15 menit, minimal 15 dan maksimal 1440");
  }
  if (!isValidSlaMinutes(inWhProcessSla)) {
    errors.push(
      "slaInWhProcessMinutes wajib angka kelipatan 15 menit, minimal 15 dan maksimal 1440"
    );
  }

  if (errors.length > 0) {
    return sendError(res, 400, "Validasi gagal", errors);
  }

  return next();
}

function validateQueueUpdate(req, res, next) {
  const {
    category,
    customerId,
    driverName,
    truckNumber,
    containerNumber,
    notes,
    registerTime,
    slaWaitingMinutes,
    slaInWhProcessMinutes,
  } = req.body;
  const errors = [];
  const waitingSla = slaWaitingMinutes === undefined ? null : parseSlaMinutes(slaWaitingMinutes);
  const inWhProcessSla =
    slaInWhProcessMinutes === undefined ? null : parseSlaMinutes(slaInWhProcessMinutes);

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
  if (registerTime !== undefined && registerTime !== null && registerTime !== "" && !isValidDateInput(registerTime)) {
    errors.push("registerTime tidak valid");
  }
  if (slaWaitingMinutes !== undefined && !isValidSlaMinutes(waitingSla)) {
    errors.push("slaWaitingMinutes harus kelipatan 15 menit, minimal 15 dan maksimal 1440");
  }
  if (slaInWhProcessMinutes !== undefined && !isValidSlaMinutes(inWhProcessSla)) {
    errors.push("slaInWhProcessMinutes harus kelipatan 15 menit, minimal 15 dan maksimal 1440");
  }

  if (errors.length > 0) {
    return sendError(res, 400, "Validasi gagal", errors);
  }

  return next();
}

function validateStatusChange(req, res, next) {
  const { newStatus, reason } = req.body;
  if (!ALLOWED_STATUSES.includes(newStatus)) {
    return sendError(res, 400, "Validasi gagal", ["newStatus tidak valid"]);
  }
  if (newStatus === "BATAL") {
    const cancelReason = typeof reason === "string" ? reason.trim() : "";
    if (!cancelReason) {
      return sendError(res, 400, "Validasi gagal", ["reason wajib diisi saat status BATAL"]);
    }
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

function validateQueueWhNotesUpdate(req, res, next) {
  const { notesFromWh } = req.body || {};
  if (notesFromWh !== undefined && typeof notesFromWh !== "string") {
    return sendError(res, 400, "Validasi gagal", ["notesFromWh harus string"]);
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

function validatePickingCreate(req, res, next) {
  const errors = [];
  const { date, customerId, doNumber, destination, volumeCbm, plTimeRelease, pickingQty } = req.body || {};

  if (date !== undefined && date !== null && date !== "" && !isValidDateInput(date)) {
    errors.push("date tidak valid");
  }
  if (plTimeRelease !== undefined && plTimeRelease !== null && plTimeRelease !== "" && !isValidDateInput(plTimeRelease)) {
    errors.push("plTimeRelease tidak valid");
  }
  if (!isNonEmptyString(customerId)) {
    errors.push("customerId wajib diisi");
  }
  if (!isNonEmptyString(doNumber)) {
    errors.push("doNumber wajib diisi");
  }
  if (!isNonEmptyString(destination)) {
    errors.push("destination wajib diisi");
  }
  if (volumeCbm === undefined || volumeCbm === null || volumeCbm === "" || !Number.isFinite(Number(volumeCbm)) || Number(volumeCbm) < 0) {
    errors.push("volumeCbm harus angka dan minimal 0");
  }
  if (!Number.isInteger(pickingQty) || pickingQty < 1) {
    errors.push("pickingQty harus angka bulat minimal 1");
  }

  if (errors.length > 0) {
    return sendError(res, 400, "Validasi gagal", errors);
  }
  return next();
}

function validatePickingUpdate(req, res, next) {
  const errors = [];
  const { date, customerId, doNumber, destination, volumeCbm, plTimeRelease, pickingQty } = req.body || {};

  if (date !== undefined && date !== null && date !== "" && !isValidDateInput(date)) {
    errors.push("date tidak valid");
  }
  if (
    plTimeRelease !== undefined &&
    plTimeRelease !== null &&
    plTimeRelease !== "" &&
    !isValidDateInput(plTimeRelease)
  ) {
    errors.push("plTimeRelease tidak valid");
  }
  if (!isNonEmptyString(customerId)) {
    errors.push("customerId wajib diisi");
  }
  if (!isNonEmptyString(doNumber)) {
    errors.push("doNumber wajib diisi");
  }
  if (!isNonEmptyString(destination)) {
    errors.push("destination wajib diisi");
  }
  if (
    volumeCbm === undefined ||
    volumeCbm === null ||
    volumeCbm === "" ||
    !Number.isFinite(Number(volumeCbm)) ||
    Number(volumeCbm) < 0
  ) {
    errors.push("volumeCbm harus angka dan minimal 0");
  }
  if (!Number.isInteger(pickingQty) || pickingQty < 1) {
    errors.push("pickingQty harus angka bulat minimal 1");
  }

  if (errors.length > 0) {
    return sendError(res, 400, "Validasi gagal", errors);
  }
  return next();
}

function validatePickingQtyUpdate(req, res, next) {
  const { delta } = req.body || {};
  if (!Number.isInteger(delta) || delta === 0) {
    return sendError(res, 400, "Validasi gagal", ["delta harus angka bulat dan tidak boleh 0"]);
  }
  return next();
}

function validatePickingStart(req, res, next) {
  const { pickerEmployeeId } = req.body || {};
  if (!isNonEmptyString(pickerEmployeeId)) {
    return sendError(res, 400, "Validasi gagal", ["pickerEmployeeId wajib diisi"]);
  }
  return next();
}

function validatePickingCancel(req, res, next) {
  const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
  if (!reason) {
    return sendError(res, 400, "Validasi gagal", ["reason wajib diisi"]);
  }
  return next();
}

function validatePickingWhNotesUpdate(req, res, next) {
  const { notesFromWh } = req.body || {};
  if (notesFromWh !== undefined && typeof notesFromWh !== "string") {
    return sendError(res, 400, "Validasi gagal", ["notesFromWh harus string"]);
  }
  return next();
}

module.exports = {
  validateQueueCreate,
  validateQueueUpdate,
  validateStatusChange,
  validateSetInWh,
  validateQueueWhNotesUpdate,
  validateScheduleCreate: validateSchedulePayload,
  validateScheduleUpdate: validateSchedulePayload,
  validatePickingCreate,
  validatePickingUpdate,
  validatePickingStart,
  validatePickingCancel,
  validatePickingQtyUpdate,
  validatePickingWhNotesUpdate,
};
