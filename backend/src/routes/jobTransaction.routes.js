const express = require("express");
const jobTransactionController = require("../controllers/jobTransaction.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const { requireRole } = require("../middlewares/role.middleware");

const router = express.Router();

router.use(
  "/job-transactions",
  authMiddleware,
  requireRole("ADMIN", "WAREHOUSE", "CS")
);

router.get("/job-transactions", jobTransactionController.listJobTransactions);
router.get("/job-transactions/export", jobTransactionController.exportJobTransactions);
router.post("/job-transactions", jobTransactionController.createJobTransaction);
router.get("/job-transactions/:id", jobTransactionController.getJobTransactionById);
router.put("/job-transactions/:id", jobTransactionController.updateJobTransaction);
router.patch("/job-transactions/:id/start", jobTransactionController.startJobTransaction);
router.patch("/job-transactions/:id/finish", jobTransactionController.finishJobTransaction);
router.patch(
  "/job-transactions/:id/reopen",
  requireRole("ADMIN"),
  jobTransactionController.reopenJobTransaction
);
router.patch(
  "/job-transactions/:id/cancel",
  requireRole("ADMIN"),
  jobTransactionController.cancelJobTransaction
);
router.delete("/job-transactions/:id", jobTransactionController.deleteJobTransaction);

module.exports = router;
