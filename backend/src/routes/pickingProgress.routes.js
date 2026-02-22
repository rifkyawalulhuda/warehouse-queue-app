const express = require("express");
const pickingProgressController = require("../controllers/pickingProgress.controller");
const {
  validatePickingCreate,
  validatePickingQtyUpdate,
} = require("../middlewares/validate.middleware");
const authMiddleware = require("../middlewares/auth.middleware");
const { requireRole } = require("../middlewares/role.middleware");

const router = express.Router();

router.use(
  "/picking-progress",
  authMiddleware,
  requireRole("ADMIN", "WAREHOUSE", "CS")
);

router.post(
  "/picking-progress",
  validatePickingCreate,
  pickingProgressController.createPickingProgress
);
router.get("/picking-progress", pickingProgressController.listPickingProgress);
router.get("/picking-progress/:id", pickingProgressController.getPickingProgressById);
router.patch("/picking-progress/:id/start", pickingProgressController.startPickingProgress);
router.patch(
  "/picking-progress/:id/picked-qty",
  validatePickingQtyUpdate,
  pickingProgressController.updatePickedQty
);
router.patch("/picking-progress/:id/finish", pickingProgressController.finishPickingProgress);
router.patch("/picking-progress/:id/cancel", pickingProgressController.cancelPickingProgress);

module.exports = router;
