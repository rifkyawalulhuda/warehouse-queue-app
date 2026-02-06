const express = require("express");
const queueController = require("../controllers/queue.controller");
const {
  validateQueueCreate,
  validateQueueUpdate,
  validateStatusChange,
} = require("../middlewares/validate.middleware");

const router = express.Router();

router.post("/queue", validateQueueCreate, queueController.createQueue);
router.get("/queue", queueController.listQueue);
router.get("/queue/:id", queueController.getQueueById);
router.patch("/queue/:id", validateQueueUpdate, queueController.updateQueue);
router.patch("/queue/:id/status", validateStatusChange, queueController.updateQueueStatus);

module.exports = router;
