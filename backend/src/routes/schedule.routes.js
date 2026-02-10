const express = require("express");
const scheduleController = require("../controllers/schedule.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const { requireRole } = require("../middlewares/role.middleware");
const {
  validateScheduleCreate,
  validateScheduleUpdate,
} = require("../middlewares/validate.middleware");

const router = express.Router();

router.use("/schedules", authMiddleware, requireRole("ADMIN", "WAREHOUSE", "CS"));
router.post(
  "/schedules",
  requireRole("ADMIN", "CS"),
  validateScheduleCreate,
  scheduleController.createSchedule
);
router.get("/schedules", scheduleController.listSchedules);
router.get("/schedules/export", scheduleController.exportSchedules);
router.get("/schedules/print-summary", scheduleController.printSummary);
router.get("/schedules/:id", scheduleController.getScheduleById);
router.put(
  "/schedules/:id",
  requireRole("ADMIN", "CS"),
  validateScheduleUpdate,
  scheduleController.updateSchedule
);
router.delete("/schedules/:id", requireRole("ADMIN", "CS"), scheduleController.deleteSchedule);

module.exports = router;
