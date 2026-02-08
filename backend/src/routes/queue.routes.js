const express = require("express");
const queueController = require("../controllers/queue.controller");
const {
  validateQueueCreate,
  validateQueueUpdate,
  validateStatusChange,
} = require("../middlewares/validate.middleware");
const authMiddleware = require("../middlewares/auth.middleware");
const { requireRole } = require("../middlewares/role.middleware");

const router = express.Router();

router.get("/queue/display", queueController.displayQueue);
router.use("/queue", authMiddleware, requireRole("ADMIN", "WAREHOUSE"));
router.post("/queue", validateQueueCreate, queueController.createQueue);
router.get("/queue", queueController.listQueue);
router.get("/queue/export", queueController.exportQueue);
router.get("/queue/:id", queueController.getQueueById);
router.patch("/queue/:id", validateQueueUpdate, queueController.updateQueue);
router.patch("/queue/:id/status", validateStatusChange, queueController.updateQueueStatus);

module.exports = router;
