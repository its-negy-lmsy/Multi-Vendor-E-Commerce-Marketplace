# Deployment and local services

## Local

Requires Node.js 20+, npm, and Docker Desktop/Compose. Copy `.env.example` to `.env`, choose a strong local `JWT_ACCESS_SECRET`, then run:

```powershell
docker compose -f infra/compose.yaml up -d
npm install
npm run seed:dev
npm run dev
```

Frontend: `http://localhost:5173`; API: `http://localhost:4000/api/v1`; development Swagger UI: `http://localhost:4000/docs`. Use the seeded customer `customer@fs01.local` / `CustomerDemo!2026`. For local admin access, set both `DEMO_ADMIN_EMAIL` and `DEMO_ADMIN_PASSWORD` (12+ characters) in `.env` before running the seed. Demo seed is disabled in production. Use `npm run build` for production bundles and `npm --workspace @fs01/api run start` with production env after building.

This workspace machine has no Docker executable or configured database. The Compose file and demo path have not been executed here; the API intentionally fails startup rather than silently substituting an in-memory database. After Elasticsearch is reachable, run `npm --workspace @fs01/api run search:reindex` to create the mapping and index all published MongoDB products. Search changes are then synchronized through the MongoDB outbox worker with bounded retries.

For a local test checkout, use the API to save an address and update the cart, then POST `/api/v1/checkout` with a unique `Idempotency-Key`. The response contains a mock payment reference. Run `npm --workspace @fs01/api run payment:mock-event -- <orderId> <reference> paid`, then use the printed JSON body and `X-Mock-Signature` header at `/api/v1/payments/mock/webhook`. This signed event only simulates a local test; it is not a Razorpay transaction.

## Managed deployment outline

- Deploy `apps/api` to a Node 20+ service with health check `/api/v1/health/ready`; deploy `apps/web` as static Vite output. Set `VITE_API_URL` at web build time and `WEB_ORIGIN` / CORS at API runtime.
- Use managed MongoDB replica set with backups and TLS. Use private Redis and Elasticsearch endpoints and separate least-privilege credentials. Do not expose service ports publicly.
- Configure HTTPS-only secure cookies, strong JWT key rotation, secrets manager, bounded service timeouts, log redaction, monitoring, and alerting.
- S3: create a private bucket, block public access, issue narrowly scoped presigned upload credentials, enforce MIME/size policy in API and verify uploaded bytes, configure lifecycle cleanup for abandoned temporary keys. The production upload adapter is not implemented yet.
- Razorpay: use test credentials and confirm account eligibility for Route/marketplace transfers before enabling payouts. Ordinary checkout does not provide vendor split settlement. No Razorpay credentials or account capability were present, so live provider setup is unverified and adapter remains pending.
- Configure provider-signed webhooks to a dedicated endpoint before enabling payments. A browser redirect is never payment proof.
- Backup/restore: enable managed point-in-time recovery, export sanitized seed fixtures separately, and rehearse restore to a staging database.

## Health checks

`GET /api/v1/health/live` checks process liveness. `GET /api/v1/health/ready` returns 200 only after MongoDB is connected. Redis/Elasticsearch readiness will be added when those adapters are used in request flows.
