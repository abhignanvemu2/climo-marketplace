import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { app } from "../../apps/api/src/app.js";
import { db } from "../../packages/database/client.js";
import {
  capturedPayment,
  expireReservations,
} from "../../apps/api/src/commerce.js";
const origin = "http://localhost:5173";
let admin: any,
  seller: any,
  customer: any,
  finance: any,
  other: any,
  product: any,
  address: any;
async function login(email: string) {
  const agent = request.agent(app);
  const response = await agent
    .post("/api/v1/auth/login")
    .set("Origin", origin)
    .send({ email, password: process.env.SEED_PASSWORD });
  assert.equal(response.status, 200, response.text);
  return { agent, csrf: response.body.csrf, user: response.body.user };
}
function post(session: any, path: string, body: any) {
  return session.agent
    .post("/api/v1" + path)
    .set("Origin", origin)
    .set("X-CSRF-Token", session.csrf)
    .send(body);
}
async function checkout(session = customer, qty = 1, coupon?: string) {
  return post(session, "/checkout", {
    key: randomUUID(),
    addressId: address.id,
    items: [{ productId: product.id, quantity: qty }],
    coupon,
  });
}
before(async () => {
  admin = await login("admin@climo.local");
  seller = await login("seller@climo.local");
  customer = await login("customer@climo.local");
  finance = await login("finance@climo.local");
  const a = await post(customer, "/me/addresses", {
    name: "Bib Test",
    phone: "9876543210",
    line1: "24 Loom Road",
    city: "Bengaluru",
    state: "Karnataka",
    pincode: "560001",
  });
  assert.equal(a.status, 200, a.text);
  address = a.body;
  product = await db.product.findFirstOrThrow({ where: { stock: { gt: 0 } } });
  const newAgent = request.agent(app);
  const register = await newAgent
    .post("/api/v1/auth/register")
    .set("Origin", origin)
    .send({
      name: "Another customer",
      email: "other@climo.test",
      password: process.env.SEED_PASSWORD,
    });
  assert.equal(register.status, 201);
  other = {
    agent: newAgent,
    csrf: register.body.csrf,
    user: register.body.user,
  };
});
after(async () => db.$disconnect());
test("public catalog only exposes approved active listings and safe seller fields", async () => {
  const r = await request(app).get("/api/v1/products");
  assert.equal(r.status, 200);
  assert.equal(r.body.items.length, 8);
  assert.equal(r.body.items[0].seller.userId, undefined);
  assert.ok(r.body.items.every((p: any) => p.status === "APPROVED"));
});
test("registration cannot self-assign Admin or Finance", async () => {
  const r = await request(app)
    .post("/api/v1/auth/register")
    .set("Origin", origin)
    .send({
      name: "Attacker",
      email: "evil@test.local",
      password: "ReallyStrongTest2026",
      role: "FINANCE",
    });
  assert.equal(r.status, 400);
});
test("server denies unauthorized finance operations, taxonomy and missing CSRF", async () => {
  assert.equal(
    (await post(admin, "/finance/refunds/" + randomUUID() + "/authorize", {}))
      .status,
    403,
  );
  assert.equal(
    (
      await post(seller, "/admin/taxons", {
        kind: "BRAND",
        name: "Bad",
        slug: "bad",
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await admin.agent
        .post("/api/v1/admin/taxons")
        .set("Origin", origin)
        .send({})
    ).status,
    403,
  );
  assert.equal(
    (await request(app).post("/api/v1/checkout").set("Origin", origin).send({}))
      .status,
    401,
  );
});
test("seller suspension removes public products and blocks checkout", async () => {
  let r = await post(admin, "/admin/sellers/" + product.sellerId + "/status", {
    status: "SUSPENDED",
    reason: "Integration test",
  });
  assert.equal(r.status, 200);
  assert.equal(
    (await request(app).get("/api/v1/products")).body.items.length,
    0,
  );
  assert.equal((await checkout()).status, 409);
  await post(admin, "/admin/sellers/" + product.sellerId + "/status", {
    status: "ACTIVE",
    reason: "Reviewed and restored",
  });
});
test("price proposals leave public price unchanged until Admin approval", async () => {
  const old = product.price;
  let r = await post(seller, "/seller/products/" + product.id + "/price", {
    price: old + 100,
    mrp: product.mrp,
  });
  assert.equal(r.status, 200, r.text);
  assert.equal(
    (await db.product.findUniqueOrThrow({ where: { id: product.id } })).price,
    old,
  );
  r = await post(admin, "/admin/prices/" + r.body.id + "/decision", {
    approve: true,
    reason: "Reviewed change",
  });
  assert.equal(r.status, 200, r.text);
  assert.equal(
    (await db.product.findUniqueOrThrow({ where: { id: product.id } })).price,
    old + 100,
  );
});
test("concurrent checkout cannot oversell one remaining unit", async () => {
  await post(seller, "/seller/products/" + product.id + "/stock", {
    stock: 1,
    reason: "Concurrency test",
  });
  const responses = await Promise.all([checkout(), checkout()]);
  assert.deepEqual(responses.map((r) => r.status).sort(), [201, 409]);
  const p = await db.product.findUniqueOrThrow({ where: { id: product.id } });
  assert.equal(p.reserved, 1);
  await db.order.updateMany({
    where: { status: "PENDING_PAYMENT" },
    data: { expiresAt: new Date(Date.now() - 1000) },
  });
  await expireReservations();
  const after = await db.product.findUniqueOrThrow({
    where: { id: product.id },
  });
  assert.equal(after.reserved, 0);
  assert.equal(after.stock, 1);
  await post(seller, "/seller/products/" + product.id + "/stock", {
    stock: 20,
    reason: "Restore stock",
  });
});
test("checkout key is idempotent and other customers cannot access payment order", async () => {
  const payload = {
    key: randomUUID(),
    addressId: address.id,
    items: [{ productId: product.id, quantity: 1 }],
  };
  const a = await post(customer, "/checkout", payload),
    b = await post(customer, "/checkout", payload);
  assert.equal(a.status, 201, a.text);
  assert.equal(a.body.id, b.body.id);
  assert.equal(
    (
      await other.agent.get(
        "/api/v1/orders/" + a.body.id + "/invoice/" + a.body.suborders[0].id,
      )
    ).status,
    403,
  );
});
test("coupon last-use reservation is concurrency safe", async () => {
  await db.coupon.create({
    data: {
      code: "LASTONE",
      kind: "FIXED",
      value: 1000,
      limit: 1,
      perUser: 5,
      startsAt: new Date(Date.now() - 10000),
      endsAt: new Date(Date.now() + 3600000),
    },
  });
  const r = await Promise.all([
    checkout(customer, 1, "LASTONE"),
    checkout(customer, 1, "LASTONE"),
  ]);
  assert.deepEqual(r.map((x) => x.status).sort(), [201, 409]);
  assert.equal(
    (await db.coupon.findUniqueOrThrow({ where: { code: "LASTONE" } })).used,
    1,
  );
});
test("signed captured-payment service is idempotent and Admin cannot fake paid status", async () => {
  const r = await checkout();
  assert.equal(r.status, 201, r.text);
  const o = r.body;
  const gatewayId = "order_test_" + randomUUID();
  await db.order.update({
    where: { id: o.id },
    data: { gatewayOrderId: gatewayId },
  });
  const payment = {
    id: "pay_test_" + randomUUID(),
    order_id: gatewayId,
    amount: o.total,
    currency: "INR",
    status: "captured",
  };
  await capturedPayment("event_" + payment.id, payment);
  const p = await db.product.findUniqueOrThrow({ where: { id: product.id } });
  await capturedPayment("event_" + payment.id, payment);
  await capturedPayment("verify_" + payment.id, payment);
  assert.equal(
    (await db.product.findUniqueOrThrow({ where: { id: product.id } })).stock,
    p.stock,
  );
  assert.equal(
    (await db.order.findUniqueOrThrow({ where: { id: o.id } })).paymentStatus,
    "CAPTURED",
  );
  assert.equal(
    (await post(admin, "/admin/orders/" + o.id + "/paid", {})).status,
    404,
  );
  const receipt = await customer.agent.get(
    "/api/v1/orders/" + o.id + "/invoice/" + o.suborders[0].id,
  );
  assert.equal(receipt.status, 200);
  assert.match(receipt.headers["content-type"], /pdf/);
  const cancel = await post(
    customer,
    "/me/suborders/" + o.suborders[0].id + "/cancel",
    {},
  );
  assert.equal(cancel.status, 200, cancel.text);
  const refund = await db.refund.findFirstOrThrow({ where: { orderId: o.id } });
  assert.equal(
    (await post(admin, "/finance/refunds/" + refund.id + "/execute", {}))
      .status,
    403,
  );
  assert.equal(
    (await post(finance, "/finance/refunds/" + refund.id + "/authorize", {}))
      .status,
    200,
  );
  assert.equal(
    (await post(finance, "/finance/refunds/" + refund.id + "/execute", {}))
      .status,
    503,
  );
  assert.equal(
    (await post(customer, "/me/suborders/" + o.suborders[0].id + "/cancel", {}))
      .status,
    409,
  );
});
test("captured amount and currency mismatch is rejected without state mutation", async () => {
  const r = await checkout();
  const id = "order_test_" + randomUUID();
  await db.order.update({
    where: { id: r.body.id },
    data: { gatewayOrderId: id },
  });
  await assert.rejects(() =>
    capturedPayment(randomUUID(), {
      id: "pay_bad",
      order_id: id,
      amount: 1,
      currency: "USD",
      status: "captured",
    }),
  );
  assert.equal(
    (await db.order.findUniqueOrThrow({ where: { id: r.body.id } }))
      .paymentStatus,
    "PENDING",
  );
});
test("late captured payment creates review then refund eligibility, never oversells", async () => {
  const r = await checkout();
  const id = "order_test_" + randomUUID();
  await db.order.update({
    where: { id: r.body.id },
    data: { gatewayOrderId: id, expiresAt: new Date(Date.now() - 1000) },
  });
  const p = await db.product.findUniqueOrThrow({ where: { id: product.id } });
  await capturedPayment(randomUUID(), {
    id: "pay_late_" + randomUUID(),
    order_id: id,
    amount: r.body.total,
    currency: "INR",
    status: "captured",
  });
  await expireReservations();
  assert.equal(
    (await db.product.findUniqueOrThrow({ where: { id: product.id } })).stock,
    p.stock,
  );
  assert.equal(
    (await db.order.findUniqueOrThrow({ where: { id: r.body.id } })).status,
    "REFUND_REQUIRED",
  );
  assert.equal(await db.refund.count({ where: { orderId: r.body.id } }), 1);
  const posting = await db.ledgerEntry.findUniqueOrThrow({
    where: { key: "late-capture:" + r.body.suborders[0].id },
  });
  assert.equal(posting.credit, "customer-refund-liability");
  assert.equal(posting.amount, r.body.total);
});
test("reviews require actual delivered purchase and stock requests require out-of-stock", async () => {
  assert.equal(
    (
      await post(other, "/products/" + product.id + "/reviews", {
        rating: 5,
        body: "Fake review from a stranger",
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await post(customer, "/me/stock-requests", {
        productId: product.id,
        quantity: 1,
      })
    ).status,
    400,
  );
});
test("audit and financial ledger are append-only at database level", async () => {
  const a = await db.auditEvent.findFirstOrThrow();
  await assert.rejects(() =>
    db.auditEvent.update({ where: { id: a.id }, data: { action: "TAMPERED" } }),
  );
  const l = await db.ledgerEntry.findFirstOrThrow();
  await assert.rejects(() => db.ledgerEntry.delete({ where: { id: l.id } }));
});
test("product revisions keep the last approved version public until reviewed", async () => {
  const current = await db.product.findUniqueOrThrow({
    where: { id: product.id },
  });
  const revision = {
    name: "Updated silk saree name",
    description:
      "A revised verified saree description with all the required product details.",
    sku: current.sku,
    categoryId: current.categoryId,
    brandId: current.brandId,
    fabricId: current.fabricId,
    color: current.color,
    occasion: current.occasion,
    images: ["https://example.com/saree.jpg"],
    mrp: current.mrp,
    price: current.price,
    attributes: { length: "5.5 metres" },
  };
  const r = await post(
    seller,
    "/seller/products/" + product.id + "/revisions",
    revision,
  );
  assert.equal(r.status, 200, r.text);
  assert.equal(
    (await request(app).get("/api/v1/products/" + product.id)).body.name,
    current.name,
  );
  assert.equal(
    (
      await post(admin, "/admin/revisions/" + r.body.id + "/decision", {
        approve: true,
        reason: "Verified specification",
      })
    ).status,
    200,
  );
  assert.equal(
    (await request(app).get("/api/v1/products/" + product.id)).body.name,
    revision.name,
  );
});
test("stock request must pass through Admin and seller, not skip directly to a sale", async () => {
  const p = await db.product.findFirstOrThrow({ where: { stock: 0 } });
  const r = await post(customer, "/me/stock-requests", {
    productId: p.id,
    quantity: 2,
  });
  assert.equal(r.status, 200, r.text);
  assert.equal(
    (
      await post(customer, "/me/stock-requests", {
        productId: p.id,
        quantity: 2,
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await post(seller, "/stock-requests/" + r.body.id + "/transition", {
        status: "RESPONDED",
        quantity: 2,
        remarks: "We can supply in a week",
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await post(admin, "/stock-requests/" + r.body.id + "/transition", {
        status: "FORWARDED",
        remarks: "Check availability",
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await post(seller, "/stock-requests/" + r.body.id + "/transition", {
        status: "RESPONDED",
        quantity: 2,
        eta: "Next week",
        remarks: "Expected from the loom",
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await post(admin, "/stock-requests/" + r.body.id + "/transition", {
        status: "NOTIFIED",
        remarks: "Seller expects stock next week",
      })
    ).status,
    200,
  );
  assert.equal(
    (await db.product.findUniqueOrThrow({ where: { id: p.id } })).reserved,
    0,
  );
});
test("fulfillment and return inspection create eligibility without executing money", async () => {
  const r = await checkout();
  assert.equal(r.status, 201, r.text);
  const o = r.body,
    g = "order_test_" + randomUUID();
  await db.order.update({ where: { id: o.id }, data: { gatewayOrderId: g } });
  await capturedPayment(randomUUID(), {
    id: "pay_return_" + randomUUID(),
    order_id: g,
    amount: o.total,
    currency: "INR",
    status: "captured",
  });
  const s = o.suborders[0];
  assert.equal(
    (
      await post(seller, "/seller/orders/" + s.id + "/status", {
        status: "DELIVERED",
      })
    ).status,
    409,
  );
  for (const status of [
    "PROCESSING",
    "PACKED",
    "SHIPPED",
    "OUT_FOR_DELIVERY",
    "DELIVERED",
  ])
    assert.equal(
      (
        await post(seller, "/seller/orders/" + s.id + "/status", {
          status,
          awb: status === "SHIPPED" ? "TEST_AWB" : undefined,
        })
      ).status,
      200,
    );
  assert.equal(
    (await post(customer, "/me/suborders/" + s.id + "/cancel", {})).status,
    409,
  );
  const ret = await post(customer, "/me/after-sales", {
    itemId: s.items[0].id,
    kind: "RETURN",
    reason: "Damaged border observed on delivery",
  });
  assert.equal(ret.status, 200, ret.text);
  assert.equal(
    (
      await post(customer, "/me/after-sales", {
        itemId: s.items[0].id,
        kind: "RETURN",
        reason: "Duplicate damaged border return",
      })
    ).status,
    409,
  );
  for (const status of ["APPROVED", "PICKED_UP", "INSPECTED"])
    assert.equal(
      (
        await post(admin, "/admin/after-sales/" + ret.body.id + "/decision", {
          status,
          remarks: "Verified operation in integration test",
        })
      ).status,
      200,
    );
  const refund = await db.refund.findFirstOrThrow({
    where: { sourceKey: "return:" + ret.body.id },
  });
  assert.equal(refund.status, "ELIGIBLE");
  assert.equal(
    refund.amount,
    s.items[0].unitPrice * s.items[0].quantity - s.items[0].discount,
  );
});
test("support internal notes never leak to customers or another account", async () => {
  const t = await post(customer, "/tickets", {
    subject: "Help with the weave",
    body: "Please help me understand the product care instructions.",
  });
  assert.equal(t.status, 200);
  await post(admin, "/tickets/" + t.body.id + "/messages", {
    body: "Operations-only investigation note",
    internal: true,
  });
  const own = await customer.agent.get("/api/v1/tickets");
  assert.ok(
    own.body
      .find((x: any) => x.id === t.body.id)
      .messages.every((m: any) => !m.internal),
  );
  assert.equal(
    (
      await post(other, "/tickets/" + t.body.id + "/messages", {
        body: "unauthorized response",
      })
    ).status,
    404,
  );
});
