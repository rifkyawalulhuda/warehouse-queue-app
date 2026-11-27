const scheduleService = require("../services/schedule.service");
const adminUserService = require("../services/adminUser.service");
const exportService = require("../services/export.service");
const { resolveExportScope } = require("../utils/exportScope");
const { sendSuccess } = require("../utils/response");

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

async function listAvailableItems(req, res, next) {  try {
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
};
