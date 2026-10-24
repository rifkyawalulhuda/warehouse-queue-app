const ExcelJS = require("exceljs");
const dailyJobActivityService = require("../services/dailyJobActivity.service");
const { sendSuccess } = require("../utils/response");

const COLOR_HEADER_MAIN = "FFB4C6E7";
const COLOR_HEADER_PICKING = "FFFFFF00";
const COLOR_HEADER_STUFFING = "FF33CC33";
const THIN_BORDER = {
  top: { style: "thin", color: { argb: "FF000000" } },
  left: { style: "thin", color: { argb: "FF000000" } },
  bottom: { style: "thin", color: { argb: "FF000000" } },
  right: { style: "thin", color: { argb: "FF000000" } }
};

const COLUMN_WIDTHS = [18, 12, 14, 7, 7, 7, 7, 7, 10, 10, 10, 10, 42];

function resolveActor(req) {
  const user = req.user || {};
  return { id: user.sub || null, role: user.role || null, name: user.name || null };
}

function formatDateId(value) {
  if (!value) return "-";
  const parts = String(value).split("-");
  if (parts.length !== 3) return String(value);
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function applyBorderToRange(worksheet, fromRow, toRow, fromCol, toCol) {
  for (let row = fromRow; row <= toRow; row += 1) {
    for (let col = fromCol; col <= toCol; col += 1) {
      worksheet.getCell(row, col).border = THIN_BORDER;
    }
  }
}

function styleHeaderBlock(worksheet, fromRow, toRow, fromCol, toCol, argb) {
  for (let row = fromRow; row <= toRow; row += 1) {
    for (let col = fromCol; col <= toCol; col += 1) {
      const cell = worksheet.getCell(row, col);
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb } };
      cell.font = { bold: true };
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cell.border = THIN_BORDER;
    }
  }
}

function writeTextCell(cell, value, options = {}) {
  if (value === null || value === undefined || value === "") {
    cell.value = null;
  } else if (options.numeric && /^\d+$/.test(String(value).trim())) {
    cell.value = Number(String(value).trim());
  } else {
    cell.value = String(value);
  }
  if (options.bold) cell.font = { ...(cell.font || {}), bold: true };
  if (options.align) cell.alignment = { horizontal: options.align, vertical: "middle" };
  cell.border = THIN_BORDER;
}

function writeQtyCell(cell, value) {
  const num = Number(value);
  cell.border = THIN_BORDER;
  cell.alignment = { horizontal: "center", vertical: "middle" };
  if (!Number.isFinite(num) || num <= 0) {
    cell.value = null;
    return;
  }
  cell.value = num;
  cell.font = { bold: true };
}

function writeCheckCell(cell, checked) {
  cell.border = THIN_BORDER;
  cell.alignment = { horizontal: "center", vertical: "middle" };
  cell.value = checked ? "✓" : null;
  if (checked) cell.font = { bold: true, size: 12 };
}

function writeEmptyRow(worksheet, rowNumber, fromCol, toCol) {
  for (let col = fromCol; col <= toCol; col += 1) {
    const cell = worksheet.getCell(rowNumber, col);
    cell.value = null;
    cell.border = THIN_BORDER;
  }
}

function buildSummarySection(worksheet, report) {
  const dateCell = worksheet.getCell("A1");
  dateCell.value = `DATE : ${formatDateId(report.activityDate)}`;
  dateCell.font = { bold: true, underline: true, size: 12 };
  worksheet.mergeCells("A1:C1");

  if (report.status === "BATAL") {
    const bannerCell = worksheet.getCell("E1");
    bannerCell.value = "BATAL";
    bannerCell.font = { bold: true, size: 14, color: { argb: "FF9C0006" } };
    bannerCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFC7CE" } };
    bannerCell.alignment = { horizontal: "center", vertical: "middle" };
    bannerCell.border = THIN_BORDER;
    worksheet.mergeCells("E1:H1");
  }

  const leftTitle = worksheet.getCell("A3");
  leftTitle.value = "RECEIVING";
  leftTitle.font = { bold: true, underline: true };

  const rightTitle = worksheet.getCell("F3");
  rightTitle.value = "DELIVERY";
  rightTitle.font = { bold: true, underline: true };

  const rows = [
    ["A4", "B4", "CDD / CDE", report.summary.recCddCde, "F4", "G4", "CDD / CDE", report.summary.delCddCde],
    ["A5", "B5", "WINGBOX", report.summary.recWingbox, "F5", "G5", "WINGBOX / OTHER", report.summary.delWingboxOther],
    ["A6", "B6", "CONTAINER", report.summary.recContainer, "F6", "G6", "CONTAINER", report.summary.delContainer]
  ];

  rows.forEach(([lCell, vCell, lText, vText, rlCell, rvCell, rlText, rvText]) => {
    worksheet.getCell(lCell).value = lText;
    writeTextCell(worksheet.getCell(vCell), vText, { numeric: true, bold: true, align: "center" });
    worksheet.getCell(rlCell).value = rlText;
    writeTextCell(worksheet.getCell(rvCell), rvText, { numeric: true, bold: true, align: "center" });
  });
}

function writeManpowerRow(worksheet, row, session) {
  const start = 1;
  if (!session) {
    writeEmptyRow(worksheet, row, start, 13);
    return;
  }
  writeTextCell(worksheet.getCell(row, 1), session.employeeName, { bold: true });
  writeTextCell(worksheet.getCell(row, 2), session.jobRole, { align: "center" });
  writeTextCell(worksheet.getCell(row, 3), session.activityType, { align: "center" });
  writeQtyCell(worksheet.getCell(row, 4), session.qtyCdd);
  writeQtyCell(worksheet.getCell(row, 5), session.qtyWb);
  writeQtyCell(worksheet.getCell(row, 6), session.qtyFuso);
  writeQtyCell(worksheet.getCell(row, 7), session.qty20ft);
  writeQtyCell(worksheet.getCell(row, 8), session.qty40ft);
  writeTextCell(worksheet.getCell(row, 9), session.timeStart, { align: "center" });
  writeTextCell(worksheet.getCell(row, 10), session.timeFinish, { align: "center" });
  writeCheckCell(worksheet.getCell(row, 11), session.isPending);
  writeCheckCell(worksheet.getCell(row, 12), session.isFinish);
  writeTextCell(worksheet.getCell(row, 13), session.confirmation);
}

function buildManpowerTable(worksheet, report, startRow) {
  const headerRow1 = startRow;
  const headerRow2 = startRow + 1;

  [
    ["A", "Man Power"],
    ["B", "Job Activity"],
    ["D", "Truck Type"],
    ["I", "Time Work"],
    ["K", "Actual Progress"],
    ["M", "Confirmation"]
  ].forEach(([column, label]) => {
    worksheet.getCell(`${column}${headerRow1}`).value = label;
  });

  worksheet.mergeCells(`A${headerRow1}:A${headerRow2}`);
  worksheet.mergeCells(`B${headerRow1}:C${headerRow2}`);
  worksheet.mergeCells(`D${headerRow1}:H${headerRow1}`);
  worksheet.mergeCells(`I${headerRow1}:J${headerRow1}`);
  worksheet.mergeCells(`K${headerRow1}:L${headerRow1}`);
  worksheet.mergeCells(`M${headerRow1}:M${headerRow2}`);

  [
    ["D", "CDD"],
    ["E", "WB"],
    ["F", "Fuso"],
    ["G", "20ft"],
    ["H", "40ft"],
    ["I", "Start"],
    ["J", "Finish"],
    ["K", "Pending"],
    ["L", "Finish"]
  ].forEach(([column, label]) => {
    worksheet.getCell(`${column}${headerRow2}`).value = label;
  });

  styleHeaderBlock(worksheet, headerRow1, headerRow2, 1, 13, COLOR_HEADER_MAIN);

  let row = headerRow2 + 1;
  if (report.groups.length === 0) {
    writeEmptyRow(worksheet, row, 1, 13);
    return row + 1;
  }

  report.groups.forEach((group, index) => {
    if (index > 0) {
      writeEmptyRow(worksheet, row, 1, 13);
      row += 1;
    }
    writeManpowerRow(worksheet, row, group.tally);
    row += 1;
    writeManpowerRow(worksheet, row, group.operator);
    row += 1;
  });

  return row;
}

function buildSimpleTable(worksheet, startRow, options) {
  const { titlePrefix, rows, headerColor } = options;
  const headerRow1 = startRow;
  const headerRow2 = startRow + 1;

  worksheet.getCell(`A${headerRow1}`).value = `TOTAL ${titlePrefix}`;
  worksheet.getCell(`D${headerRow1}`).value = "TOTAL MEMBER";
  worksheet.getCell(`F${headerRow1}`).value = "TIME WORK";
  worksheet.getCell(`I${headerRow1}`).value = "ACTUAL PROGRESS";
  worksheet.getCell(`M${headerRow1}`).value = "CONFIRMATION";

  worksheet.mergeCells(`A${headerRow1}:C${headerRow2}`);
  worksheet.mergeCells(`D${headerRow1}:E${headerRow2}`);
  worksheet.mergeCells(`F${headerRow1}:H${headerRow2}`);
  worksheet.mergeCells(`I${headerRow1}:L${headerRow1}`);
  worksheet.mergeCells(`M${headerRow1}:M${headerRow2}`);

  worksheet.getCell(`I${headerRow2}`).value = "PENDING";
  worksheet.getCell(`K${headerRow2}`).value = "FINISH";
  worksheet.mergeCells(`I${headerRow2}:J${headerRow2}`);
  worksheet.mergeCells(`K${headerRow2}:L${headerRow2}`);

  styleHeaderBlock(worksheet, headerRow1, headerRow2, 1, 13, headerColor);

  let row = headerRow2 + 1;

  rows.forEach((item) => {
    writeTextCell(worksheet.getCell(row, 1), item.total, { align: "center" });
    worksheet.mergeCells(`A${row}:C${row}`);
    writeTextCell(worksheet.getCell(row, 4), item.totalMember, { align: "center", numeric: true });
    worksheet.mergeCells(`D${row}:E${row}`);
    writeTextCell(worksheet.getCell(row, 6), item.timeWork, { align: "center" });
    worksheet.mergeCells(`F${row}:H${row}`);
    writeCheckCell(worksheet.getCell(row, 9), item.isPending);
    worksheet.mergeCells(`I${row}:J${row}`);
    writeCheckCell(worksheet.getCell(row, 11), item.isFinish);
    worksheet.mergeCells(`K${row}:L${row}`);
    writeTextCell(worksheet.getCell(row, 13), item.confirmation);
    row += 1;
  });

  writeEmptyRow(worksheet, row, 1, 13);
  row += 1;

  return row;
}

function buildWorkbook(report) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Warehouse Queue App";
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet("Daily Job Activity", {
    pageSetup: {
      paperSize: 9,
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 }
    }
  });

  COLUMN_WIDTHS.forEach((width, index) => {
    worksheet.getColumn(index + 1).width = width;
  });

  buildSummarySection(worksheet, report);

  let row = buildManpowerTable(worksheet, report, 8);

  row += 2;
  row = buildSimpleTable(worksheet, row, {
    titlePrefix: "PICKING",
    rows: report.picking,
    headerColor: COLOR_HEADER_PICKING
  });

  row += 2;
  buildSimpleTable(worksheet, row, {
    titlePrefix: "STUFFING",
    rows: report.stuffing,
    headerColor: COLOR_HEADER_STUFFING
  });

  applyBorderToRange(worksheet, 1, 1, 1, 3);

  return workbook;
}

async function listDailyJobActivities(req, res, next) {
  try {
    if (req.query?.date) {
      const report = await dailyJobActivityService.getDailyJobActivityByDate(req.query.date);
      return res.json({ ok: true, data: report, item: report });
    }
    const result = await dailyJobActivityService.listDailyJobActivities(req.query || {});
    return res.json({ ok: true, items: result.items, meta: result.meta });
  } catch (err) {
    return next(err);
  }
}

async function getDailyJobActivityById(req, res, next) {
  try {
    const report = await dailyJobActivityService.getDailyJobActivityById(req.params.id);
    return sendSuccess(res, report);
  } catch (err) {
    return next(err);
  }
}

async function updateDailyJobActivityNotes(req, res, next) {
  try {
    const result = await dailyJobActivityService.updateDailyJobActivityNotes(
      req.params.id,
      req.body?.notes,
      resolveActor(req)
    );
    return sendSuccess(res, result);
  } catch (err) {
    return next(err);
  }
}

async function exportDailyJobActivityExcel(req, res, next) {
  try {
    const report = await dailyJobActivityService.getDailyJobActivityById(req.params.id);
    const workbook = buildWorkbook(report);
    const prefix = report.status === "BATAL" ? "BATAL_" : "";
    const filename = `${prefix}daily-job-activity_${report.activityDate}.xlsx`;

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  listDailyJobActivities,
  getDailyJobActivityById,
  updateDailyJobActivityNotes,
  exportDailyJobActivityExcel
};
