const ExcelJS = require("exceljs");
const xlsx = require("xlsx");
const adminUserService = require("../services/adminUser.service");
const pickingProgressService = require("../services/pickingProgress.service");
const exportService = require("../services/export.service");
const { resolveExportScope } = require("../utils/exportScope");
const { sendSuccess } = require("../utils/response");

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

async function resolveActorUser(req) {
  const actorId = req.user?.sub;
  if (!actorId) return null;
  const actor = await adminUserService.getAdminUserById(actorId);
  return actor;
}

async function createPickingProgress(req, res, next) {
  try {
    const actorUser = await resolveActorUser(req);
    const entry = await pickingProgressService.createPickingProgress(req.body, actorUser);
    return sendSuccess(res, entry);
  } catch (err) {
    return next(err);
  }
}

async function updatePickingProgress(req, res, next) {
  try {
    const actorUser = await resolveActorUser(req);
    const entry = await pickingProgressService.updatePickingProgress(
      req.params.id,
      req.body,
      actorUser
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
    const scope = resolveExportScope(req.query);
    const { workbook, fileName } = await exportService.buildWorkbookFor(
      "PICKING_PROGRESS",
      scope
    );

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
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

    const actorUser = await resolveActorUser(req);
    const result = await pickingProgressService.importPickingProgressFromExcel(dataRows, actorUser);
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
    const actorUser = await resolveActorUser(req);
    const entry = await pickingProgressService.startPickingProgress(
      req.params.id,
      actorUser,
      req.body?.pickerEmployeeId
    );
    return sendSuccess(res, entry);
  } catch (err) {
    return next(err);
  }
}

async function updatePickedQty(req, res, next) {
  try {
    const actorUser = await resolveActorUser(req);
    const entry = await pickingProgressService.updatePickedQty(
      req.params.id,
      Number(req.body.delta),
      actorUser
    );
    return sendSuccess(res, entry);
  } catch (err) {
    return next(err);
  }
}

async function finishPickingProgress(req, res, next) {
  try {
    const actorUser = await resolveActorUser(req);
    const entry = await pickingProgressService.finishPickingProgress(req.params.id, actorUser);
    return sendSuccess(res, entry);
  } catch (err) {
    return next(err);
  }
}

async function cancelPickingProgress(req, res, next) {
  try {
    const actorUser = await resolveActorUser(req);
    const entry = await pickingProgressService.cancelPickingProgress(
      req.params.id,
      actorUser,
      req.body?.reason
    );
    return sendSuccess(res, entry);
  } catch (err) {
    return next(err);
  }
}

async function updatePickingWhNotes(req, res, next) {
  try {
    const actorUser = await resolveActorUser(req);
    const entry = await pickingProgressService.updatePickingProgressWhNotes(
      req.params.id,
      req.body?.notesFromWh,
      actorUser
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
