import test from "node:test";
import assert from "node:assert/strict";
import {
  effectivePrice,
  allocate,
  couponDiscount,
  commissionFor,
  assertTransition,
  money,
} from "../packages/domain/src/index.js";
import { signatureValid } from "../apps/api/src/commerce.js";
import { createHmac } from "node:crypto";
test("MRP 5000, selling 4000, promotion 10% produces 3600", () =>
  assert.equal(effectivePrice(400000, 1000), 360000));
test("paise allocation is exact and deterministic for partial refunds", () => {
  assert.deepEqual(allocate(100, [100, 100, 100]), [34, 33, 33]);
  for (let n = 0; n < 1000; n++)
    assert.equal(
      allocate(n, [43, 51, 97]).reduce((a, b) => a + b, 0),
      n,
    );
});
test("invalid monetary values and rates are rejected", () => {
  assert.throws(() => money(1.5));
  assert.throws(() => money(-1));
  assert.throws(() => effectivePrice(100, 10001));
});
test("coupon cap and subtotal floor are enforced", () => {
  assert.equal(
    couponDiscount(100000, {
      kind: "PERCENT",
      value: 2000,
      maxDiscount: 10000,
    }),
    10000,
  );
  assert.equal(
    couponDiscount(100, { kind: "FIXED", value: 500, maxDiscount: null }),
    100,
  );
});
test("commission precedence favors seller + category over category and default", () => {
  const rules = [
    { sellerId: null, categoryId: null, kind: "PERCENT", value: 1000 },
    { sellerId: null, categoryId: "c", kind: "PERCENT", value: 2000 },
    { sellerId: "s", categoryId: "c", kind: "FIXED", value: 500 },
  ];
  assert.equal(commissionFor(10000, "s", "c", rules).amount, 500);
  assert.equal(commissionFor(10000, "x", "c", rules).amount, 2000);
});
test("fulfillment cannot skip delivery stages or rewind shipped orders", () => {
  assertTransition("PACKED", "SHIPPED");
  assert.throws(() => assertTransition("CONFIRMED", "DELIVERED"));
  assert.throws(() => assertTransition("SHIPPED", "PACKED"));
});
test("signature uses exact raw body bytes and rejects malformed signatures", () => {
  const body = Buffer.from('{"hello":1}'),
    secret = "test-secret",
    signature = createHmac("sha256", secret).update(body).digest("hex");
  assert.equal(signatureValid(body, signature, secret), true);
  assert.equal(
    signatureValid(Buffer.from('{ "hello":1}'), signature, secret),
    false,
  );
  assert.equal(signatureValid(body, "invalid", secret), false);
});
