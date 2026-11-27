const express = require("express");
const reportController = require("../controllers/report.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const { requireRole } = require("../middlewares/role.middleware");

const router = express.Router();

// T5: ketiga role boleh melihat dan mengekspor report.
router.get(
  "/reports/schedule-vs-actual",
  authMiddleware,
  requireRole("ADMIN", "WAREHOUSE", "CS"),
  reportController.getReport
);
router.get(
  "/reports/schedule-vs-actual/export",
  authMiddleware,
  requireRole("ADMIN", "WAREHOUSE", "CS"),
  reportController.exportReport
);

module.exports = router;
