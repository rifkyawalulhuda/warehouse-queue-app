const ExcelJS = require("exceljs");
const xlsx = require("xlsx");
const transporterService = require("../services/transporter.service");
const { sendSuccess, sendPaginated } = require("../utils/response");

function normalizeHeader(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function ensureTransporterHeader(rows) {
  if (!rows.length) {
    const err = new Error("Header Excel tidak ditemukan");
    err.status = 400;
    throw err;
  }

  const headers = rows[0].map(normalizeHeader);
  const nameIdx = headers.indexOf("nama transporter");
  const statusIdx = headers.indexOf("status aktif");

  if (nameIdx === -1) {
    const err = new Error("Header Excel tidak sesuai. Wajib: Nama Transporter");
    err.status = 400;
    throw err;
  }

  return { nameIdx, statusIdx };
}

async function listTransporters(req, res, next) {
  try {
    const { data, meta } = await transporterService.listTransporters(req.query);
    return sendPaginated(res, data, meta);
  } catch (err) {
    return next(err);
  }
}

async function createTransporter(req, res, next) {
  try {
    const data = await transporterService.createTransporter(req.body);
    return sendSuccess(res, data);
  } catch (err) {
    return next(err);
  }
}

async function updateTransporter(req, res, next) {
  try {
    const data = await transporterService.updateTransporter(req.params.id, req.body);
    return sendSuccess(res, data);
  } catch (err) {
    return next(err);
  }
}

async function deleteTransporter(req, res, next) {
  try {
    const data = await transporterService.deleteTransporter(req.params.id);
    return sendSuccess(res, data);
  } catch (err) {
    return next(err);
  }
}

async function importTransporters(req, res, next) {
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

    const workbook = xlsx.read(req.file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: "" });

    const { nameIdx, statusIdx } = ensureTransporterHeader(rows);

    const dataRows = rows.slice(1).map((row, idx) => ({
      rowNumber: idx + 2,
      name: row[nameIdx],
      isActive: statusIdx === -1 ? "" : row[statusIdx],
    }));

    const result = await transporterService.importTransportersFromExcel(dataRows);
    return sendSuccess(res, result);
  } catch (err) {
    return next(err);
  }
}

async function downloadTemplate(req, res, next) {
  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Master Transporter");
    const referenceSheet = workbook.addWorksheet("Referensi Status");

    const statusOptions = ["AKTIF", "NONAKTIF"];

    worksheet.columns = [
      { header: "Nama Transporter", key: "name", width: 32 },
      { header: "Status Aktif", key: "isActive", width: 16 },
    ];
    worksheet.getRow(1).font = { bold: true };
    worksheet.addRow({ name: "PT Logistik Nusantara", isActive: "AKTIF" });
    worksheet.addRow({ name: "CV Sinar Jaya Transport", isActive: "AKTIF" });
    worksheet.addRow({ name: "PT Trans Lama", isActive: "NONAKTIF" });

    referenceSheet.columns = [{ header: "Status", key: "status", width: 16 }];
    referenceSheet.getRow(1).font = { bold: true };
    statusOptions.forEach((status) => {
      referenceSheet.addRow({ status });
    });
    referenceSheet.state = "hidden";

    const listStart = 2;
    const listEnd = statusOptions.length + 1;
    for (let row = 2; row <= 1000; row += 1) {
      worksheet.getCell(`B${row}`).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [`'Referensi Status'!$A$${listStart}:$A$${listEnd}`],
        showErrorMessage: true,
        errorTitle: "Status tidak valid",
        error: "Pilih Status Aktif dari dropdown (AKTIF atau NONAKTIF)",
      };
    }

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=\"master-transporter-template.xlsx\""
    );
    await workbook.xlsx.write(res);
    res.end();
    return;
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  listTransporters,
  createTransporter,
  updateTransporter,
  deleteTransporter,
  importTransporters,
  downloadTemplate,
};
