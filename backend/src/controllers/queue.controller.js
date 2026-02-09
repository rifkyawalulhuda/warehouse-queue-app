const ExcelJS = require("exceljs");
const queueService = require("../services/queue.service");
const adminUserService = require("../services/adminUser.service");
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

function mapCategory(category) {
  if (category === "RECEIVING") return "Receiving";
  if (category === "DELIVERY") return "Delivery";
  return "-";
}

function formatDurationHuman(registerTime, finishTime) {
  if (!registerTime || !finishTime) return "-";
  const start = new Date(registerTime);
  const end = new Date(finishTime);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "-";
  const durationMs = end.getTime() - start.getTime();
  if (durationMs < 0) return "-";

  const totalMinutes = Math.floor(durationMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0 && minutes > 0) return `${hours} jam ${minutes} menit`;
  if (hours > 0 && minutes === 0) return `${hours} jam`;
  if (hours === 0 && minutes > 0) return `${minutes} menit`;
  return "kurang dari 1 menit";
}

function buildExportFilename(dateFrom, dateTo) {
  if (dateFrom && dateTo) {
    return `antrian_truk_${dateFrom}_sampai_${dateTo}.xlsx`;
  }
  return "antrian_truk.xlsx";
}

async function createQueue(req, res, next) {
  try {
    const actorUser = req.user?.sub ? await adminUserService.getAdminUserById(req.user.sub) : null;
    const entry = await queueService.createQueueEntry(req.body, actorUser);
    return sendSuccess(res, entry);
  } catch (err) {
    return next(err);
  }
}

async function listQueue(req, res, next) {
  try {
    const result = await queueService.listQueueEntries(req.query);
    return res.json({ ok: true, data: result.data, meta: result.meta });
  } catch (err) {
    return next(err);
  }
}

async function getQueueById(req, res, next) {
  try {
    const entry = await queueService.getQueueEntryById(req.params.id);
    return sendSuccess(res, entry);
  } catch (err) {
    return next(err);
  }
}

async function updateQueue(req, res, next) {
  try {
    const actorUser = req.user?.sub ? await adminUserService.getAdminUserById(req.user.sub) : null;
    const entry = await queueService.updateQueueEntry(req.params.id, req.body, actorUser);
    return sendSuccess(res, entry);
  } catch (err) {
    return next(err);
  }
}

async function updateQueueStatus(req, res, next) {
  try {
    const actorUser = req.user?.sub ? await adminUserService.getAdminUserById(req.user.sub) : null;
    const entry = await queueService.changeQueueStatus(
      req.params.id,
      req.body.newStatus,
      actorUser,
      req.body.gateId
    );
    return sendSuccess(res, entry);
  } catch (err) {
    return next(err);
  }
}

async function setInWh(req, res, next) {
  try {
    const actorUser = req.user?.sub ? await adminUserService.getAdminUserById(req.user.sub) : null;
    const entry = await queueService.changeQueueStatus(
      req.params.id,
      "IN_WH",
      actorUser,
      req.body.gateId
    );
    return sendSuccess(res, entry);
  } catch (err) {
    return next(err);
  }
}

async function exportQueue(req, res, next) {
  try {
    const { dateFrom, dateTo } = req.query;
    const entries = await queueService.listQueueEntriesForExport(req.query);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Antrian Truk");

    worksheet.columns = [
      { header: "No", key: "no", width: 6 },
      { header: "Customer Name", key: "customerName", width: 28 },
      { header: "Driver Name", key: "driverName", width: 20 },
      { header: "No Truck", key: "truckNumber", width: 16 },
      { header: "No Container", key: "containerNumber", width: 18 },
      { header: "Register Time", key: "registerTime", width: 20 },
      { header: "In WH - Time", key: "inWhTime", width: 20 },
      { header: "Start", key: "startTime", width: 20 },
      { header: "Finish", key: "finishTime", width: 20 },
      { header: "Total Waktu (Register → Finish)", key: "totalDuration", width: 28 },
      { header: "Time Remaining", key: "timeRemaining", width: 18 },
      { header: "Status", key: "status", width: 14 },
      { header: "Category", key: "category", width: 14 },
    ];

    worksheet.getRow(1).font = { bold: true };

    entries.forEach((entry, index) => {
      worksheet.addRow({
        no: index + 1,
        customerName: entry.customer?.name || "-",
        driverName: entry.driverName || "-",
        truckNumber: entry.truckNumber || "-",
        containerNumber: entry.containerNumber || "-",
        registerTime: formatDateTime(entry.registerTime),
        inWhTime: formatDateTime(entry.inWhTime),
        startTime: formatDateTime(entry.startTime),
        finishTime: formatDateTime(entry.finishTime),
        totalDuration: formatDurationHuman(entry.registerTime, entry.finishTime),
        timeRemaining: "-",
        status: entry.status || "-",
        category: mapCategory(entry.category),
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

async function displayQueue(req, res, next) {
  try {
    const payload = await queueService.listQueueEntriesForDisplay();
    return sendSuccess(res, payload);
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  createQueue,
  listQueue,
  getQueueById,
  updateQueue,
  updateQueueStatus,
  setInWh,
  exportQueue,
  displayQueue,
};
