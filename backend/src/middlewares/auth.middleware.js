const jwt = require("jsonwebtoken");
const { sendError } = require("../utils/response");

function authMiddleware(req, res, next) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    return sendError(res, 401, "Unauthorized");
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    return next();
  } catch (err) {
    return sendError(res, 401, "Token tidak valid atau kadaluarsa");
  }
}

module.exports = authMiddleware;
