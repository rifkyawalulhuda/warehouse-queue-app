const express = require("express");
const exportController = require("../controllers/export.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const { requireRole } = require("../middlewares/role.middleware");

const router = express.Router();

router.use(
  "/exports",
  authMiddleware,
  requireRole("ADMIN", "WAREHOUSE", "CS")
);

router.get("/exports/options", exportController.getExportOptions);
router.get("/exports/estimate", exportController.estimateExport);
router.get("/exports/jobs", exportController.listExportJobs);
router.post("/exports/jobs", exportController.createExportJob);
router.get("/exports/jobs/:id", exportController.getExportJob);
router.get("/exports/jobs/:id/file", exportController.downloadExportJob);

module.exports = router;