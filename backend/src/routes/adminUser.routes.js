const express = require("express");
const adminUserController = require("../controllers/adminUser.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const { requireRole } = require("../middlewares/role.middleware");

const router = express.Router();

router.use("/admin-users", authMiddleware, requireRole("ADMIN"));
router.get("/admin-users", adminUserController.listAdminUsers);
router.post("/admin-users", adminUserController.createAdminUser);
router.patch("/admin-users/:id", adminUserController.updateAdminUser);
router.delete("/admin-users/:id", adminUserController.deleteAdminUser);

module.exports = router;
