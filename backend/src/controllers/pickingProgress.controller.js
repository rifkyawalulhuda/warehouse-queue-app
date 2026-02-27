const ExcelJS = require("exceljs");
const xlsx = require("xlsx");
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

function formatDateOnly(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  const pad = (num) => String(num).padStart(2, "0");
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  return `${year}-${month}-${day}`;
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

function normalizeHeader(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function findHeaderIndex(headers, candidates) {
  for (const candidate of candidates) {
    const index = headers.indexOf(candidate);
    if (index !== -1) return index;
  }
  return -1;
}

function ensurePickingImportHeader(rows) {
  if (!rows.length) {
    const err = new Error("Header Excel tidak ditemukan");
    err.status = 400;
    throw err;
  }

  const headers = rows[0].map(normalizeHeader);
  const dateIdx = findHeaderIndex(headers, ["tanggal", "date"]);
  const customerNameIdx = findHeaderIndex(headers, ["customer name", "nama customer", "customer"]);
  const doNumberIdx = findHeaderIndex(headers, ["do number", "do no", "do"]);
  const destinationIdx = findHeaderIndex(headers, ["destination", "destinasi"]);
  const volumeCbmIdx = findHeaderIndex(headers, ["volume (cbm)", "volume cbm", "volume"]);
  const pickingQtyIdx = findHeaderIndex(headers, [
    "picking qty (barcode)",
    "picking qty barcode",
    "picking qty",
    "barcode",
  ]);

  if (
    dateIdx === -1 ||
    customerNameIdx === -1 ||
    doNumberIdx === -1 ||
    destinationIdx === -1 ||
    volumeCbmIdx === -1 ||
    pickingQtyIdx === -1
  ) {
    const err = new Error(
      "Header Excel tidak sesuai. Wajib: Tanggal, Customer Name, DO Number, Destination, Volume (CBM), Picking Qty (Barcode)"
    );
    err.status = 400;
    throw err;
  }

  return {
    dateIdx,
    customerNameIdx,
    doNumberIdx,
    destinationIdx,
    volumeCbmIdx,
    pickingQtyIdx,
  };
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

async function updatePickingProgress(req, res, next) {
  try {
    const actorUserId = await resolveActorUserId(req);
    const entry = await pickingProgressService.updatePickingProgress(
      req.params.id,
      req.body,
      actorUserId
    );
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
      { header: "Tanggal", key: "date", width: 14 },
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
      { header: "Notes from WH", key: "notesFromWh", width: 30 },
      { header: "Start Time", key: "startTime", width: 20 },
      { header: "Finish Time", key: "finishTime", width: 20 },
    ];
    worksheet.getRow(1).font = { bold: true };

    entries.forEach((entry, index) => {
      worksheet.addRow({
        no: index + 1,
        date: formatDateOnly(entry.date),
        customerName: entry.customer?.name || "-",
        doNumber: entry.doNumber || "-",
        destination: entry.destination || "-",
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
        notesFromWh: entry.notesFromWh || "-",
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

async function printPickingProgressSummary(req, res, next) {
  try {
    const result = await pickingProgressService.listPickingProgressForPrint(req.query || {});
    return sendSuccess(res, {
      dateFrom: req.query?.dateFrom || null,
      dateTo: req.query?.dateTo || null,
      status: req.query?.status || "ALL",
      search: req.query?.search || "",
      summary: result.summary,
      rows: result.items,
    });
  } catch (err) {
    return next(err);
  }
}

async function downloadPickingProgressTemplate(req, res, next) {
  try {
    const customerNames = await pickingProgressService.listCustomerNamesForTemplate();

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Picking Progress");
    const customerSheet = workbook.addWorksheet("Master Customer");
    const noteSheet = workbook.addWorksheet("Petunjuk");

    worksheet.columns = [
      { header: "Tanggal", key: "date", width: 14 },
      { header: "Customer Name", key: "customerName", width: 30 },
      { header: "DO Number", key: "doNumber", width: 18 },
      { header: "Destination", key: "destination", width: 20 },
      { header: "Volume (CBM)", key: "volumeCbm", width: 14 },
      { header: "Picking Qty (Barcode)", key: "pickingQty", width: 22 },
    ];
    worksheet.getRow(1).font = { bold: true };
    // Force DO Number and Destination columns as text to preserve exact user input.
    worksheet.getColumn(3).numFmt = "@";
    worksheet.getColumn(4).numFmt = "@";

    customerSheet.columns = [{ header: "Customer Name", key: "name", width: 30 }];
    customerSheet.getRow(1).font = { bold: true };
    customerNames.forEach((name) => customerSheet.addRow({ name }));
    customerSheet.state = "hidden";

    noteSheet.columns = [{ key: "note", width: 100 }];
    noteSheet.getCell("A1").value = "Petunjuk Upload Picking Progress";
    noteSheet.getCell("A1").font = { bold: true };
    noteSheet.getCell("A2").value =
      "1. Kolom wajib: Tanggal, Customer Name, DO Number, Destination, Volume (CBM), Picking Qty (Barcode).";
    noteSheet.getCell("A3").value = "2. Customer Name wajib pilih dari data Master Customer.";
    noteSheet.getCell("A4").value =
      "3. PL Time Release tidak perlu diisi. Tanggal mengikuti kolom Tanggal, jam mengikuti waktu upload file.";
    noteSheet.getCell("A5").value = "4. Tanggal boleh kosong, maka otomatis mengikuti tanggal upload.";

    if (customerNames.length > 0) {
      const listStart = 2;
      const listEnd = customerNames.length + 1;
      for (let row = 2; row <= 1000; row += 1) {
        worksheet.getCell(`B${row}`).dataValidation = {
          type: "list",
          allowBlank: true,
          formulae: [`'Master Customer'!$A$${listStart}:$A$${listEnd}`],
          showErrorMessage: true,
          errorTitle: "Customer tidak valid",
          error: "Pilih Customer Name dari daftar Master Customer",
        };
      }
    }

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=\"picking-progress-import-template.xlsx\""
    );
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    return next(err);
  }
}

async function importPickingProgress(req, res, next) {
  try {
    if (!req.file || !req.file.buffer) {
      const err = new Error("File Excel wajib diupload");
      err.status = 400;
      throw err;
    }
    if (req.file.originalname && !req.file.originalname.toLowerCase().endsWith(".xlsx")) {
      const err = new Error("File harus berformat .xlsx");
      err.status = 400;
      throw err;
    }

    const workbook = xlsx.read(req.file.buffer, { type: "buffer", cellDates: false });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: true });
    const headerIndex = ensurePickingImportHeader(rows);

    const dataRows = rows.slice(1).map((row, idx) => ({
      rowNumber: idx + 2,
      date: row[headerIndex.dateIdx],
      customerName: row[headerIndex.customerNameIdx],
      doNumber: row[headerIndex.doNumberIdx],
      destination: row[headerIndex.destinationIdx],
      volumeCbm: row[headerIndex.volumeCbmIdx],
      pickingQty: row[headerIndex.pickingQtyIdx],
    }));

    const actorUserId = await resolveActorUserId(req);
    const result = await pickingProgressService.importPickingProgressFromExcel(dataRows, actorUserId);
    return sendSuccess(res, result);
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

async function updatePickingWhNotes(req, res, next) {
  try {
    const actorUserId = await resolveActorUserId(req);
    const entry = await pickingProgressService.updatePickingProgressWhNotes(
      req.params.id,
      req.body?.notesFromWh,
      actorUserId
    );
    return sendSuccess(res, entry);
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  createPickingProgress,
  updatePickingProgress,
  listPickingProgress,
  exportPickingProgress,
  printPickingProgressSummary,
  downloadPickingProgressTemplate,
  importPickingProgress,
  getPickingProgressById,
  startPickingProgress,
  updatePickedQty,
  finishPickingProgress,
  cancelPickingProgress,
  updatePickingWhNotes,
};
