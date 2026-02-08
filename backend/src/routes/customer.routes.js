const express = require("express");
const multer = require("multer");
const customerController = require("../controllers/customer.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const { requireRole } = require("../middlewares/role.middleware");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.get(
  "/customers",
  authMiddleware,
  requireRole("ADMIN", "WAREHOUSE"),
  customerController.listCustomers
);
router.post("/customers", authMiddleware, requireRole("ADMIN"), customerController.createCustomer);
router.get("/customers/template", authMiddleware, requireRole("ADMIN"), customerController.downloadTemplate);
router.post(
  "/customers/import",
  authMiddleware,
  requireRole("ADMIN"),
  upload.single("file"),
  customerController.importCustomers
);
router.patch("/customers/:id", authMiddleware, requireRole("ADMIN"), customerController.updateCustomer);
router.put("/customers/:id", authMiddleware, requireRole("ADMIN"), customerController.updateCustomer);
router.delete("/customers/:id", authMiddleware, requireRole("ADMIN"), customerController.deleteCustomer);

module.exports = router;
