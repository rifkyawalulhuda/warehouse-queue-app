const reportService = require("../services/report.service");
const { buildReportWorkbook } = require("../services/exportBuilders");
const { resolveExportScope } = require("../utils/exportScope");
const { sendSuccess } = require("../utils/response");

async function getReport(req, res, next) {
  try {
    const data = await reportService.buildReport(req.query);
    return sendSuccess(res, data);
  } catch (err) {
    return next(err);
  }
}

async function exportReport(req, res, next) {
  try {
    // R2: isi file export selalu netral — customer, transporter, kategori, dan
    // pengelompokan tidak ikut dari filter halaman. Hanya periode yang dipakai.
    const scope = resolveExportScope(req.query);
    const report = await reportService.buildReport({
      dateFrom: scope.dateFrom,
      dateTo: scope.dateTo,
    });
    const workbook = buildReportWorkbook(report);

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="report_schedule_vs_aktual_${scope.fileToken}.xlsx"`
    );
    await workbook.xlsx.write(res);
    return res.end();
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  getReport,
  exportReport,
};
