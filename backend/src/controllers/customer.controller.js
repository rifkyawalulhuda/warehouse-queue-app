const customerService = require("../services/customer.service");
const xlsx = require("xlsx");
const { sendSuccess } = require("../utils/response");

async function listCustomers(req, res, next) {
  try {
    const customers = await customerService.listCustomers();
    return sendSuccess(res, customers);
  } catch (err) {
    return next(err);
  }
}

async function createCustomer(req, res, next) {
  try {
    const customer = await customerService.createCustomer(req.body);
    return sendSuccess(res, customer);
  } catch (err) {
    return next(err);
  }
}

async function deleteCustomer(req, res, next) {
  try {
    const deleted = await customerService.deleteCustomer(req.params.id);
    return sendSuccess(res, deleted);
  } catch (err) {
    return next(err);
  }
}

async function importCustomers(req, res, next) {
  try {
    if (!req.file || !req.file.buffer) {
      const err = new Error("File Excel wajib diupload");
      err.status = 400;
      throw err;
    }
    const workbook = xlsx.read(req.file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json(sheet, { defval: "" });

    const result = await customerService.importCustomersFromExcel(rows);
    return sendSuccess(res, result);
  } catch (err) {
    return next(err);
  }
}

function downloadTemplate(req, res, next) {
  try {
    const workbook = xlsx.utils.book_new();
    const sheet = xlsx.utils.aoa_to_sheet([["Nama Customer"], ["Contoh Customer"]]);
    xlsx.utils.book_append_sheet(workbook, sheet, "Customers");
    const buffer = xlsx.write(workbook, { type: "buffer", bookType: "xlsx" });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", "attachment; filename=\"customer-import-template.xlsx\"");
    return res.send(buffer);
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  listCustomers,
  createCustomer,
  deleteCustomer,
  importCustomers,
  downloadTemplate,
};
