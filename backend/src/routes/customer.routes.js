const express = require("express");
const multer = require("multer");
const customerController = require("../controllers/customer.controller");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.get("/customers", customerController.listCustomers);
router.post("/customers", customerController.createCustomer);
router.get("/customers/template", customerController.downloadTemplate);
router.post("/customers/import", upload.single("file"), customerController.importCustomers);
router.patch("/customers/:id", customerController.updateCustomer);
router.put("/customers/:id", customerController.updateCustomer);
router.delete("/customers/:id", customerController.deleteCustomer);

module.exports = router;
