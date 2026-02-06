const express = require("express");
const customerController = require("../controllers/customer.controller");

const router = express.Router();

router.get("/customers", customerController.listCustomers);
router.post("/customers", customerController.createCustomer);

module.exports = router;
