const { sendError } = require("../utils/response");

function errorMiddleware(err, req, res, next) {
  if (res.headersSent) return next(err);

  const status = err.status || 500;
  const message = err.message || "Internal Server Error";
  const details = err.details;

  return sendError(res, status, message, details);
}

module.exports = errorMiddleware;
