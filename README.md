# Common Goods — FS-01 Marketplace

A multi-vendor marketplace capstone built around a considered, maker-first shopping experience. The working foundation includes a React storefront, modular Express API, MongoDB product and identity models, vendor approval/product moderation APIs, Redis cart caching, Elasticsearch product search/outbox sync, idempotent multi-vendor checkout, signed mock payments, and an unverified Razorpay Route checkout adapter.

## Current status

This is not yet the completed capstone. Core APIs exist but live services could not be exercised here. Vendor/admin dashboards, secure uploads, account recovery, coupons, reviews, PDF invoices, refunds, analytics UI, and payment settlement/reconciliation remain incomplete. The Razorpay adapter requires an enabled Route account and has not been tested with provider credentials. Checkout uses best-effort stock compensation until replica-set transaction/recovery hardening is added. Read [the acceptance checklist](docs/ACCEPTANCE_CHECKLIST.md) and [test report](docs/TEST_REPORT.md) for the verified scope.

## Architecture and docs

- [Implementation plan and architecture diagram](PLAN.md)
- [Data model](docs/DATA_MODEL.md)
- [OpenAPI 3.1 contract](docs/openapi.yaml) and development Swagger UI at `/docs`
- [Deployment guide](docs/DEPLOYMENT.md)
- [Acceptance checklist](docs/ACCEPTANCE_CHECKLIST.md)
- [10-minute presentation outline](docs/PRESENTATION_OUTLINE.md)
- [Individual reflection template](docs/REFLECTION_TEMPLATE.md)

The browser client uses React, TypeScript, Vite, React Router, Redux Toolkit and RTK Query. The API uses Node.js, TypeScript, Express, Mongoose, Zod validation, bcrypt password hashing, JWT access tokens, hashed atomic refresh-session rotation, Helmet, CORS and endpoint rate limiting. See [architecture](PLAN.md) for the service relationship diagram.

## Requirements

- Node.js 20 or later and npm.
- MongoDB, Redis and Elasticsearch for local infrastructure. Docker Compose is provided in `infra/compose.yaml`.
- Copy `.env.example` to `.env` and replace the local JWT secret before running.

## Start locally

```powershell
Copy-Item .env.example .env
docker compose -f infra/compose.yaml up -d
npm install
npm run seed:dev
npm run dev
```

Web: <http://localhost:5173>. API: <http://localhost:4000/api/v1>. Swagger: <http://localhost:4000/docs>. The seeded demo customer is `customer@fs01.local` with password `CustomerDemo!2026`; only use this fictional account locally. To create a local administrator, set both `DEMO_ADMIN_EMAIL` and a unique `DEMO_ADMIN_PASSWORD` (12+ characters) in `.env` before seeding. Seed command refuses to run in production.

The current environment did not have Docker installed or MongoDB running, so the live MongoDB-backed demo has not been executed here. The API requires MongoDB and reports readiness honestly rather than switching to in-memory persistence.

## Useful commands

```powershell
npm run typecheck
npm test
npm run build
npm run seed:dev
```

`npm run build` creates `apps/api/dist` and `apps/web/dist`. Run the API in a configured deployment with `npm --workspace @fs01/api run start`, and publish the static frontend bundle separately. Configure `VITE_API_URL` in the frontend environment (see `apps/web/.env.example`) and `WEB_ORIGIN` for API CORS.

After `npm run seed:dev`, sign in as `maker@fs01.local` / `MakerDemo!2026` to use the approved fictional vendor. Local test payment events can be signed with `npm --workspace @fs01/api run payment:mock-event -- <orderId> <reference> paid`; the command prints a payload and signature for the webhook route. Mock transactions are not provider payments or vendor settlements.

## Security notes

- Registration always creates a customer; role is never accepted from the public body.
- Passwords use bcrypt with cost 12; raw refresh values are only delivered in HttpOnly SameSite cookies and stored as SHA-256 hashes.
- API privileges are based on a verified signed JWT and server-side role middleware.
- Money uses integer paise in product records. Checkout must reload authoritative prices before it is implemented.
- The development compose file disables Elasticsearch security for localhost use only. Never expose those ports in production.
- Keep actual provider/cloud secrets in a secrets manager or ignored local env file. No credentials are committed.

## Limitations

Identity currently covers customer register/login/refresh/logout and sample administrator authorization. Product routes support vendor-managed edits with moderation. The browser refreshes expired access tokens. Redis and Elasticsearch adapters are connected with MongoDB fallbacks; S3 uploads are not integrated. Razorpay Route can create orders with held vendor transfers and confirm captured payments via its signed webhook, but account onboarding, transfers, refunds and settlement are not verified or complete. See the deployment guide for external service setup and current blockers.
