const customerService = require("../services/customer.service");
const { sendSuccess } = require("../utils/response");

async function listCustomers(req, res, next) {
  try {
    const customers = await customerService.listCustomers();
    return sendSuccess(res, customers);
  } catch (err) {
    return next(err);
  }
}

async function createCustomer(req, res, next) {
  try {
    const customer = await customerService.createCustomer(req.body);
    return sendSuccess(res, customer);
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  listCustomers,
  createCustomer,
};
