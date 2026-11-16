import { Router } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { createHmac, timingSafeEqual } from "node:crypto";
import PDFDocument from "pdfkit";
import { db, transaction, audit } from "../../../packages/database/client.js";
import {
  check,
  effectivePrice,
  couponDiscount,
  allocate,
  commissionFor,
  money,
  saleable,
  assertTransition,
} from "../../../packages/domain/src/index.js";
import { allow, sellerFor } from "./security.js";
export const commerce = Router();
export const cartSchema = z
  .object({
    items: z
      .array(
        z.object({
          productId: z.string().uuid(),
          quantity: z.number().int().min(1).max(20),
        }),
      )
      .min(1)
      .max(50),
    coupon: z.string().max(40).optional(),
  })
  .refine(
    (v) => new Set(v.items.map((i) => i.productId)).size === v.items.length,
    { message: "Combine duplicate cart items" },
  );
export async function settings(tx: Prisma.TransactionClient = db) {
  const record = await tx.setting.findUnique({ where: { key: "commerce" } });
  return z
    .object({
      freeShipping: z.number().int().min(0).default(299900),
      shippingFee: z.number().int().min(0).default(9900),
      returnDays: z.number().int().min(0).max(90).default(7),
      holdDays: z.number().int().min(7).max(90).default(14),
    })
    .parse(record?.value ?? {});
}
export async function quote(
  tx: Prisma.TransactionClient,
  input: z.infer<typeof cartSchema>,
  userId?: string,
) {
  const ps = await tx.product.findMany({
    where: { ...saleable, id: { in: input.items.map((i) => i.productId) } },
    orderBy: { id: "asc" },
  });
  check(
    ps.length === input.items.length,
    "An item is unavailable or its seller is inactive",
    409,
    "ITEM_UNAVAILABLE",
  );
  const lines = ps.map((p) => {
    const quantity = input.items.find((i) => i.productId === p.id)!.quantity;
    check(
      p.stock - p.reserved >= quantity,
      `${p.name}: insufficient stock`,
      409,
      "STOCK",
    );
    return {
      product: p,
      quantity,
      unitPrice: effectivePrice(p.price, p.promoBps),
      total: effectivePrice(p.price, p.promoBps) * quantity,
    };
  });
  const subtotal = money(lines.reduce((s, l) => s + l.total, 0));
  let coupon = null;
  let discount = 0;
  if (input.coupon) {
    coupon = await tx.coupon.findUnique({
      where: { code: input.coupon.trim().toUpperCase() },
    });
    const now = new Date();
    check(
      coupon && coupon.active && coupon.startsAt <= now && coupon.endsAt > now,
      "Coupon is invalid or expired",
    );
    check(subtotal >= coupon.minSpend, "Cart does not meet coupon minimum");
    check(
      coupon.used < coupon.limit,
      "Coupon usage limit has been reached",
      409,
    );
    check(userId, "Sign in to use a coupon", 401);
    const used = await tx.order.count({
      where: { userId, couponId: coupon.id, couponReleased: false },
    });
    check(used < coupon.perUser, "You have reached this coupon’s usage limit");
    if (coupon.firstOrder)
      check(
        !(await tx.order.findFirst({
          where: { userId, paymentStatus: "CAPTURED" },
        })),
        "Coupon is for first orders only",
      );
    discount = couponDiscount(subtotal, coupon);
  }
  const config = await settings(tx);
  const sellers = [...new Set(lines.map((l) => l.product.sellerId))];
  const shipping =
    subtotal >= config.freeShipping ? 0 : config.shippingFee * sellers.length;
  const allocations = allocate(
    discount,
    lines.map((l) => l.total),
  );
  return {
    lines: lines.map((l, i) => ({ ...l, discount: allocations[i] })),
    subtotal,
    discount,
    shipping,
    total: money(subtotal - discount + shipping),
    coupon,
    config,
  };
}
commerce.post("/cart/quote", async (req, res) => {
  const q = await quote(db, cartSchema.parse(req.body), req.user?.id);
  res.json({
    ...q,
    lines: q.lines.map((l) => ({
      ...l,
      product: {
        id: l.product.id,
        name: l.product.name,
        images: l.product.images,
      },
    })),
    coupon: q.coupon?.code,
  });
});
commerce.post("/checkout", allow("CUSTOMER"), async (req, res) => {
  const input = cartSchema.parse(req.body),
    { addressId, key } = z
      .object({ addressId: z.string().uuid(), key: z.string().uuid() })
      .parse(req.body);
  const order = await transaction(async (tx) => {
    const previous = await tx.order.findUnique({
      where: { userId_key: { userId: req.user!.id, key } },
      include: { suborders: { include: { items: true } } },
    });
    if (previous) return previous;
    const address = await tx.address.findFirst({
      where: { id: addressId, userId: req.user!.id },
    });
    check(address, "Choose your saved delivery address");
    const q = await quote(tx, input, req.user!.id);
    for (const l of q.lines) {
      const updated = await tx.product.updateMany({
        where: {
          id: l.product.id,
          stock: l.product.stock,
          reserved: l.product.reserved,
        },
        data: { reserved: { increment: l.quantity } },
      });
      check(updated.count === 1, "Stock changed; please retry", 409);
    }
    if (q.coupon) {
      const updated = await tx.coupon.updateMany({
        where: { id: q.coupon.id, used: q.coupon.used },
        data: { used: { increment: 1 } },
      });
      check(updated.count === 1, "Coupon availability changed; retry", 409);
    }
    const rules = await tx.commissionRule.findMany({
        where: { active: true },
        orderBy: { createdAt: "desc" },
      }),
      sellers = [...new Set(q.lines.map((l) => l.product.sellerId))];
    const order = await tx.order.create({
      data: {
        userId: req.user!.id,
        key,
        address: JSON.parse(JSON.stringify(address)),
        subtotal: q.subtotal,
        discount: q.discount,
        shipping: q.shipping,
        total: q.total,
        couponId: q.coupon?.id,
        expiresAt: new Date(Date.now() + 15 * 60000),
        suborders: {
          create: sellers.map((sellerId) => {
            const lines = q.lines.filter(
              (l) => l.product.sellerId === sellerId,
            );
            const commissions = lines.map((l) =>
              commissionFor(
                l.total - l.discount,
                sellerId,
                l.product.categoryId,
                rules,
              ),
            );
            return {
              sellerId,
              merchandise: lines.reduce((s, l) => s + l.total, 0),
              discount: lines.reduce((s, l) => s + l.discount, 0),
              shipping: q.shipping / sellers.length,
              commission: commissions.reduce((s, c) => s + c.amount, 0),
              commissionPolicy: JSON.parse(JSON.stringify(commissions)),
              items: {
                create: lines.map((l) => ({
                  productId: l.product.id,
                  quantity: l.quantity,
                  unitPrice: l.unitPrice,
                  discount: l.discount,
                  snapshot: {
                    name: l.product.name,
                    sku: l.product.sku,
                    mrp: l.product.mrp,
                    color: l.product.color,
                    image: l.product.images[0],
                    attributes: l.product.attributes,
                  },
                })),
              },
            };
          }),
        },
      },
      include: { suborders: { include: { items: true } } },
    });
    await audit(tx, req.user!.id, "CHECKOUT_RESERVED", order.id, {
      total: order.total,
    });
    return order;
  });
  res.status(201).json(order);
});
async function gateway(path: string, method = "GET", body?: unknown) {
  check(
    process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET,
    "Razorpay is not configured. No payment has been taken.",
    503,
    "INTEGRATION_UNCONFIGURED",
  );
  const r = await fetch("https://api.razorpay.com/v1/" + path, {
    method,
    headers: {
      Authorization:
        "Basic " +
        Buffer.from(
          process.env.RAZORPAY_KEY_ID + ":" + process.env.RAZORPAY_KEY_SECRET,
        ).toString("base64"),
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20000),
  });
  const data = (await r.json()) as any;
  check(
    r.ok,
    data.error?.description ||
      "Payment provider could not complete this request",
    502,
    "GATEWAY",
  );
  return data;
}
commerce.post("/orders/:id/payment", allow("CUSTOMER"), async (req, res) => {
  check(
    process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET,
    "Online payment is not configured yet. No payment has been taken.",
    503,
    "INTEGRATION_UNCONFIGURED",
  );
  const o = await transaction(async (tx) => {
    const o = await tx.order.findFirst({
      where: { id: String(req.params.id), userId: req.user!.id },
    });
    check(o, "Order not found", 404);
    check(
      o.status === "PENDING_PAYMENT" && o.expiresAt > new Date(),
      "This payment reservation has expired or is already processed",
      409,
    );
    if (o.gatewayOrderId) return o;
    check(
      !o.gatewayAttemptAt,
      "Payment creation is awaiting reconciliation; do not retry payment",
      409,
      "PAYMENT_PENDING",
    );
    await tx.order.update({
      where: { id: o.id },
      data: { gatewayAttemptAt: new Date() },
    });
    return o;
  });
  let gatewayOrderId = o.gatewayOrderId;
  if (!gatewayOrderId) {
    const go = await gateway("orders", "POST", {
      amount: o.total,
      currency: "INR",
      receipt: o.id,
    });
    check(
      typeof go.id === "string" &&
        go.amount === o.total &&
        go.currency === "INR",
      "Gateway order mismatch",
      502,
    );
    gatewayOrderId = go.id;
    await db.order.update({ where: { id: o.id }, data: { gatewayOrderId } });
  }
  res.json({
    key: process.env.RAZORPAY_KEY_ID,
    order_id: gatewayOrderId,
    amount: o.total,
    currency: "INR",
    name: "Climo",
    description: "Saree marketplace",
  });
});
export function signatureValid(
  raw: Buffer | string,
  signature: string,
  secret: string,
) {
  const expected = createHmac("sha256", secret).update(raw).digest();
  const actual = Buffer.from(signature, "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
export async function capturedPayment(
  eventId: string,
  p: {
    id: string;
    order_id: string;
    amount: number;
    currency: string;
    status: string;
  },
) {
  check(p.status === "captured", "Payment is not captured");
  return transaction(async (tx) => {
    if (await tx.paymentEvent.findUnique({ where: { id: eventId } }))
      return { duplicate: true };
    const o = await tx.order.findUnique({
      where: { gatewayOrderId: p.order_id },
      include: { suborders: { include: { items: true } } },
    });
    check(o, "Payment order is not recognized", 404);
    check(
      p.currency === "INR" && p.amount === o.total,
      "Payment amount or currency mismatch",
      400,
      "PAYMENT_MISMATCH",
    );
    await tx.paymentEvent.create({
      data: { id: eventId, kind: "payment.captured" },
    });
    if (o.paymentStatus === "CAPTURED") {
      check(
        o.gatewayPaymentId === p.id,
        "Unexpected second payment for this order",
        409,
      );
      return { duplicate: true };
    }
    if (o.status !== "PENDING_PAYMENT" || o.expiresAt < new Date()) {
      await tx.order.update({
        where: { id: o.id },
        data: {
          paymentStatus: "CAPTURED",
          gatewayPaymentId: p.id,
          status: "PAYMENT_REVIEW",
          paidAt: new Date(),
        },
      });
      for (const s of o.suborders)
        await tx.ledgerEntry.create({
          data: {
            key: "late-capture:" + s.id,
            sellerId: s.sellerId,
            suborderId: s.id,
            debit: "gateway-clearing",
            credit: "customer-refund-liability",
            amount: s.merchandise - s.discount + s.shipping,
          },
        });
      await audit(tx, "gateway", "LATE_CAPTURE_REVIEW", o.id);
      return { review: true };
    }
    for (const s of o.suborders) {
      for (const i of s.items) {
        check(
          i.reservationState === "RESERVED",
          "Reservation is no longer valid",
          409,
        );
        await tx.product.update({
          where: { id: i.productId },
          data: {
            stock: { decrement: i.quantity },
            reserved: { decrement: i.quantity },
          },
        });
        await tx.orderItem.update({
          where: { id: i.id },
          data: { reservationState: "CONSUMED" },
        });
      }
      await tx.suborder.update({
        where: { id: s.id },
        data: { status: "CONFIRMED", invoiceNumber: "CL-" + s.id },
      });
      await tx.ledgerEntry.create({
        data: {
          key: "sale:" + s.id,
          sellerId: s.sellerId,
          suborderId: s.id,
          debit: "gateway-clearing",
          credit: "seller-pending",
          amount: s.merchandise - s.discount - s.commission,
        },
      });
      await tx.ledgerEntry.create({
        data: {
          key: "commission:" + s.id,
          sellerId: s.sellerId,
          suborderId: s.id,
          debit: "gateway-clearing",
          credit: "platform-commission",
          amount: s.commission,
        },
      });
      if (s.shipping)
        await tx.ledgerEntry.create({
          data: {
            key: "shipping:" + s.id,
            sellerId: s.sellerId,
            suborderId: s.id,
            debit: "gateway-clearing",
            credit: "shipping-clearing",
            amount: s.shipping,
          },
        });
    }
    await tx.order.update({
      where: { id: o.id },
      data: {
        status: "CONFIRMED",
        paymentStatus: "CAPTURED",
        gatewayPaymentId: p.id,
        paidAt: new Date(),
      },
    });
    await tx.notification.create({
      data: {
        userId: o.userId,
        title: "Order confirmed",
        body: `Your order ${o.id.slice(0, 8)} is confirmed.`,
      },
    });
    await audit(tx, "gateway", "PAYMENT_CAPTURED", o.id, { paymentId: p.id });
    return { ok: true };
  });
}
commerce.post("/payments/verify", allow("CUSTOMER"), async (req, res) => {
  const d = z
    .object({
      orderId: z.string().uuid(),
      razorpay_payment_id: z.string().min(1),
      razorpay_signature: z.string().length(64),
    })
    .parse(req.body);
  const o = await db.order.findFirst({
    where: { id: d.orderId, userId: req.user!.id },
  });
  check(o?.gatewayOrderId, "Order not found", 404);
  check(process.env.RAZORPAY_KEY_SECRET, "Gateway not configured", 503);
  check(
    signatureValid(
      o.gatewayOrderId + "|" + d.razorpay_payment_id,
      d.razorpay_signature,
      process.env.RAZORPAY_KEY_SECRET,
    ),
    "Invalid payment signature",
    400,
  );
  const p = await gateway(
    "payments/" + encodeURIComponent(d.razorpay_payment_id),
  );
  check(p.order_id === o.gatewayOrderId, "Payment order mismatch");
  if (p.status !== "captured") {
    res.status(202).json({ pending: true });
    return;
  }
  res.json(await capturedPayment("verify:" + p.id, p));
});
export async function webhook(raw: Buffer, signature: string, eventId: string) {
  check(process.env.RAZORPAY_WEBHOOK_SECRET, "Webhook is not configured", 503);
  check(
    signatureValid(raw, signature, process.env.RAZORPAY_WEBHOOK_SECRET),
    "Invalid webhook signature",
    400,
  );
  const event = JSON.parse(raw.toString());
  if (event.event === "payment.captured")
    return capturedPayment(eventId, event.payload.payment.entity);
  return { ignored: true };
}
commerce.get("/me/orders", allow("CUSTOMER"), async (req, res) =>
  res.json(
    await db.order.findMany({
      where: { userId: req.user!.id },
      include: {
        suborders: {
          include: {
            seller: { select: { businessName: true } },
            items: { include: { requests: true } },
          },
        },
        refunds: true,
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ),
);
commerce.get("/seller/orders", allow("SELLER"), async (req, res) => {
  const s = await sellerFor(req.user!.id);
  res.json(
    await db.suborder.findMany({
      where: { sellerId: s.id, order: { paymentStatus: "CAPTURED" } },
      include: {
        items: true,
        order: { select: { address: true, createdAt: true } },
      },
      orderBy: { order: { createdAt: "desc" } },
      take: 100,
    }),
  );
});
commerce.get("/admin/orders", allow("ADMIN", "FINANCE"), async (_req, res) =>
  res.json(
    await db.order.findMany({
      include: {
        suborders: {
          include: { items: true, seller: { select: { businessName: true } } },
        },
        refunds: true,
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
  ),
);
commerce.post(
  "/seller/orders/:id/status",
  allow("SELLER"),
  async (req, res) => {
    const s = await sellerFor(req.user!.id),
      d = z
        .object({
          status: z.enum([
            "PROCESSING",
            "PACKED",
            "SHIPPED",
            "OUT_FOR_DELIVERY",
            "DELIVERED",
          ]),
          awb: z.string().max(100).optional(),
        })
        .parse(req.body);
    res.json(
      await transaction(async (tx) => {
        const o = await tx.suborder.findFirst({
          where: {
            id: String(req.params.id),
            sellerId: s.id,
            order: { paymentStatus: "CAPTURED" },
          },
        });
        check(o, "Suborder not found", 404);
        assertTransition(o.status, d.status);
        if (d.status === "SHIPPED")
          check(d.awb?.trim(), "Tracking number is required");
        const events = Array.isArray(o.tracking) ? o.tracking : [];
        await audit(tx, req.user!.id, "FULFILLMENT_" + d.status, o.id);
        return tx.suborder.update({
          where: { id: o.id },
          data: {
            status: d.status,
            awb: d.awb,
            deliveredAt: d.status === "DELIVERED" ? new Date() : undefined,
            tracking: [
              ...events,
              {
                status: d.status,
                at: new Date().toISOString(),
                source: "seller",
              },
            ],
          },
        });
      }),
    );
  },
);
commerce.post(
  "/me/suborders/:id/cancel",
  allow("CUSTOMER"),
  async (req, res) => {
    res.json(
      await transaction(async (tx) => {
        const s = await tx.suborder.findFirst({
          where: { id: String(req.params.id), order: { userId: req.user!.id } },
          include: { items: true, order: true },
        });
        check(s, "Suborder not found", 404);
        check(
          ["CONFIRMED", "PROCESSING", "PACKED"].includes(s.status),
          "Cancellation is only available before shipping",
          409,
        );
        for (const i of s.items) {
          if (i.reservationState === "RESERVED")
            await tx.product.update({
              where: { id: i.productId },
              data: { reserved: { decrement: i.quantity } },
            });
          if (i.reservationState === "CONSUMED")
            await tx.product.update({
              where: { id: i.productId },
              data: { stock: { increment: i.quantity } },
            });
          await tx.orderItem.update({
            where: { id: i.id },
            data: { reservationState: "RELEASED" },
          });
        }
        if (s.order.paymentStatus === "CAPTURED")
          await tx.refund.create({
            data: {
              orderId: s.orderId,
              suborderId: s.id,
              sourceKey: "cancel:" + s.id,
              amount: s.merchandise - s.discount + s.shipping,
            },
          });
        await tx.suborder.update({
          where: { id: s.id },
          data: { status: "CANCELLED" },
        });
        const remaining = await tx.suborder.count({
          where: { orderId: s.orderId, status: { not: "CANCELLED" } },
        });
        if (!remaining) {
          await tx.order.update({
            where: { id: s.orderId },
            data: { status: "CANCELLED" },
          });
          if (
            s.order.couponId &&
            !s.order.couponReleased &&
            s.order.paymentStatus !== "CAPTURED"
          ) {
            await tx.coupon.update({
              where: { id: s.order.couponId },
              data: { used: { decrement: 1 } },
            });
            await tx.order.update({
              where: { id: s.orderId },
              data: { couponReleased: true },
            });
          }
        }
        await audit(tx, req.user!.id, "SUBORDER_CANCELLED", s.id);
        return { ok: true };
      }),
    );
  },
);
commerce.get("/orders/:id/invoice/:suborderId", allow(), async (req, res) => {
  const s = await db.suborder.findFirst({
    where: {
      id: String(req.params.suborderId),
      orderId: String(req.params.id),
    },
    include: { items: true, order: true, seller: true },
  });
  check(s, "Invoice not found", 404);
  check(
    req.user!.role === "ADMIN" ||
      req.user!.role === "FINANCE" ||
      s.order.userId === req.user!.id ||
      (req.user!.role === "SELLER" && s.seller.userId === req.user!.id),
    "Access denied",
    403,
  );
  check(
    s.order.paymentStatus === "CAPTURED",
    "Invoice is available after payment",
    409,
  );
  res.type("application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="climo-${s.id}.pdf"`,
  );
  const doc = new PDFDocument({ margin: 50 });
  doc.pipe(res);
  doc.fontSize(28).text("climo.").moveDown();
  doc
    .fontSize(14)
    .text("Order receipt — not a GST tax invoice")
    .fontSize(10)
    .text("Reference: " + s.invoiceNumber)
    .text("Seller: " + s.seller.businessName)
    .text("Order: " + s.order.id)
    .moveDown();
  for (const i of s.items)
    doc.text(
      `${(i.snapshot as any).name} | Qty ${i.quantity} | INR ${((i.unitPrice * i.quantity - i.discount) / 100).toFixed(2)}`,
    );
  doc
    .moveDown()
    .text(`Shipping: INR ${(s.shipping / 100).toFixed(2)}`)
    .text(
      `Total: INR ${((s.merchandise - s.discount + s.shipping) / 100).toFixed(2)}`,
    )
    .text("Payment: " + s.order.gatewayPaymentId)
    .moveDown()
    .text(
      "Tax invoicing must be configured and approved before production trading.",
    );
  doc.end();
});
export async function expireReservations() {
  const ids = await db.order.findMany({
    where: {
      status: { in: ["PENDING_PAYMENT", "PAYMENT_REVIEW"] },
      expiresAt: { lt: new Date() },
    },
    select: { id: true },
    take: 100,
  });
  for (const { id } of ids)
    await transaction(async (tx) => {
      const o = await tx.order.findUnique({
        where: { id },
        include: { suborders: { include: { items: true } } },
      });
      if (!o || !["PENDING_PAYMENT", "PAYMENT_REVIEW"].includes(o.status))
        return;
      for (const s of o.suborders) {
        for (const i of s.items)
          if (i.reservationState === "RESERVED") {
            await tx.product.update({
              where: { id: i.productId },
              data: { reserved: { decrement: i.quantity } },
            });
            await tx.orderItem.update({
              where: { id: i.id },
              data: { reservationState: "RELEASED" },
            });
          }
        await tx.suborder.update({
          where: { id: s.id },
          data: { status: "EXPIRED" },
        });
        if (o.paymentStatus === "CAPTURED")
          await tx.refund.upsert({
            where: { sourceKey: "late:" + s.id },
            create: {
              orderId: o.id,
              suborderId: s.id,
              sourceKey: "late:" + s.id,
              amount: s.merchandise - s.discount + s.shipping,
            },
            update: {},
          });
      }
      if (o.couponId && !o.couponReleased) {
        await tx.coupon.update({
          where: { id: o.couponId },
          data: { used: { decrement: 1 } },
        });
      }
      await tx.order.update({
        where: { id },
        data: {
          status:
            o.paymentStatus === "CAPTURED" ? "REFUND_REQUIRED" : "EXPIRED",
          couponReleased: true,
        },
      });
      await audit(tx, "worker", "RESERVATION_EXPIRED", id);
    });
}
export { gateway };
