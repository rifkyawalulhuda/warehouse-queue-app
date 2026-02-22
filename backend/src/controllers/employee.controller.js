const xlsx = require("xlsx");
const ExcelJS = require("exceljs");
const employeeService = require("../services/employee.service");
const { sendSuccess } = require("../utils/response");

function normalizeHeader(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function ensureEmployeeHeader(rows) {
  if (!rows.length) {
    const err = new Error("Header Excel tidak ditemukan");
    err.status = 400;
    throw err;
  }

  const headers = rows[0].map(normalizeHeader);
  const nikIdx = headers.indexOf("nik");
  const nameIdx = headers.indexOf("nama");
  const positionIdx = headers.indexOf("jabatan");

  if (nikIdx === -1 || nameIdx === -1 || positionIdx === -1) {
    const err = new Error("Header Excel tidak sesuai. Wajib: NIK, Nama, Jabatan");
    err.status = 400;
    throw err;
  }

  return { nikIdx, nameIdx, positionIdx };
}

async function listEmployees(req, res, next) {
  try {
    const employees = await employeeService.listEmployees();
    return sendSuccess(res, employees);
  } catch (err) {
    return next(err);
  }
}

async function createEmployee(req, res, next) {
  try {
    const employee = await employeeService.createEmployee(req.body);
    return sendSuccess(res, employee);
  } catch (err) {
    return next(err);
  }
}

async function updateEmployee(req, res, next) {
  try {
    const updated = await employeeService.updateEmployee(req.params.id, req.body);
    return sendSuccess(res, updated);
  } catch (err) {
    return next(err);
  }
}

async function deleteEmployee(req, res, next) {
  try {
    const deleted = await employeeService.deleteEmployee(req.params.id);
    return sendSuccess(res, deleted);
  } catch (err) {
    return next(err);
  }
}

async function importEmployees(req, res, next) {
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

    const { nikIdx, nameIdx, positionIdx } = ensureEmployeeHeader(rows);

    const dataRows = rows.slice(1).map((row, idx) => ({
      rowNumber: idx + 2,
      nik: row[nikIdx],
      name: row[nameIdx],
      position: row[positionIdx],
    }));

    const result = await employeeService.importEmployeesFromExcel(dataRows);
    return sendSuccess(res, result);
  } catch (err) {
    return next(err);
  }
}

async function downloadTemplate(req, res, next) {
  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Master Karyawan");
    const referenceSheet = workbook.addWorksheet("Referensi Jabatan");

    const positionOptions = ["Foreman", "Tallyman", "Opr Forklift"];

    worksheet.columns = [
      { header: "NIK", key: "nik", width: 14 },
      { header: "Nama", key: "name", width: 24 },
      { header: "Jabatan", key: "position", width: 18 },
    ];
    worksheet.getRow(1).font = { bold: true };
    worksheet.addRow({ nik: "1234567890", name: "Budi Santoso", position: "Foreman" });
    worksheet.addRow({ nik: "1234567891", name: "Andi Pratama", position: "Tallyman" });
    worksheet.addRow({ nik: "1234567892", name: "Rina Putri", position: "Opr Forklift" });

    referenceSheet.columns = [{ header: "Jabatan", key: "position", width: 18 }];
    referenceSheet.getRow(1).font = { bold: true };
    positionOptions.forEach((position) => {
      referenceSheet.addRow({ position });
    });
    referenceSheet.state = "hidden";

    const listStart = 2;
    const listEnd = positionOptions.length + 1;
    for (let row = 2; row <= 1000; row += 1) {
      worksheet.getCell(`C${row}`).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [`'Referensi Jabatan'!$A$${listStart}:$A$${listEnd}`],
        showErrorMessage: true,
        errorTitle: "Jabatan tidak valid",
        error: "Pilih Jabatan dari dropdown (Foreman, Tallyman, atau Opr Forklift)",
      };
    }

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", "attachment; filename=\"master-karyawan-template.xlsx\"");
    await workbook.xlsx.write(res);
    res.end();
    return;
  } catch (err) {
    return next(err);
  }
}

async function exportEmployees(req, res, next) {
  try {
    const employees = await employeeService.listEmployeesForExport();
    const rows = [
      ["NIK", "Nama", "Jabatan", "Created At"],
      ...employees.map((employee) => [
        employee.nik,
        employee.name,
        employee.position === "FOREMAN"
          ? "Foreman"
          : employee.position === "TALLYMAN"
          ? "Tallyman"
          : "Opr Forklift",
        employee.createdAt ? new Date(employee.createdAt).toISOString() : "",
      ]),
    ];

    const sheet = xlsx.utils.aoa_to_sheet(rows);
    sheet["!cols"] = [{ wch: 14 }, { wch: 24 }, { wch: 18 }, { wch: 24 }];
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, sheet, "Master Karyawan");
    const buffer = xlsx.write(workbook, { type: "buffer", bookType: "xlsx" });

    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    const fileName = `master-karyawan_${yyyy}-${mm}-${dd}.xlsx`;

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename=\"${fileName}\"`);
    return res.send(buffer);
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  listEmployees,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  importEmployees,
  downloadTemplate,
  exportEmployees,
};
