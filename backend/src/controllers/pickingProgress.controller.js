const adminUserService = require("../services/adminUser.service");
const pickingProgressService = require("../services/pickingProgress.service");
const { sendSuccess } = require("../utils/response");

async function resolveActorUserId(req) {
  const actorId = req.user?.sub;
  if (!actorId) return null;
  const actor = await adminUserService.getAdminUserById(actorId);
  return actor.id;
}

async function createPickingProgress(req, res, next) {
  try {
    const actorUserId = await resolveActorUserId(req);
    const entry = await pickingProgressService.createPickingProgress(req.body, actorUserId);
    return sendSuccess(res, entry);
  } catch (err) {
    return next(err);
  }
}

async function listPickingProgress(req, res, next) {
  try {
    const result = await pickingProgressService.listPickingProgress(req.query);
    return res.json({ ok: true, items: result.items, meta: result.meta });
  } catch (err) {
    return next(err);
  }
}

async function getPickingProgressById(req, res, next) {
  try {
    const entry = await pickingProgressService.getPickingProgressById(req.params.id);
    return sendSuccess(res, entry);
  } catch (err) {
    return next(err);
  }
}

async function startPickingProgress(req, res, next) {
  try {
    const actorUserId = await resolveActorUserId(req);
    const entry = await pickingProgressService.startPickingProgress(
      req.params.id,
      actorUserId,
      req.body?.pickerEmployeeId
    );
    return sendSuccess(res, entry);
  } catch (err) {
    return next(err);
  }
}

async function updatePickedQty(req, res, next) {
  try {
    const actorUserId = await resolveActorUserId(req);
    const entry = await pickingProgressService.updatePickedQty(
      req.params.id,
      Number(req.body.delta),
      actorUserId
    );
    return sendSuccess(res, entry);
  } catch (err) {
    return next(err);
  }
}

async function finishPickingProgress(req, res, next) {
  try {
    const actorUserId = await resolveActorUserId(req);
    const entry = await pickingProgressService.finishPickingProgress(req.params.id, actorUserId);
    return sendSuccess(res, entry);
  } catch (err) {
    return next(err);
  }
}

async function cancelPickingProgress(req, res, next) {
  try {
    const actorUserId = await resolveActorUserId(req);
    const entry = await pickingProgressService.cancelPickingProgress(
      req.params.id,
      actorUserId,
      req.body?.reason
    );
    return sendSuccess(res, entry);
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  createPickingProgress,
  listPickingProgress,
  getPickingProgressById,
  startPickingProgress,
  updatePickedQty,
  finishPickingProgress,
  cancelPickingProgress,
};
