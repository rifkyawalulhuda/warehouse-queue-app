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
router.post("/schedules", validateScheduleCreate, scheduleController.createSchedule);
router.get("/schedules", scheduleController.listSchedules);
router.get("/schedules/export", scheduleController.exportSchedules);
router.get("/schedules/:id", scheduleController.getScheduleById);
router.put("/schedules/:id", validateScheduleUpdate, scheduleController.updateSchedule);
router.delete("/schedules/:id", scheduleController.deleteSchedule);

module.exports = router;
