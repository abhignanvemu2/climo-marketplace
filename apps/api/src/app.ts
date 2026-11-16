import "dotenv/config";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { db, transaction, audit } from "../../../packages/database/client.js";
import { BusinessError, check } from "../../../packages/domain/src/index.js";
import {
  allow,
  hash,
  identify,
  newSession,
  originGuard,
  origins,
  publicUser,
} from "./security.js";
import { catalog } from "./catalog.js";
import { commerce, webhook } from "./commerce.js";
import { operations } from "./operations.js";
export const app = express();
app.disable("x-powered-by");
app.use(helmet());
app.use(cors({ origin: origins, credentials: true }));
app.use((req, res, next) => {
  req.requestId = randomUUID();
  res.setHeader("X-Request-ID", req.requestId);
  next();
});
app.get("/health", (_req, res) => res.json({ status: "ok" }));
app.get("/ready", async (_req, res) => {
  await db.$queryRaw`SELECT 1`;
  res.json({ status: "ready" });
});
app.post(
  "/api/v1/webhooks/razorpay",
  express.raw({ type: "application/json", limit: "1mb" }),
  async (req, res) =>
    res.json(
      await webhook(
        req.body,
        req.get("x-razorpay-signature") || "",
        req.get("x-razorpay-event-id") || hash(req.body.toString()),
      ),
    ),
);
app.use(express.json({ limit: "1mb" }), cookieParser(), identify, originGuard);
app.use(
  "/api/v1",
  rateLimit({
    windowMs: 60000,
    limit: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      code: "RATE_LIMIT",
      message: "Too many requests. Please try again shortly.",
    },
  }),
);
app.use(
  "/api/v1/auth",
  rateLimit({
    windowMs: 15 * 60000,
    limit: 40,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      code: "RATE_LIMIT",
      message: "Too many sign-in attempts. Try again later.",
    },
  }),
);
const authSchema = z.object({
  email: z
    .email()
    .max(254)
    .transform((v) => v.trim().toLowerCase()),
  password: z.string().min(12).max(100),
});
app.get("/api/v1/auth/me", (req, res) =>
  res.json({
    user: req.user ? publicUser(req.user) : null,
    csrf: req.csrf ?? null,
  }),
);
app.post("/api/v1/auth/register", async (req, res) => {
  const d = authSchema
    .extend({
      name: z.string().min(2).max(100),
      role: z.enum(["CUSTOMER", "SELLER"]).default("CUSTOMER"),
      businessName: z.string().min(3).max(200).optional(),
    })
    .parse(req.body);
  check(d.role !== "SELLER" || d.businessName, "Business name is required");
  const passwordHash = await bcrypt.hash(d.password, 12);
  const user = await transaction(async (tx) => {
    const u = await tx.user.create({
      data: {
        name: d.name,
        email: d.email,
        passwordHash,
        role: d.role,
        ...(d.role === "SELLER"
          ? { seller: { create: { businessName: d.businessName! } } }
          : {}),
      },
    });
    await audit(tx, u.id, "ACCOUNT_CREATED", u.id);
    return u;
  });
  const session = await newSession(user.id);
  res.cookie("climo", session.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 86400000,
    path: "/",
  });
  res.status(201).json({ user: publicUser(user), csrf: session.csrf });
});
app.post("/api/v1/auth/login", async (req, res) => {
  const d = authSchema.parse(req.body);
  const u = await db.user.findUnique({
    where: { email: d.email },
    include: { seller: true },
  });
  const valid = await bcrypt.compare(
    d.password,
    u?.passwordHash ||
      "$2b$12$B8h.Tcs4u0vKBDcG3F9VCe57RnCcuJiF9HZVpDqgywNuNHqB.fhV6",
  );
  check(
    u && valid && u.active && u.seller?.status !== "BLOCKED",
    "Email or password is incorrect, or the account is unavailable",
    401,
    "LOGIN_FAILED",
  );
  const session = await newSession(u.id);
  res.cookie("climo", session.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 86400000,
    path: "/",
  });
  res.json({ user: publicUser(u), csrf: session.csrf });
});
app.post("/api/v1/auth/logout", allow(), async (req, res) => {
  await db.session.deleteMany({
    where: { tokenHash: hash(req.cookies.climo) },
  });
  res.clearCookie("climo", { path: "/" });
  res.json({ ok: true });
});
app.post("/api/v1/auth/revoke-sessions", allow(), async (req, res) => {
  await db.session.deleteMany({ where: { userId: req.user!.id } });
  res.clearCookie("climo", { path: "/" });
  res.json({ ok: true });
});
app.get("/api/v1/me/addresses", allow(), async (req, res) =>
  res.json(await db.address.findMany({ where: { userId: req.user!.id } })),
);
app.post("/api/v1/me/addresses", allow(), async (req, res) => {
  const d = z
    .object({
      name: z.string().min(2).max(100),
      phone: z.string().regex(/^[6-9]\d{9}$/),
      line1: z.string().min(5).max(300),
      city: z.string().min(2).max(100),
      state: z.string().min(2).max(100),
      pincode: z.string().regex(/^[1-9]\d{5}$/),
    })
    .parse(req.body);
  res.json(await db.address.create({ data: { ...d, userId: req.user!.id } }));
});
app.get("/api/v1/me/wishlist", allow(), async (req, res) =>
  res.json(
    await db.wishlist.findMany({
      where: { userId: req.user!.id },
      include: { product: true },
    }),
  ),
);
app.post("/api/v1/me/wishlist/:id", allow(), async (req, res) => {
  const productId = z.string().uuid().parse(req.params.id);
  check(
    await db.product.findUnique({ where: { id: productId } }),
    "Product not found",
    404,
  );
  res.json(
    await db.wishlist.upsert({
      where: { userId_productId: { userId: req.user!.id, productId } },
      create: { userId: req.user!.id, productId },
      update: {},
    }),
  );
});
app.delete("/api/v1/me/wishlist/:id", allow(), async (req, res) => {
  await db.wishlist.deleteMany({
    where: { userId: req.user!.id, productId: String(req.params.id) },
  });
  res.json({ ok: true });
});
app.get("/api/v1/me/cart", allow(), async (req, res) =>
  res.json(
    await db.cartItem.findMany({
      where: { userId: req.user!.id },
      include: { product: true },
    }),
  ),
);
app.put("/api/v1/me/cart", allow(), async (req, res) => {
  const { items } = z
    .object({
      items: z
        .array(
          z.object({
            productId: z.string().uuid(),
            quantity: z.number().int().min(1).max(20),
          }),
        )
        .max(50),
    })
    .parse(req.body);
  res.json(
    await transaction(async (tx) => {
      await tx.cartItem.deleteMany({ where: { userId: req.user!.id } });
      await tx.cartItem.createMany({
        data: items.map((i) => ({ ...i, userId: req.user!.id })),
        skipDuplicates: true,
      });
      return { ok: true };
    }),
  );
});
app.use("/api/v1", catalog, commerce, operations);
app.use((_req, res) =>
  res
    .status(404)
    .json({ code: "NOT_FOUND", message: "This endpoint does not exist" }),
);
app.use(
  (
    err: unknown,
    req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    if (err instanceof z.ZodError) {
      res
        .status(400)
        .json({
          code: "VALIDATION",
          message: err.issues
            .map(
              (i) =>
                (i.path.join(".") ? i.path.join(".") + ": " : "") + i.message,
            )
            .join("; "),
          fieldErrors: err.flatten(),
          requestId: req.requestId,
        });
      return;
    }
    if (err instanceof BusinessError) {
      res
        .status(err.status)
        .json({
          code: err.code,
          message: err.message,
          requestId: req.requestId,
        });
      return;
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2002") {
        res
          .status(409)
          .json({
            code: "DUPLICATE",
            message: "A record with these details already exists",
            requestId: req.requestId,
          });
        return;
      }
      if (err.code === "P2025") {
        res
          .status(404)
          .json({
            code: "NOT_FOUND",
            message: "Record not found",
            requestId: req.requestId,
          });
        return;
      }
      if (err.code === "P2034") {
        res
          .status(409)
          .json({
            code: "CONFLICT",
            message: "The record changed. Please retry.",
            requestId: req.requestId,
          });
        return;
      }
    }
    console.error({
      requestId: req.requestId,
      error: err instanceof Error ? err.message : "Unknown",
    });
    res
      .status(500)
      .json({
        code: "INTERNAL",
        message:
          "Unable to complete this request. Contact support with the request ID.",
        requestId: req.requestId,
      });
  },
);
