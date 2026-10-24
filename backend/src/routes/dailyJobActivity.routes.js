const express = require("express");
const dailyJobActivityController = require("../controllers/dailyJobActivity.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const { requireRole } = require("../middlewares/role.middleware");

const router = express.Router();

router.use(
  "/daily-job-activities",
  authMiddleware,
  requireRole("ADMIN", "WAREHOUSE", "CS")
);

router.get("/daily-job-activities", dailyJobActivityController.listDailyJobActivities);
router.get("/daily-job-activities/:id", dailyJobActivityController.getDailyJobActivityById);
router.patch("/daily-job-activities/:id/notes", dailyJobActivityController.updateDailyJobActivityNotes);
router.get(
  "/daily-job-activities/:id/export-excel",
  dailyJobActivityController.exportDailyJobActivityExcel
);

module.exports = router;
