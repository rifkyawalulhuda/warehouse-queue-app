const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");
const { sendSuccess, sendError } = require("../utils/response");
const adminUserService = require("../services/adminUser.service");

const prisma = new PrismaClient();

async function login(req, res, next) {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return sendError(res, 400, "Username dan password wajib diisi");
    }

    const user = await prisma.adminUser.findUnique({
      where: { username },
      select: { id: true, name: true, username: true, role: true, passwordHash: true },
    });

    if (!user) {
      return sendError(res, 401, "Username atau password salah");
    }

    const isBcryptHash = typeof user.passwordHash === "string" && user.passwordHash.startsWith("$2");
    let match = false;
    if (isBcryptHash) {
      match = await bcrypt.compare(password, user.passwordHash);
    } else {
      match = password === user.passwordHash;
      if (match) {
        const newHash = await bcrypt.hash(password, 10);
        await prisma.adminUser.update({
          where: { id: user.id },
          data: { passwordHash: newHash },
        });
      }
    }

    if (!match) {
      return sendError(res, 401, "Username atau password salah");
    }

    const token = jwt.sign(
      {
        sub: user.id,
        role: user.role,
        username: user.username,
        name: user.name,
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "12h" }
    );

    return sendSuccess(res, {
      token,
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        role: user.role,
      },
    });
  } catch (err) {
    return next(err);
  }
}

async function me(req, res, next) {
  try {
    const userId = req.user?.sub;
    const user = await adminUserService.getAdminUserById(userId);
    return sendSuccess(res, user);
  } catch (err) {
    return next(err);
  }
}

async function logout(req, res) {
  return sendSuccess(res, { ok: true });
}

module.exports = {
  login,
  me,
  logout,
};
