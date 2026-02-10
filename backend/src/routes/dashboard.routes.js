const express = require("express");
const dashboardController = require("../controllers/dashboard.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const { requireRole } = require("../middlewares/role.middleware");

const router = express.Router();

router.use(authMiddleware, requireRole("ADMIN", "WAREHOUSE", "CS"));

router.get("/dashboard/summary", dashboardController.summary);
router.get("/dashboard/schedule-summary", dashboardController.scheduleSummary);
router.get("/dashboard/progress-summary", dashboardController.progressSummary);
router.get("/dashboard/hourly", dashboardController.hourly);
router.get("/dashboard/status", dashboardController.status);
router.get("/dashboard/top-customers", dashboardController.topCustomers);
router.get("/dashboard/over-sla", dashboardController.overSla);

module.exports = router;
