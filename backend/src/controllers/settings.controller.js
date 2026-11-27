const settingsService = require("../services/settings.service");
const adminUserService = require("../services/adminUser.service");
const { sendSuccess } = require("../utils/response");

async function getSettings(req, res, next) {
  try {
    const data = await settingsService.listSettings();
    return sendSuccess(res, data);
  } catch (err) {
    return next(err);
  }
}

async function updateSettings(req, res, next) {
  try {
    const actorUser = req.user?.sub ? await adminUserService.getAdminUserById(req.user.sub) : null;
    const data = await settingsService.updateSettings(req.body, actorUser?.id || null);
    return sendSuccess(res, data);
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  getSettings,
  updateSettings,
};
