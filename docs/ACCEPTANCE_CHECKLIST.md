# Acceptance checklist

## Implemented in the current foundation

- [x] React/TypeScript/Vite storefront; Redux Toolkit RTK Query API layer and responsive product grid.
- [x] Express/TypeScript modular v1 API with request validation, error shape, rate limit, security headers and health endpoints.
- [x] MongoDB Mongoose user, refresh-session and published-product schemas with indexes/validation.
- [x] Customer registration/login, bcrypt password hash, short-lived JWT and hashed, rotating HttpOnly refresh-session endpoint.
- [x] Role checks demonstrated with admin-only route; client cannot set registration role.
- [x] Public catalog loads from MongoDB and explicitly reports `mongodb-fallback` for the search engine.
- [x] Vendor application review, admin approval/rejection/suspension, audit events, vendor-owned product CRUD/moderation.
- [x] MongoDB-persisted cart with Redis cache fallback and server-side multi-vendor checkout pricing, commission snapshots, idempotency key and atomic stock reservations.
- [x] Development-only HMAC-signed mock payment webhook, customer order history, vendor item-scoped fulfillment and payable ledger.
- [x] Elasticsearch product search/index mapping, MongoDB outbox retries, explicit MongoDB fallback and MongoDB visibility revalidation.
- [x] Admin aggregation summary and audit-log API; vendor balance is marked payable and not settled.
- [x] Seeded fictional catalog/customer and setup, architecture, data model, OpenAPI, deployment, presentation and reflection documentation.

## Partial / not complete

- [x] Refresh token rotation uses an atomic compare-and-revoke update to prevent parallel reuse.
- [ ] Protected account/dashboard routes and product detail UI; frontend refresh-on-401 is implemented.
- [ ] Secure local/S3 uploads, product detail UI and vendor/admin dashboards.
- [ ] Coupon application and reservation/checkout recovery worker; current stock compensation is best-effort and critical writes need replica-set transaction hardening.
- [ ] Real Razorpay marketplace adapter, signed production webhook, refund reversals and provider settlement.
- [ ] Reviews, actual PDF invoice generation, commission/coupon configuration and analytics dashboard UI.
- [ ] Meaningful automated tests, executed production build, browser verification/screenshots and security review.
- [ ] Independent deployments and live third-party integration credentials.

## Blockers / manual setup

- MongoDB/Redis/Elasticsearch processes unavailable in this environment; Docker is not installed.
- No AWS, Razorpay, deployment or email credentials/account configuration available.
- MongoDB-backed route tests could not run because the local test binary download stalled; current tests do not assert persistence.

This is an honest foundation milestone, not yet ready for capstone evaluation.
