const express = require("express");
const multer = require("multer");
const transporterController = require("../controllers/transporter.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const { requireRole } = require("../middlewares/role.middleware");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Dibaca ketiga role: form antrian butuh daftar transporter untuk dropdown
// dan untuk "tambah inline".
router.get(
  "/transporters",
  authMiddleware,
  requireRole("ADMIN", "WAREHOUSE", "CS"),
  transporterController.listTransporters
);

// Tambah inline dari form antrian boleh untuk ketiga role (keputusan S9).
router.post(
  "/transporters",
  authMiddleware,
  requireRole("ADMIN", "WAREHOUSE", "CS"),
  transporterController.createTransporter
);

// Import massal untuk penyiapan data production. Hanya ADMIN, sama seperti
// Master Karyawan, Customer, dan Gate.
router.get(
  "/transporters/template",
  authMiddleware,
  requireRole("ADMIN"),
  transporterController.downloadTemplate
);
router.post(
  "/transporters/import",
  authMiddleware,
  requireRole("ADMIN"),
  upload.single("file"),
  transporterController.importTransporters
);

router.patch(
  "/transporters/:id",
  authMiddleware,
  requireRole("ADMIN"),
  transporterController.updateTransporter
);
router.put(
  "/transporters/:id",
  authMiddleware,
  requireRole("ADMIN"),
  transporterController.updateTransporter
);
router.delete(
  "/transporters/:id",
  authMiddleware,
  requireRole("ADMIN"),
  transporterController.deleteTransporter
);

module.exports = router;
