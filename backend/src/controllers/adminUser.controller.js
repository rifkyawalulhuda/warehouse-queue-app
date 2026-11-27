const adminUserService = require("../services/adminUser.service");
const { sendSuccess, sendPaginated } = require("../utils/response");

async function listAdminUsers(req, res, next) {
  try {
    const { data, meta } = await adminUserService.listAdminUsers(req.query);
    return sendPaginated(res, data, meta);
  } catch (err) {
    return next(err);
  }
}

async function createAdminUser(req, res, next) {
  try {
    const admin = await adminUserService.createAdminUser(req.body);
    return sendSuccess(res, admin);
  } catch (err) {
    return next(err);
  }
}

async function updateAdminUser(req, res, next) {
  try {
    const admin = await adminUserService.updateAdminUser(req.params.id, req.body);
    return sendSuccess(res, admin);
  } catch (err) {
    return next(err);
  }
}

async function deleteAdminUser(req, res, next) {
  try {
    const admin = await adminUserService.deleteAdminUser(req.params.id);
    return sendSuccess(res, admin);
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  listAdminUsers,
  createAdminUser,
  updateAdminUser,
  deleteAdminUser,
};
