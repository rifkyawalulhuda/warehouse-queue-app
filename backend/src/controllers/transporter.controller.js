const transporterService = require("../services/transporter.service");
const { sendSuccess, sendPaginated } = require("../utils/response");

async function listTransporters(req, res, next) {
  try {
    const { data, meta } = await transporterService.listTransporters(req.query);
    return sendPaginated(res, data, meta);
  } catch (err) {
    return next(err);
  }
}

async function createTransporter(req, res, next) {
  try {
    const data = await transporterService.createTransporter(req.body);
    return sendSuccess(res, data);
  } catch (err) {
    return next(err);
  }
}

async function updateTransporter(req, res, next) {
  try {
    const data = await transporterService.updateTransporter(req.params.id, req.body);
    return sendSuccess(res, data);
  } catch (err) {
    return next(err);
  }
}

async function deleteTransporter(req, res, next) {
  try {
    const data = await transporterService.deleteTransporter(req.params.id);
    return sendSuccess(res, data);
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  listTransporters,
  createTransporter,
  updateTransporter,
  deleteTransporter,
};
