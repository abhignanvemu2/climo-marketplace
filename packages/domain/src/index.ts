export class BusinessError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export function check(
  ok: unknown,
  message: string,
  status = 400,
  code = "VALIDATION",
): asserts ok {
  if (!ok) throw new BusinessError(status, code, message);
}
export const MAX_MONEY = 1_000_000_000;
export function money(n: number) {
  check(
    Number.isSafeInteger(n) && n >= 0 && n <= MAX_MONEY,
    "Amount is outside the supported range",
  );
  return n;
}
export function effectivePrice(price: number, bps: number) {
  money(price);
  check(
    Number.isInteger(bps) && bps >= 0 && bps <= 10000,
    "Invalid discount rate",
  );
  return Math.floor((price * (10000 - bps) + 5000) / 10000);
}
export function allocate(total: number, weights: number[]) {
  money(total);
  weights.forEach(money);
  const sum = weights.reduce((a, b) => a + b, 0);
  if (!sum) {
    check(total === 0, "Cannot allocate against zero value");
    return weights.map(() => 0);
  }
  const raw = weights.map((w) => BigInt(total) * BigInt(w));
  const den = BigInt(sum);
  const out = raw.map((v) => Number(v / den));
  let left = total - out.reduce((a, b) => a + b, 0);
  const indices = raw
    .map((v, i) => ({ i, r: v % den }))
    .sort((a, b) => (a.r === b.r ? a.i - b.i : a.r > b.r ? -1 : 1));
  for (const { i } of indices) if (left-- > 0) out[i]++;
  return out;
}
export function couponDiscount(
  subtotal: number,
  coupon: { kind: string; value: number; maxDiscount: number | null },
) {
  const discount =
    coupon.kind === "PERCENT"
      ? Math.floor((subtotal * coupon.value + 5000) / 10000)
      : coupon.value;
  return Math.min(subtotal, coupon.maxDiscount ?? subtotal, discount);
}
export function commissionFor(
  price: number,
  sellerId: string,
  categoryId: string,
  rules: {
    sellerId: string | null;
    categoryId: string | null;
    kind: string;
    value: number;
  }[],
) {
  const rule = rules
    .filter(
      (r) =>
        (!r.sellerId || r.sellerId === sellerId) &&
        (!r.categoryId || r.categoryId === categoryId),
    )
    .sort(
      (a, b) =>
        Number(!!b.sellerId) * 2 +
        Number(!!b.categoryId) -
        (Number(!!a.sellerId) * 2 + Number(!!a.categoryId)),
    )[0];
  return {
    amount: Math.min(
      price,
      rule
        ? rule.kind === "PERCENT"
          ? Math.floor((price * rule.value + 5000) / 10000)
          : rule.value
        : 0,
    ),
    rule: rule ?? null,
  };
}
export const fulfillmentTransitions: Record<string, string[]> = {
  CONFIRMED: ["PROCESSING"],
  PROCESSING: ["PACKED"],
  PACKED: ["SHIPPED"],
  SHIPPED: ["OUT_FOR_DELIVERY"],
  OUT_FOR_DELIVERY: ["DELIVERED"],
};
export function assertTransition(from: string, to: string) {
  check(
    fulfillmentTransitions[from]?.includes(to),
    `Cannot move ${from} to ${to}`,
    409,
    "INVALID_TRANSITION",
  );
}
export const saleable = {
  status: "APPROVED",
  seller: { status: "ACTIVE", verification: "VERIFIED", vacation: false },
};
