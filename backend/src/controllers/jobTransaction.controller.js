const ExcelJS = require("exceljs");
const jobTransactionService = require("../services/jobTransaction.service");
const { sendSuccess } = require("../utils/response");

const COLOR_HEADER = "FFB4C6E7";
const COLOR_TOTAL = "FFEDEDED";
const COLOR_TITLE = "FFDDEBF7";
const THIN_BORDER = {
  top: { style: "thin", color: { argb: "FF808080" } },
  left: { style: "thin", color: { argb: "FF808080" } },
  bottom: { style: "thin", color: { argb: "FF808080" } },
  right: { style: "thin", color: { argb: "FF808080" } }
};

const ACTIVITY_LABEL = {
  RECEIVING: "Receiving",
  DELIVERY: "Delivery",
  PICKING: "Picking",
  STUFFING: "Stuffing"
};

const STATUS_LABEL = {
  DRAFT: "Draft",
  PROSES: "Proses",
  SELESAI: "Selesai",
  BATAL: "Batal"
};

const STATUS_STYLE = {
  DRAFT: { fill: "FFF2F2F2", font: "FF5F6B76" },
  PROSES: { fill: "FFDCE9FB", font: "FF1D4ED8" },
  SELESAI: { fill: "FFDCF3E4", font: "FF157347" },
  BATAL: { fill: "FFFBE0E0", font: "FFB02A2A" }
};

const TRUCK_LABEL = {
  CDD: "CDD",
  CDE: "CDE",
  WB: "Wingbox",
  FUSO: "Fuso",
  FT20: "20 ft",
  FT40: "40 ft",
  OTHER: "Lainnya"
};

const COLUMNS = [
  { header: "No", width: 6 },
  { header: "Tanggal", width: 12 },
  { header: "Mulai", width: 9 },
  { header: "Selesai", width: 9 },
  { header: "Durasi", width: 11 },
  { header: "Pekerjaan", width: 13 },
  { header: "Peran", width: 11 },
  { header: "Karyawan", width: 24 },
  { header: "Tipe Truk", width: 13 },
  { header: "Qty Truk", width: 10 },
  { header: "Total Member", width: 13 },
  { header: "Total DO", width: 10 },
  { header: "Status", width: 11 },
  { header: "Konfirmasi", width: 34 },
  { header: "Alasan Batal", width: 30 }
];

const MANPOWER_ACTIVITIES = ["RECEIVING", "DELIVERY"];

function formatDateId(value) {
  if (!value) return "-";
  const parts = String(value).split("-");
  if (parts.length !== 3) return String(value);
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function formatWallClockTime(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const pad = (num) => String(num).padStart(2, "0");
  return `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
}

function durationMinutes(startAt, finishAt) {
  if (!startAt) return null;
  const start = new Date(startAt);
  const end = finishAt ? new Date(finishAt) : null;
  if (Number.isNaN(start.getTime())) return null;
  if (!end || Number.isNaN(end.getTime())) return null;
  const diff = Math.round((end.getTime() - start.getTime()) / 60000);
  return diff > 0 ? diff : null;
}

function durationLabel(minutes) {
  if (!minutes) return null;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest}m`;
  return rest === 0 ? `${hours}j` : `${hours}j ${rest}m`;
}

function truckLabel(row) {
  if (!row.truckType) return null;
  if (row.truckType === "OTHER") {
    return row.truckTypeOther ? `Lainnya · ${row.truckTypeOther}` : "Lainnya";
  }
  return TRUCK_LABEL[row.truckType] || row.truckType;
}

function describeFilters(query, itemCount) {
  const parts = [];
  const from = query?.dateFrom || query?.dateTo;
  const to = query?.dateTo || query?.dateFrom;
  parts.push(
    from && to
      ? `Periode: ${formatDateId(from)} – ${formatDateId(to)}`
      : "Periode: semua tanggal"
  );

  const status = String(query?.status || "ALL").toUpperCase();
  parts.push(`Status: ${status === "ALL" ? "Semua" : STATUS_LABEL[status] || status}`);

  const activity = String(query?.activityType || "ALL").toUpperCase();
  parts.push(
    `Pekerjaan: ${activity === "ALL" ? "Semua" : ACTIVITY_LABEL[activity] || activity}`
  );

  const search = String(query?.search || "").trim();
  if (search) parts.push(`Pencarian: "${search}"`);

  parts.push(`${itemCount} transaksi`);
  return parts.join("  ·  ");
}

function styleRange(worksheet, fromRow, toRow, fromCol, toCol, options = {}) {
  for (let row = fromRow; row <= toRow; row += 1) {
    for (let col = fromCol; col <= toCol; col += 1) {
      const cell = worksheet.getCell(row, col);
      if (options.fill) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: options.fill } };
      }
      if (options.border !== false) cell.border = THIN_BORDER;
    }
  }
}

function buildWorkbook(result, query) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Warehouse Queue App";
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet("Transaksi Pekerjaan", {
    pageSetup: {
      paperSize: 9,
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 }
    },
    views: [{ state: "frozen", ySplit: 6 }]
  });

  COLUMNS.forEach((column, index) => {
    worksheet.getColumn(index + 1).width = column.width;
  });

  const lastCol = COLUMNS.length;

  worksheet.mergeCells(1, 1, 1, lastCol);
  const titleCell = worksheet.getCell(1, 1);
  titleCell.value = "LAPORAN TRANSAKSI PEKERJAAN";
  titleCell.font = { bold: true, size: 14 };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_TITLE } };
  worksheet.getRow(1).height = 24;

  worksheet.mergeCells(2, 1, 2, lastCol);
  const metaCell = worksheet.getCell(2, 1);
  metaCell.value = describeFilters(query, result.items.length);
  metaCell.font = { size: 10, color: { argb: "FF444444" } };
  metaCell.alignment = { horizontal: "center", vertical: "middle" };

  if (result.truncated) {
    worksheet.mergeCells(3, 1, 3, lastCol);
    const warnCell = worksheet.getCell(3, 1);
    warnCell.value = `Data dibatasi ${result.limit} baris pertama. Persempit rentang tanggal untuk export lengkap.`;
    warnCell.font = { size: 10, bold: true, color: { argb: "FFB02A2A" } };
    warnCell.alignment = { horizontal: "center", vertical: "middle" };
  }

  const headerRow = 6;
  COLUMNS.forEach((column, index) => {
    const cell = worksheet.getCell(headerRow, index + 1);
    cell.value = column.header;
    cell.font = { bold: true };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  });
  styleRange(worksheet, headerRow, headerRow, 1, lastCol, { fill: COLOR_HEADER });
  worksheet.getRow(headerRow).height = 30;

  let row = headerRow + 1;
  let totalQty = 0;
  let totalMember = 0;
  let totalDo = 0;

  result.items.forEach((item, index) => {
    const isManpower = MANPOWER_ACTIVITIES.includes(item.activityType);
    const minutes = durationMinutes(item.startAt, item.finishAt);
    const qty = isManpower ? Number(item.qty) || 0 : 0;
    const member = Number(item.totalMember) || 0;
    const doCount = Number(item.totalDo) || 0;
    totalQty += qty;
    totalMember += member;
    totalDo += doCount;

    const values = [
      index + 1,
      formatDateId(item.transactionDate),
      formatWallClockTime(item.startAt),
      formatWallClockTime(item.finishAt),
      durationLabel(minutes),
      ACTIVITY_LABEL[item.activityType] || item.activityType,
      item.jobRole || null,
      isManpower ? item.employeeName : null,
      isManpower ? truckLabel(item) : null,
      isManpower ? qty : null,
      isManpower ? null : member || null,
      isManpower ? null : doCount || null,
      STATUS_LABEL[item.status] || item.status,
      item.confirmation || null,
      item.cancelReason || null
    ];

    values.forEach((value, colIndex) => {
      const cell = worksheet.getCell(row, colIndex + 1);
      cell.value = value === "" ? null : value;
      cell.border = THIN_BORDER;
      cell.alignment = { vertical: "middle" };
    });

    worksheet.getCell(row, 1).alignment = { horizontal: "center", vertical: "middle" };
    worksheet.getCell(row, 2).alignment = { horizontal: "center", vertical: "middle" };
    worksheet.getCell(row, 3).alignment = { horizontal: "center", vertical: "middle" };
    worksheet.getCell(row, 4).alignment = { horizontal: "center", vertical: "middle" };
    worksheet.getCell(row, 5).alignment = { horizontal: "center", vertical: "middle" };
    worksheet.getCell(row, 7).alignment = { horizontal: "center", vertical: "middle" };
    [10, 11, 12].forEach((colIndex) => {
      worksheet.getCell(row, colIndex).alignment = { horizontal: "center", vertical: "middle" };
    });
    [14, 15].forEach((colIndex) => {
      worksheet.getCell(row, colIndex).alignment = { vertical: "middle", wrapText: true };
    });

    const statusCell = worksheet.getCell(row, 13);
    const statusStyle = STATUS_STYLE[item.status];
    if (statusStyle) {
      statusCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: statusStyle.fill } };
      statusCell.font = { bold: true, color: { argb: statusStyle.font } };
      statusCell.alignment = { horizontal: "center", vertical: "middle" };
    }

    row += 1;
  });

  if (result.items.length > 0) {
    const totalRow = row;
    worksheet.mergeCells(totalRow, 1, totalRow, 9);
    const labelCell = worksheet.getCell(totalRow, 1);
    labelCell.value = `TOTAL (${result.items.length} transaksi)`;
    labelCell.font = { bold: true };
    labelCell.alignment = { horizontal: "right", vertical: "middle" };

    worksheet.getCell(totalRow, 10).value = totalQty || null;
    worksheet.getCell(totalRow, 11).value = totalMember || null;
    worksheet.getCell(totalRow, 12).value = totalDo || null;

    styleRange(worksheet, totalRow, totalRow, 1, lastCol, { fill: COLOR_TOTAL });
    [10, 11, 12].forEach((colIndex) => {
      const cell = worksheet.getCell(totalRow, colIndex);
      cell.font = { bold: true };
      cell.alignment = { horizontal: "center", vertical: "middle" };
    });
  } else {
    worksheet.mergeCells(row, 1, row, lastCol);
    const emptyCell = worksheet.getCell(row, 1);
    emptyCell.value = "Tidak ada transaksi pada filter tersebut.";
    emptyCell.alignment = { horizontal: "center", vertical: "middle" };
    emptyCell.font = { italic: true, color: { argb: "FF777777" } };
    styleRange(worksheet, row, row, 1, lastCol);
  }

  worksheet.autoFilter = {
    from: { row: headerRow, column: 1 },
    to: { row: headerRow, column: lastCol }
  };

  worksheet.headerFooter.oddFooter = "&LWarehouse Queue App&RHalaman &P dari &N";

  return workbook;
}

function buildExportFilename(query) {
  const from = query?.dateFrom || query?.dateTo;
  const to = query?.dateTo || query?.dateFrom;
  if (from && to) return `transaksi-pekerjaan_${from}_sampai_${to}.xlsx`;
  return "transaksi-pekerjaan.xlsx";
}

function resolveActor(req) {
  const user = req.user || {};
  return { id: user.sub || null, role: user.role || null, name: user.name || null };
}

async function listJobTransactions(req, res, next) {
  try {
    const result = await jobTransactionService.listJobTransactions(req.query || {});
    return res.json({ ok: true, items: result.items, meta: result.meta });
  } catch (err) {
    return next(err);
  }
}

async function getJobTransactionById(req, res, next) {
  try {
    const item = await jobTransactionService.getJobTransactionById(req.params.id);
    return sendSuccess(res, item);
  } catch (err) {
    return next(err);
  }
}

async function createJobTransaction(req, res, next) {
  try {
    const item = await jobTransactionService.createJobTransaction(req.body, resolveActor(req));
    return sendSuccess(res, item);
  } catch (err) {
    return next(err);
  }
}

async function updateJobTransaction(req, res, next) {
  try {
    const item = await jobTransactionService.updateJobTransaction(
      req.params.id,
      req.body,
      resolveActor(req)
    );
    return sendSuccess(res, item);
  } catch (err) {
    return next(err);
  }
}

async function startJobTransaction(req, res, next) {
  try {
    const item = await jobTransactionService.startJobTransaction(
      req.params.id,
      req.body,
      resolveActor(req)
    );
    return sendSuccess(res, item);
  } catch (err) {
    return next(err);
  }
}

async function finishJobTransaction(req, res, next) {
  try {
    const item = await jobTransactionService.finishJobTransaction(
      req.params.id,
      req.body,
      resolveActor(req)
    );
    return sendSuccess(res, item);
  } catch (err) {
    return next(err);
  }
}

async function reopenJobTransaction(req, res, next) {
  try {
    const item = await jobTransactionService.reopenJobTransaction(
      req.params.id,
      resolveActor(req)
    );
    return sendSuccess(res, item);
  } catch (err) {
    return next(err);
  }
}

async function cancelJobTransaction(req, res, next) {
  try {
    const item = await jobTransactionService.cancelJobTransaction(
      req.params.id,
      req.body?.reason,
      resolveActor(req)
    );
    return sendSuccess(res, item);
  } catch (err) {
    return next(err);
  }
}

async function deleteJobTransaction(req, res, next) {
  try {
    const result = await jobTransactionService.deleteJobTransaction(
      req.params.id,
      resolveActor(req)
    );
    return sendSuccess(res, result);
  } catch (err) {
    return next(err);
  }
}

async function exportJobTransactions(req, res, next) {
  try {
    const query = req.query || {};
    const result = await jobTransactionService.listJobTransactionsForExport(query);
    const workbook = buildWorkbook(result, query);
    const filename = buildExportFilename(query);

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("X-Export-Row-Count", String(result.items.length));
    res.setHeader("X-Export-Truncated", result.truncated ? "1" : "0");
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  listJobTransactions,
  exportJobTransactions,
  getJobTransactionById,
  createJobTransaction,
  updateJobTransaction,
  startJobTransaction,
  finishJobTransaction,
  reopenJobTransaction,
  cancelJobTransaction,
  deleteJobTransaction
};
