import { Router } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db, transaction, audit } from "../../../packages/database/client.js";
import {
  check,
  effectivePrice,
  saleable,
} from "../../../packages/domain/src/index.js";
import { allow, sellerFor } from "./security.js";
export const catalog = Router();
export const productSchema = z
  .object({
    name: z.string().min(5).max(180),
    description: z.string().min(20).max(10000),
    sku: z.string().min(3).max(60),
    categoryId: z.string().uuid(),
    brandId: z.string().uuid(),
    fabricId: z.string().uuid(),
    color: z.string().min(2).max(50),
    occasion: z.string().min(2).max(80),
    images: z
      .array(
        z
          .url()
          .refine(
            (v) =>
              v.startsWith("https://") || v.startsWith("http://localhost:"),
          ),
      )
      .min(1)
      .max(12),
    mrp: z.number().int().min(100).max(100000000),
    price: z.number().int().min(100).max(100000000),
    attributes: z
      .record(
        z.string(),
        z.union([z.string().max(1000), z.boolean(), z.number()]),
      )
      .default({}),
  })
  .refine((v) => v.price <= v.mrp, {
    message: "Selling price cannot exceed MRP",
  });
const presented = (p: any) => ({
  ...p,
  effectivePrice: effectivePrice(p.price, p.promoBps),
  available: p.stock - p.reserved,
  seller: p.seller
    ? { id: p.seller.id, businessName: p.seller.businessName }
    : undefined,
});
async function taxons(data: z.infer<typeof productSchema>) {
  for (const [kind, id] of [
    ["CATEGORY", data.categoryId],
    ["BRAND", data.brandId],
    ["FABRIC", data.fabricId],
  ])
    check(
      await db.taxon.findFirst({ where: { id, kind, active: true } }),
      `Select an active ${kind.toLowerCase()}`,
    );
}
catalog.get("/catalog/meta", async (_req, res) =>
  res.json(
    await db.taxon.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
    }),
  ),
);
catalog.get("/products", async (req, res) => {
  const q = z
    .object({
      search: z.string().max(100).optional(),
      category: z.string().optional(),
      fabric: z.string().optional(),
      sort: z.enum(["newest", "price-low", "price-high"]).default("newest"),
      page: z.coerce.number().int().min(1).max(10000).default(1),
      min: z.coerce.number().int().min(0).optional(),
      max: z.coerce.number().int().min(0).optional(),
    })
    .parse(req.query);
  const where: Prisma.ProductWhereInput = {
    ...saleable,
    ...(q.search
      ? {
          OR: [
            { name: { contains: q.search, mode: "insensitive" } },
            { description: { contains: q.search, mode: "insensitive" } },
            { color: { contains: q.search, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(q.category ? { categoryId: q.category } : {}),
    ...(q.fabric ? { fabricId: q.fabric } : {}),
    price: { gte: q.min, lte: q.max },
  };
  const [items, total] = await Promise.all([
    db.product.findMany({
      where,
      include: { seller: true },
      orderBy:
        q.sort === "newest"
          ? { createdAt: "desc" }
          : { price: q.sort === "price-low" ? "asc" : "desc" },
      skip: (q.page - 1) * 24,
      take: 24,
    }),
    db.product.count({ where }),
  ]);
  res.json({ items: items.map(presented), total, page: q.page });
});
catalog.get("/products/:id", async (req, res) => {
  const p = await db.product.findFirst({
    where: {
      ...saleable,
      OR: [{ id: String(req.params.id) }, { slug: String(req.params.id) }],
    },
    include: { seller: true },
  });
  check(p, "Product not found", 404);
  res.json({
    ...presented(p),
    reviews: await db.review.findMany({
      where: { productId: p.id, status: "APPROVED" },
      take: 30,
    }),
    questions: await db.question.findMany({
      where: { productId: p.id },
      take: 30,
    }),
  });
});
catalog.get("/banners", async (_req, res) =>
  res.json(
    await db.banner.findMany({
      where: {
        active: true,
        AND: [
          { OR: [{ startAt: null }, { startAt: { lte: new Date() } }] },
          { OR: [{ endAt: null }, { endAt: { gt: new Date() } }] },
        ],
      },
      orderBy: { sort: "asc" },
    }),
  ),
);
catalog.get("/pages/:slug", async (req, res) => {
  const p = await db.cmsPage.findFirst({
    where: { slug: String(req.params.slug), published: true },
  });
  check(p, "Page not yet published", 404);
  res.json(p);
});
catalog.get("/seller/products", allow("SELLER"), async (req, res) => {
  const s = await sellerFor(req.user!.id);
  res.json(
    (
      await db.product.findMany({
        where: { sellerId: s.id },
        include: {
          revisions: { orderBy: { createdAt: "desc" } },
          priceRequests: { orderBy: { createdAt: "desc" } },
        },
        orderBy: { createdAt: "desc" },
      })
    ).map(presented),
  );
});
catalog.post("/seller/products", allow("SELLER"), async (req, res) => {
  const s = await sellerFor(req.user!.id, true),
    d = productSchema.parse(req.body);
  await taxons(d);
  const p = await transaction(async (tx) => {
    const p = await tx.product.create({
      data: {
        ...d,
        sellerId: s.id,
        slug:
          d.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") +
          "-" +
          crypto.randomUUID().slice(0, 8),
        status: "PENDING",
      },
    });
    await audit(tx, req.user!.id, "PRODUCT_SUBMITTED", p.id);
    return p;
  });
  res.status(201).json(p);
});
catalog.post(
  "/seller/products/:id/revisions",
  allow("SELLER"),
  async (req, res) => {
    const s = await sellerFor(req.user!.id, true),
      d = productSchema.parse(req.body);
    await taxons(d);
    res.json(
      await transaction(async (tx) => {
        const p = await tx.product.findFirst({
          where: { id: String(req.params.id), sellerId: s.id },
        });
        check(p, "Product not found", 404);
        check(
          !(await tx.productRevision.findFirst({
            where: { productId: p.id, status: "PENDING" },
          })),
          "A revision is already pending",
          409,
        );
        const r = await tx.productRevision.create({
          data: { productId: p.id, baseVersion: p.version, data: d },
        });
        await audit(tx, req.user!.id, "PRODUCT_REVISION", p.id);
        return r;
      }),
    );
  },
);
catalog.post(
  "/seller/products/:id/stock",
  allow("SELLER"),
  async (req, res) => {
    const s = await sellerFor(req.user!.id, true),
      d = z
        .object({
          stock: z.number().int().min(0).max(1000000),
          reason: z.string().min(3).max(500),
        })
        .parse(req.body);
    res.json(
      await transaction(async (tx) => {
        const p = await tx.product.findFirst({
          where: { id: String(req.params.id), sellerId: s.id },
        });
        check(p, "Product not found", 404);
        check(
          d.stock >= p.reserved,
          "Stock cannot be lower than reserved quantity",
          409,
        );
        await tx.inventoryMovement.create({
          data: {
            productId: p.id,
            actorId: req.user!.id,
            before: p.stock,
            after: d.stock,
            reason: d.reason,
          },
        });
        await audit(tx, req.user!.id, "INVENTORY_ADJUSTMENT", p.id, {
          before: p.stock,
          after: d.stock,
          reason: d.reason,
        });
        return tx.product.update({
          where: { id: p.id },
          data: { stock: d.stock },
        });
      }),
    );
  },
);
catalog.post(
  "/seller/products/:id/price",
  allow("SELLER"),
  async (req, res) => {
    const s = await sellerFor(req.user!.id, true),
      d = z
        .object({
          price: z.number().int().min(100).max(100000000),
          mrp: z.number().int().min(100).max(100000000),
        })
        .refine((v) => v.price <= v.mrp)
        .parse(req.body);
    res.json(
      await transaction(async (tx) => {
        const p = await tx.product.findFirst({
          where: { id: String(req.params.id), sellerId: s.id },
        });
        check(p, "Product not found", 404);
        check(
          !(await tx.priceRequest.findFirst({
            where: { productId: p.id, status: "PENDING" },
          })),
          "A price change is already pending",
          409,
        );
        const r = await tx.priceRequest.create({
          data: {
            productId: p.id,
            oldPrice: p.price,
            proposedPrice: d.price,
            proposedMrp: d.mrp,
            baseVersion: p.version,
          },
        });
        await audit(tx, req.user!.id, "PRICE_PROPOSED", p.id, d);
        return r;
      }),
    );
  },
);
catalog.get("/admin/products", allow("ADMIN"), async (_req, res) =>
  res.json(
    await db.product.findMany({
      include: {
        seller: { select: { businessName: true } },
        revisions: { where: { status: "PENDING" } },
        priceRequests: { where: { status: "PENDING" } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
  ),
);
catalog.post(
  "/admin/products/:id/decision",
  allow("ADMIN"),
  async (req, res) => {
    const d = z
      .object({
        decision: z.enum(["APPROVED", "REJECTED", "DISABLED"]),
        reason: z.string().min(3).max(500),
      })
      .parse(req.body);
    res.json(
      await transaction(async (tx) => {
        const p = await tx.product.findUnique({
          where: { id: String(req.params.id) },
          include: { seller: true },
        });
        check(p, "Product not found", 404);
        if (d.decision === "APPROVED")
          check(
            p.seller.status === "ACTIVE" &&
              p.seller.verification === "VERIFIED",
            "Verify and activate the seller first",
          );
        await audit(tx, req.user!.id, "PRODUCT_" + d.decision, p.id, {
          reason: d.reason,
        });
        return tx.product.update({
          where: { id: p.id },
          data: { status: d.decision, version: { increment: 1 } },
        });
      }),
    );
  },
);
catalog.post(
  "/admin/revisions/:id/decision",
  allow("ADMIN"),
  async (req, res) => {
    const d = z
      .object({ approve: z.boolean(), reason: z.string().min(3) })
      .parse(req.body);
    res.json(
      await transaction(async (tx) => {
        const r = await tx.productRevision.findUnique({
          where: { id: String(req.params.id) },
          include: { product: true },
        });
        check(r && r.status === "PENDING", "Pending revision not found", 404);
        check(
          r.baseVersion === r.product.version,
          "Product changed; resubmit the revision",
          409,
        );
        if (d.approve)
          await tx.product.update({
            where: { id: r.productId },
            data: { ...productSchema.parse(r.data), version: { increment: 1 } },
          });
        await audit(tx, req.user!.id, "REVISION_REVIEW", r.id, d);
        return tx.productRevision.update({
          where: { id: r.id },
          data: {
            status: d.approve ? "APPROVED" : "REJECTED",
            reason: d.reason,
            reviewerId: req.user!.id,
          },
        });
      }),
    );
  },
);
catalog.post("/admin/prices/:id/decision", allow("ADMIN"), async (req, res) => {
  const d = z
    .object({ approve: z.boolean(), reason: z.string().min(3) })
    .parse(req.body);
  res.json(
    await transaction(async (tx) => {
      const r = await tx.priceRequest.findUnique({
        where: { id: String(req.params.id) },
        include: { product: true },
      });
      check(r && r.status === "PENDING", "Pending request not found", 404);
      check(
        r.baseVersion === r.product.version,
        "Product changed; resubmit price request",
        409,
      );
      if (d.approve)
        await tx.product.update({
          where: { id: r.productId },
          data: {
            price: r.proposedPrice,
            mrp: r.proposedMrp,
            version: { increment: 1 },
          },
        });
      await audit(tx, req.user!.id, "PRICE_REVIEW", r.id, d);
      return tx.priceRequest.update({
        where: { id: r.id },
        data: {
          status: d.approve ? "APPROVED" : "REJECTED",
          reason: d.reason,
          reviewerId: req.user!.id,
        },
      });
    }),
  );
});
