const gateService = require("../services/gate.service");
const xlsx = require("xlsx");
const ExcelJS = require("exceljs");
const { sendSuccess } = require("../utils/response");

function normalizeHeader(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function ensureGateHeader(rows) {
  if (!rows.length) {
    const err = new Error("Header Excel tidak ditemukan");
    err.status = 400;
    throw err;
  }
  const headers = rows[0].map(normalizeHeader);
  const gateNoIdx = headers.indexOf("gate no");
  const areaIdx = headers.indexOf("area");
  const warehouseIdx = headers.indexOf("warehouse");

  if (gateNoIdx === -1 || areaIdx === -1 || warehouseIdx === -1) {
    const err = new Error("Header Excel tidak sesuai. Wajib: Gate No, Area, Warehouse");
    err.status = 400;
    throw err;
  }

  return { gateNoIdx, areaIdx, warehouseIdx };
}

async function listGates(req, res, next) {
  try {
    const gates = await gateService.listGates(req.query);
    return sendSuccess(res, gates);
  } catch (err) {
    return next(err);
  }
}

async function createGate(req, res, next) {
  try {
    const gate = await gateService.createGate(req.body);
    return sendSuccess(res, gate);
  } catch (err) {
    return next(err);
  }
}

async function updateGate(req, res, next) {
  try {
    const gate = await gateService.updateGate(req.params.id, req.body);
    return sendSuccess(res, gate);
  } catch (err) {
    return next(err);
  }
}

async function deleteGate(req, res, next) {
  try {
    const deleted = await gateService.deleteGate(req.params.id);
    return sendSuccess(res, deleted);
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  listGates,
  createGate,
  updateGate,
  deleteGate,
  listMasterGates: listGates,
  downloadTemplate: async function downloadTemplate(req, res, next) {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Master Gate");
      const referenceSheet = workbook.addWorksheet("Referensi Warehouse");
      const warehouseOptions = ["WH1", "WH2", "DG"];

      worksheet.columns = [
        { header: "Gate No", key: "gateNo", width: 12 },
        { header: "Area", key: "area", width: 20 },
        { header: "Warehouse", key: "warehouse", width: 12 },
      ];
      worksheet.getRow(1).font = { bold: true };
      worksheet.addRow({ gateNo: "G1", area: "Area A", warehouse: "WH1" });
      worksheet.addRow({ gateNo: "G2", area: "Area B", warehouse: "DG" });

      referenceSheet.columns = [{ header: "Warehouse", key: "warehouse", width: 12 }];
      referenceSheet.getRow(1).font = { bold: true };
      warehouseOptions.forEach((warehouse) => {
        referenceSheet.addRow({ warehouse });
      });
      referenceSheet.state = "hidden";

      const listStart = 2;
      const listEnd = warehouseOptions.length + 1;
      for (let row = 2; row <= 1000; row += 1) {
        worksheet.getCell(`C${row}`).dataValidation = {
          type: "list",
          allowBlank: true,
          formulae: [`'Referensi Warehouse'!$A$${listStart}:$A$${listEnd}`],
          showErrorMessage: true,
          errorTitle: "Warehouse tidak valid",
          error: "Pilih Warehouse dari dropdown (WH1, WH2, DG)",
        };
      }

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader("Content-Disposition", "attachment; filename=\"master-gate-template.xlsx\"");
      await workbook.xlsx.write(res);
      res.end();
      return;
    } catch (err) {
      return next(err);
    }
  },
  importGates: async function importGates(req, res, next) {
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

      const { gateNoIdx, areaIdx, warehouseIdx } = ensureGateHeader(rows);

      const dataRows = rows.slice(1).map((row, idx) => ({
        rowNumber: idx + 2,
        gateNo: row[gateNoIdx],
        area: row[areaIdx],
        warehouse: row[warehouseIdx],
      }));

      const result = await gateService.importGatesFromExcel(dataRows);
      return sendSuccess(res, result);
    } catch (err) {
      return next(err);
    }
  },
  exportGates: async function exportGates(req, res, next) {
    try {
      const gates = await gateService.listGatesForExport();
      const rows = [
        ["Gate No", "Area", "Warehouse", "Created At"],
        ...gates.map((gate) => [
          gate.gateNo,
          gate.area,
          gate.warehouse,
          gate.createdAt ? new Date(gate.createdAt).toISOString() : "",
        ]),
      ];

      const sheet = xlsx.utils.aoa_to_sheet(rows);
      sheet["!cols"] = [{ wch: 12 }, { wch: 20 }, { wch: 12 }, { wch: 24 }];
      if (sheet["A1"]) sheet["A1"].s = { font: { bold: true } };
      if (sheet["B1"]) sheet["B1"].s = { font: { bold: true } };
      if (sheet["C1"]) sheet["C1"].s = { font: { bold: true } };
      if (sheet["D1"]) sheet["D1"].s = { font: { bold: true } };

      const workbook = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(workbook, sheet, "Master Gate");
      const buffer = xlsx.write(workbook, { type: "buffer", bookType: "xlsx" });

      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, "0");
      const dd = String(today.getDate()).padStart(2, "0");
      const fileName = `master-gate_${yyyy}-${mm}-${dd}.xlsx`;

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader("Content-Disposition", `attachment; filename=\"${fileName}\"`);
      return res.send(buffer);
    } catch (err) {
      return next(err);
    }
  },
};
