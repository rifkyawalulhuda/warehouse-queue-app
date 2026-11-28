const ExcelJS = require("exceljs");
const xlsx = require("xlsx");
const scheduleService = require("../services/schedule.service");
const adminUserService = require("../services/adminUser.service");
const exportService = require("../services/export.service");
const { resolveExportScope } = require("../utils/exportScope");
const { sendSuccess } = require("../utils/response");

function normalizeHeader(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

const IMPORT_COLUMNS = [
  { header: "tanggal", keys: ["tanggal", "date", "tanggal schedule"] },
  { header: "kategori", keys: ["kategori", "category", "kategori (receiving/delivery)"] },
  { header: "customer", keys: ["customer", "customer name", "nama customer"] },
  { header: "plat", keys: ["plat", "plat nomor", "no truck", "nomor truk", "plat truck"] },
  { header: "tipe truk", keys: ["tipe truk", "truck type", "tipe truck"] },
  { header: "tipe lain", keys: ["tipe lain", "truck type other", "tipe lainnya"] },
  { header: "transporter", keys: ["transporter", "nama transporter"] },
  { header: "driver", keys: ["driver", "nama driver"] },
  { header: "no container", keys: ["no container", "container", "nomor container"] },
  { header: "estimasi start", keys: ["estimasi start", "start", "jam start", "planned start"] },
  { header: "estimasi finish", keys: ["estimasi finish", "finish", "jam finish", "planned finish"] },
];

function ensureScheduleHeader(rows) {
  if (!rows.length) {
    const err = new Error("Header Excel tidak ditemukan");
    err.status = 400;
    throw err;
  }

  const headers = rows[0].map(normalizeHeader);
  const indexes = {};
  for (const column of IMPORT_COLUMNS) {
    indexes[column.header] = headers.findIndex((h) => column.keys.includes(h));
  }

  const required = ["tanggal", "kategori", "customer", "plat", "tipe truk", "estimasi start", "estimasi finish"];
  const missing = required.filter((key) => indexes[key] === -1);
  if (missing.length > 0) {
    const err = new Error(
      `Header Excel tidak sesuai. Kolom tidak ditemukan: ${missing
        .map((key) => IMPORT_COLUMNS.find((c) => c.header === key).header)
        .join(", ")}`
    );
    err.status = 400;
    throw err;
  }

  return indexes;
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
    const scope = resolveExportScope(req.query);
    const { workbook, fileName } = await exportService.buildWorkbookFor("SCHEDULE", scope);

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

async function printSummary(req, res, next) {
  try {
    const result = await scheduleService.listSchedulesForPrint(req.query);
    return sendSuccess(res, {
      date: req.query.date || null,
      storeType: req.query.storeType || null,
      search: req.query.search || "",
      columns: result.columns,
      rows: result.data,
    });
  } catch (err) {
    return next(err);
  }
}

async function listAvailableItems(req, res, next) {
  try {
    const items = await scheduleService.listAvailableItems(req.query);
    return sendSuccess(res, items);
  } catch (err) {
    return next(err);
  }
}

async function closeNoShow(req, res, next) {
  try {
    const actorUser = req.user?.sub ? await adminUserService.getAdminUserById(req.user.sub) : null;
    const data = await scheduleService.closeNoShowItem(req.params.id, actorUser);
    return sendSuccess(res, data);
  } catch (err) {
    return next(err);
  }
}

async function importSchedules(req, res, next) {
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

    // cellDates: false -> sel tanggal tetap berupa serial angka Excel. Kalau
    // diubah menjadi Date oleh SheetJS, pembulatan internalnya bisa menghasilkan
    // 23:59:56 hari sebelumnya (mis. 2027-04-01 terbaca 2027-03-31), sehingga
    // jadwal bergeser satu hari. Serial angka dibaca tepat di parseImportDate.
    const workbook = xlsx.read(req.file.buffer, { type: "buffer", cellDates: false });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: true });

    const indexes = ensureScheduleHeader(rows);

    const dataRows = rows
      .slice(1)
      .map((row, idx) => ({
        rowNumber: idx + 2,
        date: indexes["tanggal"] === -1 ? "" : row[indexes["tanggal"]],
        category: indexes["kategori"] === -1 ? "" : row[indexes["kategori"]],
        customer: indexes["customer"] === -1 ? "" : row[indexes["customer"]],
        plate: indexes["plat"] === -1 ? "" : row[indexes["plat"]],
        truckType: indexes["tipe truk"] === -1 ? "" : row[indexes["tipe truk"]],
        truckTypeOther: indexes["tipe lain"] === -1 ? "" : row[indexes["tipe lain"]],
        transporter: indexes["transporter"] === -1 ? "" : row[indexes["transporter"]],
        driver: indexes["driver"] === -1 ? "" : row[indexes["driver"]],
        containers: indexes["no container"] === -1 ? "" : row[indexes["no container"]],
        start: indexes["estimasi start"] === -1 ? "" : row[indexes["estimasi start"]],
        finish: indexes["estimasi finish"] === -1 ? "" : row[indexes["estimasi finish"]],
      }));

    const result = await scheduleService.importSchedulesFromExcel(dataRows, {
      actorUserId: req.user?.sub || null,
      fileName: req.file.originalname || null,
    });
    return sendSuccess(res, result);
  } catch (err) {
    return next(err);
  }
}

async function downloadImportTemplate(req, res, next) {
  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Schedule");
    const referenceSheet = workbook.addWorksheet("Referensi");
    const customerSheet = workbook.addWorksheet("Customer");
    const transporterSheet = workbook.addWorksheet("Transporter");

    const { customers, transporters } = await scheduleService.listTemplateOptions();

    const headers = [
      "Tanggal",
      "Kategori",
      "Customer",
      "Plat",
      "Tipe Truk",
      "Tipe Lain",
      "Transporter",
      "Driver",
      "No Container",
      "Estimasi Start",
      "Estimasi Finish",
    ];

    worksheet.columns = [
      { width: 14 },
      { width: 14 },
      { width: 28 },
      { width: 16 },
      { width: 13 },
      { width: 16 },
      { width: 24 },
      { width: 20 },
      { width: 22 },
      { width: 15 },
      { width: 16 },
    ];

    const headerRow = worksheet.addRow(headers);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE8F5E9" },
    };
    headerRow.alignment = { vertical: "middle", horizontal: "center" };

    // Sampel memakai nama asli dari master supaya lolos validasi dropdown.
    // Kalau master masih kosong, pakai teks penanda yang jelas.
    const sampleCustomer = customers[0] || "Pilih dari daftar";
    const sampleCustomer2 = customers[1] || sampleCustomer;
    // Lewati nama seperti "-" atau "N/A": jelek sebagai contoh di template.
    const sampleTransporter =
      transporters.find((name) => name.trim().length >= 3 && /[a-z]/i.test(name)) || "";

    const samples = [
      ["01-12-2026", "RECEIVING", sampleCustomer, "B 1234 XYZ", "CDD", "", sampleTransporter, "Budi", "TCLU1234567", "08:00", "10:00"],
      ["01-12-2026", "RECEIVING", sampleCustomer, "B 5678 ABC", "FUSO", "", "", "Andi", "", "13:00", "15:30"],
      ["02-12-2026", "DELIVERY", sampleCustomer2, "B 9012 DEF", "WB", "", "", "", "TEMU7654321, TEMU1111111", "23:00", "01:00"],
    ];
    for (const sample of samples) worksheet.addRow(sample);

    // Tanggal dibiarkan sebagai teks supaya "01-12-2026" tidak diubah Excel
    // menjadi sel tanggal menurut locale komputer pengguna (di locale US
    // "01-12-2026" bisa terbaca 12 Januari). Parser import membaca DD-MM-YYYY
    // secara eksplisit, jadi apa yang diketik itulah yang masuk.
    worksheet.getColumn(1).numFmt = "@";
    worksheet.getCell("A1").note = {
      texts: [
        { text: "Format tanggal: DD-MM-YYYY\nContoh: 01-12-2026 (1 Desember 2026)\n\nSel tanggal Excel juga diterima." },
      ],
    };

    // Format kolom jam sebagai teks supaya "08:00" tidak berubah jadi sel waktu.
    worksheet.getColumn(10).numFmt = "@";
    worksheet.getColumn(11).numFmt = "@";

    // Validasi dipasang per rentang, bukan per sel. Per sel membuat ExcelJS
    // mengurutkan alamat sebagai teks (B10 sebelum B2) sehingga menghasilkan
    // dua sqref bertumpuk: B2:B501 dan B10:B501.
    const dataRowEnd = 501;
    const listValidation = (formulae, allowBlank, title, message) => ({
      type: "list",
      allowBlank,
      formulae,
      showErrorMessage: true,
      errorTitle: title,
      error: message,
    });

    worksheet.dataValidations.add(
      `B2:B${dataRowEnd}`,
      listValidation(
        ['"RECEIVING,DELIVERY"'],
        false,
        "Kategori tidak dikenal",
        "Pilih RECEIVING atau DELIVERY."
      )
    );
    worksheet.dataValidations.add(
      `E2:E${dataRowEnd}`,
      listValidation(
        ['"CDD,CDE,FUSO,WB,FT20,FT40,OTHER"'],
        false,
        "Tipe truk tidak dikenal",
        "Pilih salah satu tipe dari daftar."
      )
    );
    if (customers.length > 0) {
      worksheet.dataValidations.add(
        `C2:C${dataRowEnd}`,
        listValidation(
          [`'Customer'!$A$2:$A$${customers.length + 1}`],
          false,
          "Customer tidak ada di Master Customer",
          "Pilih nama customer dari daftar."
        )
      );
    }
    if (transporters.length > 0) {
      worksheet.dataValidations.add(
        `G2:G${dataRowEnd}`,
        listValidation(
          [`'Transporter'!$A$2:$A$${transporters.length + 1}`],
          true,
          "Transporter tidak ada di Master Transporter",
          "Pilih nama transporter dari daftar."
        )
      );
    }

    worksheet.views = [{ state: "frozen", ySplit: 1 }];

    referenceSheet.columns = [{ width: 16 }, { width: 30 }];
    const refHeader = referenceSheet.addRow(["Kode", "Keterangan"]);
    refHeader.font = { bold: true };
    const refRows = [
      ["CDD", "Colt Diesel Double"],
      ["CDE", "Colt Diesel Engkel"],
      ["FUSO", "Fuso"],
      ["WB", "Wing Box"],
      ["FT20", "Container 20 ft"],
      ["FT40", "Container 40 ft"],
      ["OTHER", "Lainnya - isi kolom Tipe Lain"],
      ["RECEIVING", "Barang masuk (STORE_IN)"],
      ["DELIVERY", "Barang keluar (STORE_OUT)"],
      ["Tanggal", "Format DD-MM-YYYY (contoh 01-12-2026)"],
      ["Jam", "Format HH:mm 24 jam (contoh 08:00 atau 13:30)"],
    ];
    for (const ref of refRows) referenceSheet.addRow(ref);
    referenceSheet.addRow([]);
    referenceSheet.addRow([
      "Customer",
      `${customers.length} nama dari Master Customer. Kolom C memakai dropdown dari sheet "Customer".`,
    ]);
    referenceSheet.addRow([
      "Transporter",
      `${transporters.length} transporter aktif dari Master Transporter. Kolom G memakai dropdown dari sheet "Transporter". Boleh dikosongkan.`,
    ]);

    // Sheet sumber dropdown. Disembunyikan supaya tidak mengganggu pengisian,
    // tapi tetap bisa dibuka kalau daftar perlu diperiksa.
    customerSheet.columns = [{ width: 40 }];
    const customerHeader = customerSheet.addRow(["Nama Customer"]);
    customerHeader.font = { bold: true };
    for (const name of customers) customerSheet.addRow([name]);

    transporterSheet.columns = [{ width: 40 }];
    const transporterHeader = transporterSheet.addRow(["Nama Transporter"]);
    transporterHeader.font = { bold: true };
    for (const name of transporters) transporterSheet.addRow([name]);

    // Disembunyikan: hanya berfungsi sebagai sumber dropdown, bukan untuk dibaca.
    // Tetap 'visible' kalau kosong, supaya file tidak error saat master belum diisi.
    customerSheet.state = customers.length > 0 ? "hidden" : "visible";
    transporterSheet.state = transporters.length > 0 ? "hidden" : "visible";

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="schedule-import-template.xlsx"'
    );
    await workbook.xlsx.write(res);
    res.end();
    return;
  } catch (err) {
    return next(err);
  }
}

async function listImportLogs(req, res, next) {
  try {
    const limit = Number(req.query.limit) > 0 ? Math.min(Number(req.query.limit), 100) : 20;
    const logs = await scheduleService.listScheduleImportLogs(limit);
    return sendSuccess(res, logs);
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
  printSummary,
  listAvailableItems,
  closeNoShow,
  importSchedules,
  downloadImportTemplate,
  listImportLogs,
};
