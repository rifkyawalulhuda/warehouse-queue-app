const ExcelJS = require("exceljs");
const adminUserService = require("../services/adminUser.service");
const pickingProgressService = require("../services/pickingProgress.service");
const { sendSuccess } = require("../utils/response");

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  const pad = (num) => String(num).padStart(2, "0");
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

function formatTimeRemaining(seconds, status) {
  if (status !== "ON_PROCESS" || seconds === null || seconds === undefined) return "-";
  const abs = Math.abs(seconds);
  const mins = Math.floor(abs / 60);
  const secs = abs % 60;
  const text = `${mins}m ${String(secs).padStart(2, "0")}s`;
  if (seconds < 0) return `Over SLA ${text}`;
  return text;
}

function buildExportFilename(dateFrom, dateTo) {
  if (dateFrom && dateTo) {
    return `picking_progress_${dateFrom}_sampai_${dateTo}.xlsx`;
  }
  return "picking_progress.xlsx";
}

function formatPercentage(value) {
  const num = Number(value ?? 0);
  if (!Number.isFinite(num)) return "0%";
  return `${num.toFixed(2).replace(/\.?0+$/, "")}%`;
}

async function resolveActorUserId(req) {
  const actorId = req.user?.sub;
  if (!actorId) return null;
  const actor = await adminUserService.getAdminUserById(actorId);
  return actor.id;
}

async function createPickingProgress(req, res, next) {
  try {
    const actorUserId = await resolveActorUserId(req);
    const entry = await pickingProgressService.createPickingProgress(req.body, actorUserId);
    return sendSuccess(res, entry);
  } catch (err) {
    return next(err);
  }
}

async function listPickingProgress(req, res, next) {
  try {
    const result = await pickingProgressService.listPickingProgress(req.query);
    return res.json({ ok: true, items: result.items, meta: result.meta });
  } catch (err) {
    return next(err);
  }
}

async function exportPickingProgress(req, res, next) {
  try {
    const { dateFrom, dateTo } = req.query || {};
    const entries = await pickingProgressService.listPickingProgressForExport(req.query || {});

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Picking Progress");
    worksheet.columns = [
      { header: "No", key: "no", width: 6 },
      { header: "Nama Customer", key: "customerName", width: 24 },
      { header: "DO Number", key: "doNumber", width: 18 },
      { header: "Destination", key: "destination", width: 18 },
      { header: "Volume (CBM)", key: "volumeCbm", width: 14 },
      { header: "PL Time Release", key: "plTimeRelease", width: 20 },
      { header: "Picking Qty (Barcode)", key: "pickingQty", width: 20 },
      { header: "Picked Qty", key: "pickedQty", width: 12 },
      { header: "Remain", key: "remainQty", width: 10 },
      { header: "Picking Progress", key: "pickingProgress", width: 16 },
      { header: "Nama Karyawan", key: "pickerName", width: 18 },
      { header: "Time Remaining", key: "timeRemaining", width: 18 },
      { header: "Status", key: "status", width: 14 },
      { header: "Keterangan Batal", key: "cancelReason", width: 30 },
      { header: "Start Time", key: "startTime", width: 20 },
      { header: "Finish Time", key: "finishTime", width: 20 },
    ];
    worksheet.getRow(1).font = { bold: true };

    entries.forEach((entry, index) => {
      worksheet.addRow({
        no: index + 1,
        customerName: entry.customer?.name || "-",
        doNumber: entry.doNumber || entry.noContainer || "-",
        destination: entry.destination || entry.noDock || "-",
        volumeCbm: entry.volumeCbm ?? "-",
        plTimeRelease: formatDateTime(entry.plTimeRelease || entry.startTime),
        pickingQty: entry.pickingQty ?? 0,
        pickedQty: entry.pickedQty ?? 0,
        remainQty: entry.remainQty ?? 0,
        pickingProgress: formatPercentage(entry.pickingProgressPercent),
        pickerName: entry.pickerEmployee?.name || "-",
        timeRemaining: formatTimeRemaining(entry.timeRemainingSeconds, entry.status),
        status: entry.status || "-",
        cancelReason: entry.logs?.[0]?.note || "-",
        startTime: formatDateTime(entry.startTime),
        finishTime: formatDateTime(entry.finishTime),
      });
    });

    const filename = buildExportFilename(dateFrom, dateTo);
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename=\"${filename}\"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    return next(err);
  }
}

async function getPickingProgressById(req, res, next) {
  try {
    const entry = await pickingProgressService.getPickingProgressById(req.params.id);
    return sendSuccess(res, entry);
  } catch (err) {
    return next(err);
  }
}

async function startPickingProgress(req, res, next) {
  try {
    const actorUserId = await resolveActorUserId(req);
    const entry = await pickingProgressService.startPickingProgress(
      req.params.id,
      actorUserId,
      req.body?.pickerEmployeeId
    );
    return sendSuccess(res, entry);
  } catch (err) {
    return next(err);
  }
}

async function updatePickedQty(req, res, next) {
  try {
    const actorUserId = await resolveActorUserId(req);
    const entry = await pickingProgressService.updatePickedQty(
      req.params.id,
      Number(req.body.delta),
      actorUserId
    );
    return sendSuccess(res, entry);
  } catch (err) {
    return next(err);
  }
}

async function finishPickingProgress(req, res, next) {
  try {
    const actorUserId = await resolveActorUserId(req);
    const entry = await pickingProgressService.finishPickingProgress(req.params.id, actorUserId);
    return sendSuccess(res, entry);
  } catch (err) {
    return next(err);
  }
}

async function cancelPickingProgress(req, res, next) {
  try {
    const actorUserId = await resolveActorUserId(req);
    const entry = await pickingProgressService.cancelPickingProgress(
      req.params.id,
      actorUserId,
      req.body?.reason
    );
    return sendSuccess(res, entry);
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  createPickingProgress,
  listPickingProgress,
  exportPickingProgress,
  getPickingProgressById,
  startPickingProgress,
  updatePickedQty,
  finishPickingProgress,
  cancelPickingProgress,
};
