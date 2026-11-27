const express = require("express");
const settingsController = require("../controllers/settings.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const { requireRole } = require("../middlewares/role.middleware");

const router = express.Router();

router.get(
  "/settings",
  authMiddleware,
  requireRole("ADMIN", "WAREHOUSE", "CS"),
  settingsController.getSettings
);
router.patch(
  "/settings",
  authMiddleware,
  requireRole("ADMIN"),
  settingsController.updateSettings
);

module.exports = router;
