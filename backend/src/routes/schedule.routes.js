const express = require("express");
const multer = require("multer");
const scheduleController = require("../controllers/schedule.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const { requireRole } = require("../middlewares/role.middleware");
const {
  validateScheduleCreate,
  validateScheduleUpdate,
} = require("../middlewares/validate.middleware");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.use("/schedules", authMiddleware, requireRole("ADMIN", "WAREHOUSE", "CS"));
router.post(
  "/schedules",
  requireRole("ADMIN", "CS"),
  validateScheduleCreate,
  scheduleController.createSchedule
);
router.get("/schedules", scheduleController.listSchedules);
router.get("/schedules/available-items", scheduleController.listAvailableItems);
router.patch(
  "/schedules/items/:id/close-no-show",
  authMiddleware,
  requireRole("ADMIN"),
  scheduleController.closeNoShow
);
router.get("/schedules/export", scheduleController.exportSchedules);
router.get("/schedules/print-summary", scheduleController.printSummary);

// Import bulk Schedule Delivery & Receiving. Harus didaftarkan sebelum
// "/schedules/:id" agar tidak tertangkap sebagai id.
router.get(
  "/schedules/import-template",
  requireRole("ADMIN", "CS"),
  scheduleController.downloadImportTemplate
);
router.post(
  "/schedules/import",
  requireRole("ADMIN", "CS"),
  upload.single("file"),
  scheduleController.importSchedules
);
router.get(
  "/schedules/import-logs",
  requireRole("ADMIN", "CS"),
  scheduleController.listImportLogs
);

router.get("/schedules/:id", scheduleController.getScheduleById);
router.put(
  "/schedules/:id",
  requireRole("ADMIN", "CS"),
  validateScheduleUpdate,
  scheduleController.updateSchedule
);
router.delete("/schedules/:id", requireRole("ADMIN", "CS"), scheduleController.deleteSchedule);

module.exports = router;
