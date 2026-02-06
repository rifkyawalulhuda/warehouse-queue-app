const queueService = require("../services/queue.service");
const { sendSuccess } = require("../utils/response");

async function createQueue(req, res, next) {
  try {
    const userName = queueService.getUserName(req);
    const entry = await queueService.createQueueEntry(req.body, userName);
    return sendSuccess(res, entry);
  } catch (err) {
    return next(err);
  }
}

async function listQueue(req, res, next) {
  try {
    const entries = await queueService.listQueueEntries(req.query);
    return sendSuccess(res, entries);
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
    const userName = queueService.getUserName(req);
    const entry = await queueService.updateQueueEntry(req.params.id, req.body, userName);
    return sendSuccess(res, entry);
  } catch (err) {
    return next(err);
  }
}

async function updateQueueStatus(req, res, next) {
  try {
    const userName = queueService.getUserName(req);
    const entry = await queueService.changeQueueStatus(req.params.id, req.body.newStatus, userName);
    return sendSuccess(res, entry);
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  createQueue,
  listQueue,
  getQueueById,
  updateQueue,
  updateQueueStatus,
};
