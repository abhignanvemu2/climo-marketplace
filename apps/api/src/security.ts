import { createHash, randomBytes } from "node:crypto";
import type { RequestHandler } from "express";
import { Role, User } from "@prisma/client";
import { db } from "../../../packages/database/client.js";
import { check } from "../../../packages/domain/src/index.js";
export const hash = (s: string) => createHash("sha256").update(s).digest("hex");
declare global {
  namespace Express {
    interface Request {
      user?: User;
      csrf?: string;
      requestId: string;
    }
  }
}
export const origins = (
  process.env.ALLOWED_ORIGINS ||
  "http://localhost:5173,http://localhost:5174,http://localhost:5175"
).split(",");
export const identify: RequestHandler = async (req, _res, next) => {
  if (req.cookies.climo) {
    const s = await db.session.findUnique({
      where: { tokenHash: hash(req.cookies.climo) },
      include: { user: { include: { seller: true } } },
    });
    if (
      s &&
      s.expiresAt > new Date() &&
      s.user.active &&
      s.user.seller?.status !== "BLOCKED"
    ) {
      req.user = s.user;
      req.csrf = s.csrf;
    }
  }
  next();
};
export const originGuard: RequestHandler = (req, _res, next) => {
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    check(
      origins.includes(req.get("origin") || ""),
      "Request origin is not allowed",
      403,
      "ORIGIN",
    );
    if (req.user)
      check(
        req.get("x-csrf-token") === req.csrf,
        "Session security token is missing or expired",
        403,
        "CSRF",
      );
  }
  next();
};
export const allow =
  (...roles: Role[]): RequestHandler =>
  (req, _res, next) => {
    check(req.user, "Please sign in to continue", 401, "AUTH_REQUIRED");
    check(
      !roles.length || roles.includes(req.user.role),
      "You do not have permission for this action",
      403,
      "FORBIDDEN",
    );
    next();
  };
export const publicUser = (user: User) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
});
export async function newSession(userId: string) {
  const token = randomBytes(32).toString("hex"),
    csrf = randomBytes(24).toString("hex");
  await db.session.create({
    data: {
      userId,
      tokenHash: hash(token),
      csrf,
      expiresAt: new Date(Date.now() + 7 * 86400000),
    },
  });
  return { token, csrf };
}
export async function sellerFor(userId: string, selling = false) {
  const s = await db.seller.findUnique({ where: { userId } });
  check(s, "Seller account was not found", 404);
  check(s.status !== "BLOCKED", "Seller account is blocked", 403);
  if (selling)
    check(
      s.status === "ACTIVE" && s.verification === "VERIFIED" && !s.vacation,
      "Seller account must be verified, active and available",
      403,
    );
  return s;
}
