const express = require("express");
const multer = require("multer");
const employeeController = require("../controllers/employee.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const { requireRole } = require("../middlewares/role.middleware");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.get("/employees", authMiddleware, requireRole("ADMIN"), employeeController.listEmployees);
router.post("/employees", authMiddleware, requireRole("ADMIN"), employeeController.createEmployee);
router.get(
  "/employees/template",
  authMiddleware,
  requireRole("ADMIN"),
  employeeController.downloadTemplate
);
router.post(
  "/employees/import",
  authMiddleware,
  requireRole("ADMIN"),
  upload.single("file"),
  employeeController.importEmployees
);
router.get("/employees/export", authMiddleware, requireRole("ADMIN"), employeeController.exportEmployees);
router.patch("/employees/:id", authMiddleware, requireRole("ADMIN"), employeeController.updateEmployee);
router.put("/employees/:id", authMiddleware, requireRole("ADMIN"), employeeController.updateEmployee);
router.delete(
  "/employees/:id",
  authMiddleware,
  requireRole("ADMIN"),
  employeeController.deleteEmployee
);

module.exports = router;
