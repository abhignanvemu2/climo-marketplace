import "dotenv/config";
import bcrypt from "bcryptjs";
import { db } from "./client.js";
if (process.env.NODE_ENV === "production")
  throw new Error("Demo seed is disabled in production");
const password = process.env.SEED_PASSWORD;
if (!password || password.length < 12)
  throw new Error(
    "Set SEED_PASSWORD to a unique 12+ character development password",
  );
const passwordHash = await bcrypt.hash(password, 12);
for (const [email, name, role] of [
  ["customer@climo.local", "Bib", "CUSTOMER"],
  ["seller@climo.local", "Ananya", "SELLER"],
  ["admin@climo.local", "Operations", "ADMIN"],
  ["finance@climo.local", "Finance", "FINANCE"],
] as const)
  await db.user.upsert({
    where: { email },
    create: { email, name, role, passwordHash },
    update: {},
  });
const sellerUser = await db.user.findUniqueOrThrow({
  where: { email: "seller@climo.local" },
});
const seller = await db.seller.upsert({
  where: { userId: sellerUser.id },
  create: {
    userId: sellerUser.id,
    businessName: "The Loom Collective",
    status: "ACTIVE",
    verification: "VERIFIED",
    profile: { demo: true },
  },
  update: {},
});
const taxa: Record<string, string> = {};
for (const [kind, names] of [
  [
    "CATEGORY",
    [
      "Silk Sarees",
      "Cotton Sarees",
      "Banarasi Sarees",
      "Kanjivaram Sarees",
      "Linen Sarees",
      "Organza Sarees",
    ],
  ],
  ["BRAND", ["Climo Atelier", "The Loom Collective"]],
  ["FABRIC", ["Silk", "Cotton", "Linen", "Organza"]],
  ["COLLECTION", ["Wedding Edit", "Everyday Elegance", "Festive Stories"]],
] as [string, string[]][]) {
  for (const name of names) {
    const slug = name.toLowerCase().replaceAll(" ", "-");
    const t = await db.taxon.upsert({
      where: { kind_slug: { kind, slug } },
      create: { kind, name, slug },
      update: {},
    });
    taxa[name] = t.id;
  }
}
const items = [
  [
    "The Gulabi Silk",
    "Silk Sarees",
    "Silk",
    "Rose",
    "Wedding",
    549900,
    399900,
    "rose",
  ],
  [
    "Sundara Kanjivaram",
    "Kanjivaram Sarees",
    "Silk",
    "Emerald",
    "Wedding",
    899900,
    649900,
    "emerald",
  ],
  [
    "The Ivory Edit",
    "Linen Sarees",
    "Linen",
    "Ivory",
    "Everyday",
    329900,
    249900,
    "ivory",
  ],
  [
    "A Royal Banarasi",
    "Banarasi Sarees",
    "Silk",
    "Plum",
    "Festive",
    699900,
    499900,
    "plum",
  ],
  [
    "Morning in Madurai",
    "Cotton Sarees",
    "Cotton",
    "Mustard",
    "Everyday",
    229900,
    169900,
    "mustard",
  ],
  [
    "Moonlight Organza",
    "Organza Sarees",
    "Organza",
    "Sage",
    "Party",
    499900,
    369900,
    "sage",
  ],
  [
    "Indigo Stories",
    "Cotton Sarees",
    "Cotton",
    "Indigo",
    "Everyday",
    299900,
    219900,
    "indigo",
  ],
  [
    "The Saffron Loom",
    "Silk Sarees",
    "Silk",
    "Terracotta",
    "Festive",
    599900,
    429900,
    "terracotta",
  ],
] as const;
for (const [index, item] of items.entries()) {
  const [name, category, fabric, color, occasion, mrp, price, art] = item;
  await db.product.upsert({
    where: { sku: "CL-DEMO-" + (index + 1) },
    create: {
      sku: "CL-DEMO-" + (index + 1),
      slug: art + "-saree",
      sellerId: seller.id,
      name,
      description:
        "A thoughtfully composed saree with a rich woven border, graceful drape and an unstitched blouse piece. Sample catalog entry for development; replace imagery and product specifications with verified seller assets before launch.",
      categoryId: taxa[category],
      brandId: taxa["The Loom Collective"],
      fabricId: taxa[fabric],
      color,
      occasion,
      images: ["/art/" + art + ".svg"],
      mrp,
      price,
      stock: index === 7 ? 0 : 12 + index,
      status: "APPROVED",
      attributes: {
        length: "5.5 metres",
        blouseLength: "0.8 metres",
        blouseIncluded: true,
        washCare: "Dry clean",
        countryOfOrigin: "India",
        sample: true,
      },
    },
    update: {},
  });
}
if (!(await db.banner.count()))
  await db.banner.create({
    data: {
      title: "Every drape,\na different story.",
      subtitle:
        "A considered collection of sarees, from everyday rituals to once-in-a-lifetime moments.",
      image: "/art/hero.svg",
      cta: "Explore the collection",
      destination: "/shop",
      position: "HERO",
    },
  });
await db.coupon.upsert({
  where: { code: "WELCOME10" },
  create: {
    code: "WELCOME10",
    kind: "PERCENT",
    value: 1000,
    minSpend: 200000,
    maxDiscount: 50000,
    limit: 1000,
    perUser: 1,
    firstOrder: true,
    startsAt: new Date("2026-01-01"),
    endsAt: new Date("2030-01-01"),
  },
  update: {},
});
if (!(await db.commissionRule.count()))
  await db.commissionRule.create({ data: { kind: "PERCENT", value: 1000 } });
await db.setting.upsert({
  where: { key: "commerce" },
  create: {
    key: "commerce",
    value: {
      freeShipping: 299900,
      shippingFee: 9900,
      returnDays: 7,
      holdDays: 14,
    },
  },
  update: {},
});
for (const [slug, title, body] of [
  [
    "about",
    "Made for your stories",
    "Climo is a saree marketplace bringing independent sellers and thoughtful shoppers together. This development catalog contains sample products.",
  ],
  [
    "shipping",
    "Shipping information",
    "Shipping is free when eligible merchandise reaches the configured threshold. Below it, shipping is calculated for each seller group before payment. Final delivery policies require merchant approval before launch.",
  ],
  [
    "returns",
    "Returns and exchanges",
    "Request a return or exchange from your delivered order within the configured window. The operations team reviews eligibility and inspection. Finance separately authorizes refunds.",
  ],
  [
    "privacy",
    "Privacy notice",
    "This is a development policy placeholder. Replace it with your approved privacy notice, retention periods, contact details and applicable consent requirements before collecting production customer information.",
  ],
  [
    "terms",
    "Terms of service",
    "This is a development policy placeholder. Publish the merchant-approved terms before live commerce.",
  ],
  [
    "faq",
    "Frequently asked questions",
    "Can I pay cash on delivery? No, only online payments are supported.\nCan I buy from different sellers? Yes, your bag is split into seller-specific orders.\nCan sellers change prices? Price proposals must be approved by the Super Admin.",
  ],
] as const)
  await db.cmsPage.upsert({
    where: { slug },
    create: { slug, title, body, published: true },
    update: {},
  });
console.log(
  "Development catalog and four accounts created. Use your SEED_PASSWORD; no credentials are embedded in source.",
);
await db.$disconnect();
