const express = require("express");
const multer = require("multer");
const gateController = require("../controllers/gate.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const { requireRole } = require("../middlewares/role.middleware");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.get("/gates", authMiddleware, requireRole("ADMIN", "WAREHOUSE"), gateController.listGates);
router.post("/gates", authMiddleware, requireRole("ADMIN"), gateController.createGate);
router.patch("/gates/:id", authMiddleware, requireRole("ADMIN"), gateController.updateGate);
router.put("/gates/:id", authMiddleware, requireRole("ADMIN"), gateController.updateGate);
router.delete("/gates/:id", authMiddleware, requireRole("ADMIN"), gateController.deleteGate);
router.get("/gates/template", authMiddleware, requireRole("ADMIN"), gateController.downloadTemplate);
router.post(
  "/gates/import",
  authMiddleware,
  requireRole("ADMIN"),
  upload.single("file"),
  gateController.importGates
);
router.get("/gates/export", authMiddleware, requireRole("ADMIN"), gateController.exportGates);

module.exports = router;
