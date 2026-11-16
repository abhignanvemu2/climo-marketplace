import { Router } from "express";
import { z } from "zod";
import { db, transaction, audit } from "../../../packages/database/client.js";
import {
  check,
  saleable,
  effectivePrice,
} from "../../../packages/domain/src/index.js";
import { allow, sellerFor } from "./security.js";
import { gateway, settings } from "./commerce.js";
export const operations = Router();
operations.get("/seller/profile", allow("SELLER"), async (req, res) =>
  res.json(await sellerFor(req.user!.id)),
);
operations.patch("/seller/profile", allow("SELLER"), async (req, res) => {
  const s = await sellerFor(req.user!.id);
  const d = z
    .object({
      businessName: z.string().min(3).max(200),
      vacation: z.boolean(),
      profile: z.object({
        phone: z.string().regex(/^\d{10}$/),
        businessAddress: z.string().min(10).max(500),
        pickupAddress: z.string().min(10).max(500),
        returnAddress: z.string().min(10).max(500),
        gstin: z.string().max(15).optional(),
      }),
    })
    .parse(req.body);
  res.json(
    await transaction(async (tx) => {
      await audit(tx, req.user!.id, "SELLER_PROFILE", s.id);
      return tx.seller.update({ where: { id: s.id }, data: d });
    }),
  );
});
operations.get("/admin/sellers", allow("ADMIN"), async (_req, res) =>
  res.json(
    await db.seller.findMany({
      include: { user: { select: { email: true, name: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ),
);
operations.post(
  "/admin/sellers/:id/status",
  allow("ADMIN"),
  async (req, res) => {
    const d = z
      .object({
        status: z.enum([
          "ACTIVE",
          "INACTIVE",
          "SUSPENDED",
          "REJECTED",
          "BLOCKED",
        ]),
        reason: z.string().min(3).max(500),
        verified: z.boolean().optional(),
      })
      .parse(req.body);
    res.json(
      await transaction(async (tx) => {
        const s = await tx.seller.findUnique({
          where: { id: String(req.params.id) },
        });
        check(s, "Seller not found", 404);
        if (d.status === "ACTIVE")
          check(
            d.verified || s.verification === "VERIFIED",
            "Complete seller verification before activation",
          );
        if (d.status === "BLOCKED")
          await tx.session.deleteMany({ where: { userId: s.userId } });
        await audit(tx, req.user!.id, "SELLER_STATUS", s.id, {
          before: s.status,
          ...d,
        });
        return tx.seller.update({
          where: { id: s.id },
          data: {
            status: d.status,
            reason: d.reason,
            verification: d.verified ? "VERIFIED" : undefined,
          },
        });
      }),
    );
  },
);
operations.get("/admin/customers", allow("ADMIN"), async (_req, res) =>
  res.json(
    await db.user.findMany({
      where: { role: "CUSTOMER" },
      select: {
        id: true,
        name: true,
        email: true,
        active: true,
        createdAt: true,
      },
      take: 200,
    }),
  ),
);
operations.post(
  "/admin/customers/:id/status",
  allow("ADMIN"),
  async (req, res) => {
    const d = z
      .object({ active: z.boolean(), reason: z.string().min(3) })
      .parse(req.body);
    res.json(
      await transaction(async (tx) => {
        const u = await tx.user.findFirst({
          where: { id: String(req.params.id), role: "CUSTOMER" },
        });
        check(u, "Customer not found", 404);
        if (!d.active) await tx.session.deleteMany({ where: { userId: u.id } });
        await audit(tx, req.user!.id, "CUSTOMER_STATUS", u.id, d);
        await tx.user.update({
          where: { id: u.id },
          data: { active: d.active },
        });
        return { ok: true };
      }),
    );
  },
);
const configSchemas = {
  taxons: z.object({
    kind: z.enum(["BRAND", "CATEGORY", "FABRIC", "COLLECTION"]),
    name: z.string().min(2).max(100),
    slug: z.string().regex(/^[a-z0-9-]+$/),
    active: z.boolean().default(true),
    metadata: z.record(z.string(), z.json()).default({}),
  }),
  banners: z
    .object({
      title: z.string().min(3).max(150),
      subtitle: z.string().max(500),
      image: z.url().refine((v) => v.startsWith("https://")),
      mobileImage: z.url().nullable().optional(),
      cta: z.string().min(2).max(40),
      destination: z.string().regex(/^\/(?!\/)[a-zA-Z0-9/?=&%_-]*$/),
      position: z.enum(["HERO", "PROMO", "CATEGORY"]).default("HERO"),
      sort: z.number().int().default(0),
      active: z.boolean().default(true),
      startAt: z.iso
        .datetime()
        .nullable()
        .transform((v) => (v ? new Date(v) : null)),
      endAt: z.iso
        .datetime()
        .nullable()
        .transform((v) => (v ? new Date(v) : null)),
    })
    .refine((v) => !v.startAt || !v.endAt || v.endAt > v.startAt, {
      message: "Banner end must be after start",
    }),
  coupons: z
    .object({
      code: z
        .string()
        .min(3)
        .max(40)
        .transform((v) => v.toUpperCase()),
      kind: z.enum(["PERCENT", "FIXED"]),
      value: z.number().int().min(1).max(100000000),
      minSpend: z.number().int().min(0).default(0),
      maxDiscount: z.number().int().min(1).nullable().default(null),
      limit: z.number().int().min(1).max(1000000),
      perUser: z.number().int().min(1).max(100),
      firstOrder: z.boolean().default(false),
      active: z.boolean().default(true),
      startsAt: z.iso.datetime().transform((v) => new Date(v)),
      endsAt: z.iso.datetime().transform((v) => new Date(v)),
    })
    .refine(
      (v) =>
        v.endsAt > v.startsAt && (!(v.kind === "PERCENT") || v.value <= 10000),
      { message: "Check coupon rate and dates" },
    ),
  commissions: z
    .object({
      sellerId: z.string().uuid().nullable().default(null),
      categoryId: z.string().uuid().nullable().default(null),
      kind: z.enum(["PERCENT", "FIXED"]),
      value: z.number().int().min(0).max(100000000),
      active: z.boolean().default(true),
    })
    .refine((v) => v.kind !== "PERCENT" || v.value <= 10000),
};
const models = {
  taxons: "taxon",
  banners: "banner",
  coupons: "coupon",
  commissions: "commissionRule",
} as const;
for (const key of Object.keys(
  configSchemas,
) as (keyof typeof configSchemas)[]) {
  operations.get("/admin/" + key, allow("ADMIN"), async (_req, res) =>
    res.json(await (db[models[key]] as any).findMany({ take: 200 })),
  );
  operations.post("/admin/" + key, allow("ADMIN"), async (req, res) => {
    const data = configSchemas[key].parse(req.body);
    res.status(201).json(
      await transaction(async (tx) => {
        const item = await (tx[models[key]] as any).create({ data });
        await audit(tx, req.user!.id, "CREATE_" + key, item.id);
        return item;
      }),
    );
  });
  operations.patch(
    "/admin/" + key + "/:id",
    allow("ADMIN"),
    async (req, res) => {
      const data = configSchemas[key].parse(req.body);
      res.json(
        await transaction(async (tx) => {
          if (key === "commissions") {
            await tx.commissionRule.update({
              where: { id: String(req.params.id) },
              data: { active: false },
            });
            const item = await tx.commissionRule.create({ data: data as any });
            await audit(tx, req.user!.id, "VERSION_COMMISSION", item.id);
            return item;
          }
          const item = await (tx[models[key]] as any).update({
            where: { id: String(req.params.id) },
            data,
          });
          await audit(tx, req.user!.id, "UPDATE_" + key, item.id);
          return item;
        }),
      );
    },
  );
}
operations.get("/admin/pages", allow("ADMIN"), async (_req, res) =>
  res.json(await db.cmsPage.findMany()),
);
operations.put("/admin/pages/:slug", allow("ADMIN"), async (req, res) => {
  const slug = z
      .string()
      .regex(/^[a-z0-9-]+$/)
      .parse(req.params.slug),
    data = z
      .object({
        title: z.string().min(3).max(120),
        body: z.string().min(10).max(50000),
        published: z.boolean(),
      })
      .parse(req.body);
  res.json(
    await transaction(async (tx) => {
      await audit(tx, req.user!.id, "CMS_UPDATED", slug);
      return tx.cmsPage.upsert({
        where: { slug },
        create: { slug, ...data },
        update: data,
      });
    }),
  );
});
operations.get("/admin/settings", allow("ADMIN"), async (_req, res) =>
  res.json(await settings()),
);
operations.put("/admin/settings", allow("ADMIN"), async (req, res) => {
  const data = z
    .object({
      freeShipping: z.number().int().min(0).max(100000000),
      shippingFee: z.number().int().min(0).max(100000),
      returnDays: z.number().int().min(0).max(90),
      holdDays: z.number().int().min(7).max(90),
    })
    .refine((v) => v.holdDays >= v.returnDays, {
      message: "Settlement hold must cover the return window",
    })
    .parse(req.body);
  res.json(
    await transaction(async (tx) => {
      await audit(tx, req.user!.id, "SETTINGS_CHANGED", "commerce", data);
      return tx.setting.upsert({
        where: { key: "commerce" },
        create: { key: "commerce", value: data },
        update: { value: data },
      });
    }),
  );
});
operations.post(
  "/admin/products/:id/promotion",
  allow("ADMIN"),
  async (req, res) => {
    const { bps } = z
      .object({ bps: z.number().int().min(0).max(9000) })
      .parse(req.body);
    res.json(
      await transaction(async (tx) => {
        await audit(
          tx,
          req.user!.id,
          "PRODUCT_PROMOTION",
          String(req.params.id),
          { bps },
        );
        return tx.product.update({
          where: { id: String(req.params.id) },
          data: { promoBps: bps },
        });
      }),
    );
  },
);
operations.get("/admin/audit", allow("ADMIN", "FINANCE"), async (_req, res) =>
  res.json(
    await db.auditEvent.findMany({ orderBy: { createdAt: "desc" }, take: 200 }),
  ),
);
operations.get(
  "/admin/overview",
  allow("ADMIN", "FINANCE"),
  async (_req, res) => {
    const [customers, sellers, products, pending, orders, paid] =
      await Promise.all([
        db.user.count({ where: { role: "CUSTOMER" } }),
        db.seller.count(),
        db.product.count(),
        db.product.count({ where: { status: "PENDING" } }),
        db.order.count(),
        db.order.aggregate({
          where: { paymentStatus: "CAPTURED" },
          _sum: { total: true },
        }),
      ]);
    res.json({
      customers,
      sellers,
      products,
      pending,
      orders,
      gmv: paid._sum.total || 0,
    });
  },
);
operations.post("/me/after-sales", allow("CUSTOMER"), async (req, res) => {
  const d = z
    .object({
      itemId: z.string().uuid(),
      kind: z.enum(["RETURN", "EXCHANGE"]),
      reason: z.string().min(10).max(2000),
    })
    .parse(req.body);
  res.json(
    await transaction(async (tx) => {
      const i = await tx.orderItem.findFirst({
        where: { id: d.itemId, suborder: { order: { userId: req.user!.id } } },
        include: { suborder: true },
      });
      check(i, "Order item not found", 404);
      const config = await settings(tx);
      check(
        i.suborder.status === "DELIVERED" &&
          i.suborder.deliveredAt &&
          Date.now() - i.suborder.deliveredAt.getTime() <
            config.returnDays * 86400000,
        "Item is outside the return/exchange window",
      );
      check(
        !(await tx.afterSale.findFirst({
          where: { itemId: i.id, status: { not: "REJECTED" } },
        })),
        "An after-sales request already exists",
        409,
      );
      return tx.afterSale.create({ data: { ...d, userId: req.user!.id } });
    }),
  );
});
operations.get("/admin/after-sales", allow("ADMIN"), async (_req, res) =>
  res.json(
    await db.afterSale.findMany({
      include: { item: { include: { suborder: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
  ),
);
operations.post(
  "/admin/after-sales/:id/decision",
  allow("ADMIN"),
  async (req, res) => {
    const d = z
      .object({
        status: z.enum([
          "APPROVED",
          "REJECTED",
          "PICKED_UP",
          "INSPECTED",
          "REPLACEMENT_SENT",
        ]),
        remarks: z.string().min(3).max(1000),
      })
      .parse(req.body);
    res.json(
      await transaction(async (tx) => {
        const a = await tx.afterSale.findUnique({
          where: { id: String(req.params.id) },
          include: { item: { include: { suborder: true } } },
        });
        check(a, "Request not found", 404);
        const next: Record<string, string[]> = {
          REQUESTED: ["APPROVED", "REJECTED"],
          APPROVED: ["PICKED_UP"],
          PICKED_UP: ["INSPECTED", "REJECTED"],
          INSPECTED: a.kind === "EXCHANGE" ? ["REPLACEMENT_SENT"] : [],
        };
        check(
          next[a.status]?.includes(d.status),
          "Invalid after-sales transition",
          409,
        );
        const s = a.item.suborder;
        if (d.status === "APPROVED" && a.kind === "EXCHANGE") {
          const p = await tx.product.findFirst({
            where: { id: a.item.productId, ...saleable },
          });
          check(
            p && p.stock - p.reserved >= a.item.quantity,
            "Replacement stock unavailable",
          );
          await tx.product.update({
            where: { id: p.id },
            data: { reserved: { increment: a.item.quantity } },
          });
        }
        if (
          d.status === "REJECTED" &&
          a.status === "PICKED_UP" &&
          a.kind === "EXCHANGE"
        )
          await tx.product.update({
            where: { id: a.item.productId },
            data: { reserved: { decrement: a.item.quantity } },
          });
        if (d.status === "INSPECTED" && a.kind === "RETURN")
          await tx.refund.create({
            data: {
              orderId: s.orderId,
              suborderId: s.id,
              sourceKey: "return:" + a.id,
              amount: a.item.unitPrice * a.item.quantity - a.item.discount,
            },
          });
        if (d.status === "REPLACEMENT_SENT") {
          await tx.product.update({
            where: { id: a.item.productId },
            data: {
              reserved: { decrement: a.item.quantity },
              stock: { decrement: a.item.quantity },
            },
          });
        }
        await audit(tx, req.user!.id, "AFTER_SALES_" + d.status, a.id, d);
        return tx.afterSale.update({ where: { id: a.id }, data: d });
      }),
    );
  },
);
operations.get(
  "/finance/refunds",
  allow("ADMIN", "FINANCE"),
  async (_req, res) =>
    res.json(
      await db.refund.findMany({
        include: {
          order: { select: { gatewayPaymentId: true, paymentStatus: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
    ),
);
operations.post(
  "/finance/refunds/:id/authorize",
  allow("FINANCE"),
  async (req, res) =>
    res.json(
      await transaction(async (tx) => {
        const r = await tx.refund.findUnique({
          where: { id: String(req.params.id) },
          include: { order: true },
        });
        check(r && r.status === "ELIGIBLE", "Eligible refund not found", 409);
        check(
          r.order.paymentStatus === "CAPTURED",
          "Order has no captured payment",
          409,
        );
        const sums = await tx.refund.aggregate({
          where: {
            orderId: r.orderId,
            status: { in: ["AUTHORIZED", "PROCESSING", "PROCESSED"] },
          },
          _sum: { amount: true },
        });
        check(
          (sums._sum.amount || 0) + r.amount <= r.order.total,
          "Refund exceeds captured balance",
          409,
        );
        await audit(tx, req.user!.id, "REFUND_AUTHORIZED", r.id);
        return tx.refund.update({
          where: { id: r.id },
          data: { status: "AUTHORIZED", authorizedBy: req.user!.id },
        });
      }),
    ),
);
operations.post(
  "/finance/refunds/:id/execute",
  allow("FINANCE"),
  async (req, res) => {
    check(
      process.env.FINANCE_EXECUTION_ENABLED === "true",
      "Financial execution is disabled until gateway sandbox acceptance",
      503,
      "INTEGRATION_UNCONFIGURED",
    );
    check(
      process.env.RAZORPAY_KEY_SECRET,
      "Payment gateway is not configured",
      503,
    );
    const r = await transaction(async (tx) => {
      const r = await tx.refund.findUnique({
        where: { id: String(req.params.id) },
        include: { order: true },
      });
      check(
        r && r.status === "AUTHORIZED" && r.order.gatewayPaymentId,
        "Authorized refund not found",
        409,
      );
      await tx.refund.update({
        where: { id: r.id },
        data: { status: "PROCESSING" },
      });
      await audit(tx, req.user!.id, "REFUND_EXECUTION_STARTED", r.id);
      return r;
    });
    // A transport timeout remains PROCESSING. Never repeat POST automatically; reconcile by receipt first.
    const response = await gateway(
      "payments/" + encodeURIComponent(r.order.gatewayPaymentId!) + "/refund",
      "POST",
      { amount: r.amount, receipt: r.id, notes: { climo_refund_id: r.id } },
    );
    check(
      response.amount === r.amount &&
        response.payment_id === r.order.gatewayPaymentId,
      "Refund provider response mismatch",
      502,
    );
    await db.refund.update({
      where: { id: r.id },
      data: { gatewayId: response.id },
    });
    res
      .status(202)
      .json({
        status: "PROCESSING",
        message:
          "Refund submitted; reconcile the authoritative provider result.",
      });
  },
);
operations.post(
  "/finance/refunds/:id/reconcile",
  allow("FINANCE"),
  async (req, res) => {
    const r = await db.refund.findUnique({
      where: { id: String(req.params.id) },
      include: { order: true },
    });
    check(
      r && r.status === "PROCESSING",
      "Refund is not awaiting reconciliation",
      409,
    );
    let remote: any;
    if (r.gatewayId)
      remote = await gateway("refunds/" + encodeURIComponent(r.gatewayId));
    else {
      const list = await gateway(
        "payments/" +
          encodeURIComponent(r.order.gatewayPaymentId!) +
          "/refunds",
      );
      remote = list.items?.find(
        (x: any) => x.receipt === r.id || x.notes?.climo_refund_id === r.id,
      );
      check(
        remote,
        "No matching refund found yet. Escalate to Finance; do not blindly retry.",
        409,
      );
    }
    check(
      remote.amount === r.amount &&
        remote.payment_id === r.order.gatewayPaymentId,
      "Refund mismatch",
      409,
    );
    res.json(
      await transaction(async (tx) => {
        const current = await tx.refund.findUnique({ where: { id: r.id } });
        check(current, "Refund not found", 404);
        if (current.status === "PROCESSED") return current;
        if (remote.status === "processed") {
          const sub = await tx.suborder.findUniqueOrThrow({
            where: { id: r.suborderId },
          });
          const merch = sub.merchandise - sub.discount;
          const shippingPart =
            r.sourceKey.startsWith("cancel:") || r.sourceKey.startsWith("late:")
              ? sub.shipping
              : 0;
          const merchandiseRefund = r.amount - shippingPart;
          const commissionPart = merch
            ? Math.min(
                sub.commission,
                Math.floor(
                  (sub.commission * merchandiseRefund + Math.floor(merch / 2)) /
                    merch,
                ),
              )
            : 0;
          const postings: readonly (readonly [string, number])[] =
            r.sourceKey.startsWith("late:")
              ? [["customer-refund-liability", r.amount]]
              : [
                  ["seller-pending", merchandiseRefund - commissionPart],
                  ["platform-commission", commissionPart],
                  ["shipping-clearing", shippingPart],
                ];
          for (const [debit, amount] of postings)
            if (amount > 0)
              await tx.ledgerEntry.upsert({
                where: { key: "refund:" + r.id + ":" + debit },
                update: {},
                create: {
                  key: "refund:" + r.id + ":" + debit,
                  sellerId: sub.sellerId,
                  suborderId: r.suborderId,
                  debit,
                  credit: "gateway-clearing",
                  amount,
                },
              });
        }
        await audit(tx, req.user!.id, "REFUND_RECONCILED", r.id, {
          remoteStatus: remote.status,
        });
        return tx.refund.update({
          where: { id: r.id },
          data: {
            gatewayId: remote.id,
            status:
              remote.status === "processed"
                ? "PROCESSED"
                : remote.status === "failed"
                  ? "FAILED"
                  : "PROCESSING",
          },
        });
      }),
    );
  },
);
operations.get(
  "/finance/settlements",
  allow("ADMIN", "FINANCE"),
  async (_req, res) =>
    res.json(
      await db.settlement.findMany({
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
    ),
);
operations.post(
  "/finance/settlements/build",
  allow("FINANCE"),
  async (req, res) => res.json(await buildSettlements(req.user!.id)),
);
operations.post(
  "/finance/settlements/:id/authorize",
  allow("FINANCE"),
  async (req, res) =>
    res.json(
      await transaction(async (tx) => {
        const s = await tx.settlement.findUnique({
          where: { id: String(req.params.id) },
        });
        check(s && s.status === "PENDING", "Pending settlement not found", 409);
        await audit(tx, req.user!.id, "SETTLEMENT_AUTHORIZED", s.id);
        return tx.settlement.update({
          where: { id: s.id },
          data: { status: "AUTHORIZED", authorizedBy: req.user!.id },
        });
      }),
    ),
);
operations.post(
  "/finance/settlements/:id/execute",
  allow("FINANCE"),
  async (_req, _res) => {
    check(
      false,
      "Payout provider and beneficiary verification are not configured. No money was transferred.",
      503,
      "INTEGRATION_UNCONFIGURED",
    );
  },
);
export async function buildSettlements(actorId: string) {
  return transaction(async (tx) => {
    const config = await settings(tx),
      cutoff = new Date(Date.now() - config.holdDays * 86400000);
    const now = new Date(),
      day = (now.getUTCDay() + 6) % 7;
    const monday = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - day),
    );
    const week = monday.toISOString().slice(0, 10);
    const eligible = await tx.suborder.findMany({
      where: {
        status: "DELIVERED",
        deliveredAt: { lt: cutoff },
        settlementId: null,
        order: { paymentStatus: "CAPTURED" },
        items: { none: { requests: { some: {} } } },
      },
    });
    const result = [];
    for (const sellerId of new Set(eligible.map((s) => s.sellerId))) {
      if (
        await tx.settlement.findUnique({
          where: { sellerId_week: { sellerId, week } },
        })
      )
        continue;
      const rows = eligible.filter((s) => s.sellerId === sellerId);
      const blocked = await tx.refund.count({
        where: { suborderId: { in: rows.map((s) => s.id) } },
      });
      if (blocked) continue;
      const amount = rows.reduce(
        (n, s) => n + s.merchandise - s.discount - s.commission,
        0,
      );
      const batch = await tx.settlement.create({
        data: { sellerId, week, amount },
      });
      await tx.suborder.updateMany({
        where: { id: { in: rows.map((s) => s.id) } },
        data: { settlementId: batch.id },
      });
      await audit(tx, actorId, "SETTLEMENT_BUILT", batch.id);
      result.push(batch);
    }
    return result;
  });
}
operations.get("/seller/earnings", allow("SELLER"), async (req, res) => {
  const s = await sellerFor(req.user!.id);
  res.json({
    ledger: await db.ledgerEntry.findMany({
      where: { sellerId: s.id },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    settlements: await db.settlement.findMany({
      where: { sellerId: s.id },
      orderBy: { createdAt: "desc" },
    }),
  });
});
operations.post("/me/stock-requests", allow("CUSTOMER"), async (req, res) => {
  const d = z
    .object({
      productId: z.string().uuid(),
      quantity: z.number().int().min(1).max(100),
    })
    .parse(req.body);
  res.json(
    await transaction(async (tx) => {
      const p = await tx.product.findFirst({
        where: { id: d.productId, ...saleable },
      });
      check(p, "Product not found", 404);
      check(
        p.stock - p.reserved === 0,
        "Product is in stock; add it to your bag",
      );
      check(
        !(await tx.stockRequest.findFirst({
          where: {
            userId: req.user!.id,
            productId: p.id,
            status: { not: "NOTIFIED" },
          },
        })),
        "An active request already exists",
        409,
      );
      return tx.stockRequest.create({
        data: { ...d, userId: req.user!.id, sellerId: p.sellerId },
      });
    }),
  );
});
operations.get("/stock-requests", allow(), async (req, res) => {
  const s = req.user!.role === "SELLER" ? await sellerFor(req.user!.id) : null;
  const where =
    req.user!.role === "ADMIN"
      ? {}
      : s
        ? {
            sellerId: s.id,
            status: { in: ["FORWARDED", "RESPONDED", "NOTIFIED"] },
          }
        : { userId: req.user!.id };
  res.json(
    await db.stockRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  );
});
operations.post(
  "/stock-requests/:id/transition",
  allow("ADMIN", "SELLER"),
  async (req, res) => {
    const d = z
      .object({
        status: z.enum(["FORWARDED", "RESPONDED", "NOTIFIED"]),
        quantity: z.number().int().min(0).max(100000).optional(),
        eta: z.string().max(50).optional(),
        remarks: z.string().min(3).max(1000),
      })
      .parse(req.body);
    const s =
      req.user!.role === "SELLER" ? await sellerFor(req.user!.id) : null;
    res.json(
      await transaction(async (tx) => {
        const r = await tx.stockRequest.findUnique({
          where: { id: String(req.params.id) },
        });
        check(r, "Request not found", 404);
        if (s)
          check(
            r.sellerId === s.id &&
              r.status === "FORWARDED" &&
              d.status === "RESPONDED",
            "Action not allowed",
            403,
          );
        else
          check(
            (r.status === "REQUESTED" && d.status === "FORWARDED") ||
              (r.status === "RESPONDED" && d.status === "NOTIFIED"),
            "Invalid request transition",
            409,
          );
        if (d.status === "NOTIFIED")
          await tx.notification.create({
            data: {
              userId: r.userId,
              title: "Stock request update",
              body: d.remarks,
            },
          });
        await audit(tx, req.user!.id, "STOCK_REQUEST_" + d.status, r.id);
        return tx.stockRequest.update({
          where: { id: r.id },
          data: {
            status: d.status,
            response: d.status === "RESPONDED" ? d : undefined,
          },
        });
      }),
    );
  },
);
operations.get("/tickets", allow(), async (req, res) =>
  res.json(
    await db.ticket.findMany({
      where: req.user!.role === "ADMIN" ? {} : { userId: req.user!.id },
      include: {
        messages: {
          where: req.user!.role === "ADMIN" ? {} : { internal: false },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ),
);
operations.post("/tickets", allow(), async (req, res) => {
  const d = z
    .object({
      subject: z.string().min(5).max(200),
      body: z.string().min(10).max(5000),
    })
    .parse(req.body);
  res.json(
    await db.ticket.create({
      data: {
        subject: d.subject,
        userId: req.user!.id,
        messages: { create: { userId: req.user!.id, body: d.body } },
      },
    }),
  );
});
operations.post("/tickets/:id/messages", allow(), async (req, res) => {
  const d = z
    .object({
      body: z.string().min(1).max(5000),
      internal: z.boolean().default(false),
      resolve: z.boolean().default(false),
    })
    .parse(req.body);
  res.json(
    await transaction(async (tx) => {
      const t = await tx.ticket.findUnique({
        where: { id: String(req.params.id) },
      });
      check(
        t && (t.userId === req.user!.id || req.user!.role === "ADMIN"),
        "Ticket not found",
        404,
      );
      check(
        !d.internal || req.user!.role === "ADMIN",
        "Internal notes are admin-only",
        403,
      );
      const message = await tx.ticketMessage.create({
        data: {
          ticketId: t.id,
          userId: req.user!.id,
          body: d.body,
          internal: d.internal,
        },
      });
      if (d.resolve)
        await tx.ticket.update({
          where: { id: t.id },
          data: { status: "RESOLVED" },
        });
      return message;
    }),
  );
});
operations.post(
  "/products/:id/reviews",
  allow("CUSTOMER"),
  async (req, res) => {
    const d = z
        .object({
          rating: z.number().int().min(1).max(5),
          body: z.string().min(10).max(3000),
        })
        .parse(req.body),
      productId = String(req.params.id);
    check(
      await db.orderItem.findFirst({
        where: {
          productId,
          suborder: { status: "DELIVERED", order: { userId: req.user!.id } },
        },
      }),
      "Reviews require a delivered purchase",
      403,
    );
    res.json(
      await db.review.upsert({
        where: { productId_userId: { productId, userId: req.user!.id } },
        create: { productId, userId: req.user!.id, ...d },
        update: { ...d, status: "PENDING" },
      }),
    );
  },
);
operations.get("/admin/reviews", allow("ADMIN"), async (_req, res) =>
  res.json(
    await db.review.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
  ),
);
operations.post(
  "/admin/reviews/:id/decision",
  allow("ADMIN"),
  async (req, res) => {
    const d = z
      .object({ status: z.enum(["APPROVED", "REJECTED"]) })
      .parse(req.body);
    res.json(
      await transaction(async (tx) => {
        await audit(
          tx,
          req.user!.id,
          "REVIEW_MODERATED",
          String(req.params.id),
          d,
        );
        return tx.review.update({
          where: { id: String(req.params.id) },
          data: d,
        });
      }),
    );
  },
);
operations.post("/products/:id/questions", allow(), async (req, res) => {
  const d = z.object({ question: z.string().min(5).max(1000) }).parse(req.body);
  check(
    await db.product.findFirst({
      where: { id: String(req.params.id), ...saleable },
    }),
    "Product not found",
    404,
  );
  res.json(
    await db.question.create({
      data: { productId: String(req.params.id), userId: req.user!.id, ...d },
    }),
  );
});
operations.post(
  "/questions/:id/answer",
  allow("SELLER", "ADMIN"),
  async (req, res) => {
    const d = z.object({ answer: z.string().min(3).max(2000) }).parse(req.body),
      q = await db.question.findUnique({
        where: { id: String(req.params.id) },
      });
    check(q, "Question not found", 404);
    if (req.user!.role === "SELLER") {
      const s = await sellerFor(req.user!.id);
      check(
        await db.product.findFirst({
          where: { id: q.productId, sellerId: s.id },
        }),
        "Question is not assigned to your product",
        403,
      );
    }
    res.json(
      await db.question.update({
        where: { id: q.id },
        data: { ...d, answeredBy: req.user!.id },
      }),
    );
  },
);
operations.get("/me/notifications", allow(), async (req, res) =>
  res.json(
    await db.notification.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ),
);
operations.post("/me/privacy-requests", allow(), async (req, res) => {
  const d = z.object({ kind: z.enum(["EXPORT", "DELETE"]) }).parse(req.body);
  res.json(
    await db.privacyRequest.create({ data: { ...d, userId: req.user!.id } }),
  );
});
operations.post("/assistant/search", async (req, res) => {
  const { query } = z
    .object({ query: z.string().min(2).max(200) })
    .parse(req.body);
  const products = await db.product.findMany({
    where: {
      ...saleable,
      OR: [
        { name: { contains: query, mode: "insensitive" } },
        { color: { contains: query, mode: "insensitive" } },
        { occasion: { contains: query, mode: "insensitive" } },
      ],
    },
    take: 6,
  });
  res.json({
    mode: "catalog-search",
    message: products.length
      ? "Here are matching sarees from the live catalog."
      : "No matching sarees found. Try a fabric, colour or occasion.",
    products: products.map((p) => ({
      id: p.id,
      name: p.name,
      price: effectivePrice(p.price, p.promoBps),
      image: p.images[0],
    })),
  });
});
