const queueService = require("../services/queue.service");
const adminUserService = require("../services/adminUser.service");
const exportService = require("../services/export.service");
const { resolveExportScope } = require("../utils/exportScope");
const { sendSuccess } = require("../utils/response");

async function createQueue(req, res, next) {
  try {
    const actorUser = req.user?.sub ? await adminUserService.getAdminUserById(req.user.sub) : null;
    const entry = await queueService.createQueueEntry(req.body, actorUser);
    return sendSuccess(res, entry);
  } catch (err) {
    return next(err);
  }
}

async function listQueue(req, res, next) {
  try {
    const result = await queueService.listQueueEntries(req.query);
    return res.json({ ok: true, data: result.data, meta: result.meta });
  } catch (err) {
    return next(err);
  }
}

async function getQueueById(req, res, next) {
  try {
    const entry = await queueService.getQueueEntryById(req.params.id);
    return sendSuccess(res, entry);
  } catch (err) {
    return next(err);
  }
}

async function updateQueue(req, res, next) {
  try {
    const actorUser = req.user?.sub ? await adminUserService.getAdminUserById(req.user.sub) : null;
    const entry = await queueService.updateQueueEntry(req.params.id, req.body, actorUser);
    return sendSuccess(res, entry);
  } catch (err) {
    return next(err);
  }
}

async function updateQueueWhNotes(req, res, next) {
  try {
    const actorUser = req.user?.sub ? await adminUserService.getAdminUserById(req.user.sub) : null;
    const entry = await queueService.updateQueueWhNotes(
      req.params.id,
      req.body?.notesFromWh,
      actorUser
    );
    return sendSuccess(res, entry);
  } catch (err) {
    return next(err);
  }
}

async function updateQueueStatus(req, res, next) {
  try {
    const actorUser = req.user?.sub ? await adminUserService.getAdminUserById(req.user.sub) : null;
    const entry = await queueService.changeQueueStatus(
      req.params.id,
      req.body.newStatus,
      actorUser,
      req.body.gateId,
      req.body.reason,
      req.body.pickerEmployeeId,
      req.body.loadingType
    );
    return sendSuccess(res, entry);
  } catch (err) {
    return next(err);
  }
}

async function setInWh(req, res, next) {
  try {
    const actorUser = req.user?.sub ? await adminUserService.getAdminUserById(req.user.sub) : null;
    const entry = await queueService.changeQueueStatus(
      req.params.id,
      "IN_WH",
      actorUser,
      req.body.gateId
    );
    return sendSuccess(res, entry);
  } catch (err) {
    return next(err);
  }
}

async function exportQueue(req, res, next) {
  try {
    const scope = resolveExportScope(req.query);
    const { workbook, fileName } = await exportService.buildWorkbookFor("QUEUE", scope);

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

async function displayQueue(req, res, next) {
  try {
    const payload = await queueService.listQueueEntriesForDisplay();
    return sendSuccess(res, payload);
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  createQueue,
  listQueue,
  getQueueById,
  updateQueue,
  updateQueueWhNotes,
  updateQueueStatus,
  setInWh,
  exportQueue,
  displayQueue,
};
