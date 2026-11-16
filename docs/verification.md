# Verification evidence — 16 November 2026

## Passed

- TypeScript strict typechecking.
- All three Vite production builds: customer, seller and admin/Finance.
- 7 unit tests: paise pricing, exact proportional allocation, invalid amounts, coupon caps, commission precedence, fulfillment transitions, exact raw-body HMAC signatures.
- 17 API integration tests on an actual temporary PostgreSQL 18.1 instance with the shipped migration:
  1. Approved/active catalog visibility and safe seller fields.
  2. Registration cannot assign privileged roles.
  3. Finance isolation, dictionary restrictions and CSRF rejection.
  4. Seller suspension blocks listings and checkout; reactivation restores eligibility.
  5. Price proposals do not change live prices before approval.
  6. Two simultaneous checkouts cannot reserve one stock unit twice.
  7. Checkout idempotency and cross-customer order access denial.
  8. Concurrent redemption cannot exceed the last coupon use.
  9. Capture deduplication, protected payment state, PDF receipt, cancellation/refund authorization.
  10. Amount/currency mismatch leaves payment pending.
  11. Late capture routes to refund liability without consuming expired stock.
  12. Verified-review and out-of-stock-request eligibility.
  13. Audit and ledger UPDATE/DELETE are rejected by database triggers.
  14. Pending product revisions preserve the public approved version.
  15. Stock-request routing cannot skip Admin/seller stages or create an order.
  16. Fulfillment cannot skip states; inspected returns create eligibility without sending money.
  17. Internal support notes and another customer's ticket are protected.
- `npm audit --audit-level=high`: 0 reported vulnerabilities after dependency updates. This is a point-in-time dependency report, not a security certification.

## Dependency repair

Updated Prisma/client to 6.19.3, Vite to 7.3.8, React Router DOM to 7.18.5, express-rate-limit to 8.7.4 and Zod to 4.6.7. Removed unused concurrently. Prisma's configuration dependency is overridden to deepmerge-ts 8.0.2 to avoid the recursive-merge advisory. Client generation, SQL migration, builds and integration tests were rerun with the override; keep these checks when changing Prisma.

## Not verified

- Live Razorpay payment/refund calls and merchant sandbox acceptance; integration tests exercise internal payment-event handling with test data.
- Any actual seller payout, shipping-provider request, AI response, email delivery or media upload.
- Docker images in a Docker runtime.
- Full browser E2E, visual/mobile layout or accessibility behavior. Managed preview failed during startup because the environment rejected Node's `uv_interface_addresses` call. No successful browser render is claimed.
- Production deployment, independent security review, load benchmarks, backup/restore drills or legal/tax correctness.

Verification above was performed locally before publication. The source repository is https://github.com/abhignanvemu2/climo-marketplace. See its commit history for publication and subsequent changes.
