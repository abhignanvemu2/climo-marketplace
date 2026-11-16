# Deployment and operations

These are deployment assets, not evidence of a live deployment. The production release is blocked by the incomplete items in feature-status.md.

## Environments

Use separate databases, buckets, gateway credentials and email domains for development, staging and production. Keep the API and worker in the same private database network. Run an externally managed PostgreSQL instance with restricted roles and backups. The sample Compose credentials are local-only. TLS must terminate at the ingress; production cookies require HTTPS. Set ALLOWED_ORIGINS to exact frontend origins.

Build the three frontend targets and the API/worker targets using the Dockerfile. Use an `api` service DNS name or modify the Nginx upstream for your platform. Run `npm run db:migrate` as a deployment job before starting compatible application images. Never run development seeding in production.

The current API image retains development build tools for reproducibility. A hardened release should produce a reduced runtime image, scan it, set memory/process limits, configure readiness/liveness probes and run under a restricted DB role. No cloud deployment was attempted.

## Payments and reconciliation

Enable gateway automatic capture and configure the signed payment.captured webhook. Do not mark an order paid from browser callbacks alone. The callback verifier fetches authoritative payment data before confirming it. Provider order creation is attempted once; if a call times out after it may have succeeded, the order remains awaiting reconciliation. A dedicated order-creation recovery interface is still required before launch.

Late captured payments do not consume expired stock. They are routed to review and refund eligibility. Refund execution is disabled by default; Finance authorization does not by itself send money. The refund reconciliation endpoint can look up a refund by stored provider ID or the receipt attached during creation. Failed/unknown provider outcomes require Finance investigation; they must never be retried with a new receipt without checking provider history.

Weekly batch preparation runs Monday at 10:00 Asia/Kolkata and is idempotent by seller/week. Current code conservatively excludes any suborder with after-sales requests or refunds. Final fee, reserve, refund adjustment and payout-account rules are pending. Do not use current batches for live disbursements.

## Recovery and monitoring

Back up PostgreSQL before migration, configure point-in-time recovery and test restore into a separate environment. Retention periods, RPO/RTO targets and restore schedules require a business decision. They are not implemented by this repository. Monitor API 5xx, database availability, reservation cleanup age, payment review backlog, refund processing age and worker liveness. `/health` is process health; `/ready` checks PostgreSQL only.

The current rate limiter is process-local and current worker scheduling is polling-based. Add the approved Redis-backed durable queue and distributed rate limiter before scaling beyond a single API instance. External email, tracking, AI and file-storage adapters are not implemented merely by supplying env variables.
