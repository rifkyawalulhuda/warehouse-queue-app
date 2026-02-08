const { sendError } = require("../utils/response");

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return sendError(res, 401, "Unauthorized");
    }
    if (!roles.includes(req.user.role)) {
      return sendError(res, 403, "Forbidden");
    }
    return next();
  };
}

module.exports = {
  requireRole,
};
