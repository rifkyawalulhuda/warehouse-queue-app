const ExcelJS = require("exceljs");
const scheduleService = require("../services/schedule.service");
const { sendSuccess } = require("../utils/response");

const STORE_TYPE_LABELS = {
  STORE_IN: "Store In",
  STORE_OUT: "Store Out",
};

const TRUCK_TYPE_EXPORT_LABELS = {
  CDD: "CDD",
  CDE: "CDE",
  FUSO: "FUSO",
  WB: "W/B",
  FT20: "20 ft",
  FT40: "40 ft",
  OTHER: "Other",
};

function pad(value) {
  return String(value).padStart(2, "0");
}

function formatDateOnly(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  const dd = pad(date.getUTCDate());
  const mm = pad(date.getUTCMonth() + 1);
  const yyyy = date.getUTCFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  const yyyy = date.getFullYear();
  const mm = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const hh = pad(date.getHours());
  const mi = pad(date.getMinutes());
  const ss = pad(date.getSeconds());
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
}

function buildExportFilename(dateFrom, dateTo) {
  if (dateFrom && dateTo) {
    return `schedule_pengiriman_${dateFrom}_sampai_${dateTo}.xlsx`;
  }
  return "schedule_pengiriman.xlsx";
}

function truckTypeLabel(item) {
  if (item.truckType === "OTHER") {
    return item.truckTypeOther ? `Other - ${item.truckTypeOther}` : "Other";
  }
  return TRUCK_TYPE_EXPORT_LABELS[item.truckType] || item.truckType;
}

async function createSchedule(req, res, next) {
  try {
    const created = await scheduleService.createSchedule(req.body, req.user?.sub || null);
    return sendSuccess(res, created);
  } catch (err) {
    return next(err);
  }
}

async function listSchedules(req, res, next) {
  try {
    const result = await scheduleService.listSchedules(req.query);
    return res.json({ ok: true, data: result.data, meta: result.meta });
  } catch (err) {
    return next(err);
  }
}

async function getScheduleById(req, res, next) {
  try {
    const schedule = await scheduleService.getScheduleById(req.params.id);
    return sendSuccess(res, schedule);
  } catch (err) {
    return next(err);
  }
}

async function updateSchedule(req, res, next) {
  try {
    const updated = await scheduleService.updateSchedule(req.params.id, req.body);
    return sendSuccess(res, updated);
  } catch (err) {
    return next(err);
  }
}

async function deleteSchedule(req, res, next) {
  try {
    const deleted = await scheduleService.deleteSchedule(req.params.id);
    return sendSuccess(res, deleted);
  } catch (err) {
    return next(err);
  }
}

async function exportSchedules(req, res, next) {
  try {
    const rows = await scheduleService.listSchedulesForExport(req.query);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Schedule Pengiriman");

    worksheet.columns = [
      { header: "Tanggal", key: "scheduleDate", width: 14 },
      { header: "Store Type", key: "storeType", width: 14 },
      { header: "Customer Name", key: "customerName", width: 28 },
      { header: "Jenis Truck", key: "truckType", width: 24 },
      { header: "Qty", key: "qty", width: 10 },
      { header: "Created At", key: "createdAt", width: 20 },
    ];
    worksheet.getRow(1).font = { bold: true };

    rows.forEach((schedule) => {
      if (!schedule.items || schedule.items.length === 0) {
        worksheet.addRow({
          scheduleDate: formatDateOnly(schedule.scheduleDate),
          storeType: STORE_TYPE_LABELS[schedule.storeType] || schedule.storeType,
          customerName: schedule.customer?.name || "-",
          truckType: "-",
          qty: 0,
          createdAt: formatDateTime(schedule.createdAt),
        });
        return;
      }

      schedule.items.forEach((item) => {
        worksheet.addRow({
          scheduleDate: formatDateOnly(schedule.scheduleDate),
          storeType: STORE_TYPE_LABELS[schedule.storeType] || schedule.storeType,
          customerName: schedule.customer?.name || "-",
          truckType: truckTypeLabel(item),
          qty: item.qty,
          createdAt: formatDateTime(schedule.createdAt),
        });
      });
    });

    const filename = buildExportFilename(req.query.dateFrom, req.query.dateTo);
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

module.exports = {
  createSchedule,
  listSchedules,
  getScheduleById,
  updateSchedule,
  deleteSchedule,
  exportSchedules,
};
