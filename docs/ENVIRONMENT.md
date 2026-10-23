# Environment reference

Copy `.env.example` to `.env`. Empty optional values are accepted. Never commit an actual `.env` file.

| Variable | Default | Notes |
|---|---|---|
| `NODE_ENV` | `development` | Use `production` only with required secrets and real infrastructure; production refuses local mock payments. |
| `API_PORT` | `4000` | Express port. |
| `WEB_ORIGIN` | `http://localhost:5173` | Exact allowed browser origin for credentialed CORS. |
| `MONGODB_URI` | local `fs01` database | Required by runtime; source of truth. Production must supply an explicit URI. Checkout currently uses atomic stock updates and compensation; a production replica set and transaction hardening are required. |
| `REDIS_URL` | `redis://localhost:6379` | Cart projection cache, 30-day TTL; MongoDB is the persistent fallback. |
| `ELASTICSEARCH_URL` | `http://localhost:9200` | Product search index endpoint. Product changes enter MongoDB outbox and get bounded retries; search revalidates results in MongoDB. |
| `JWT_ACCESS_SECRET` | development-only placeholder | Set a unique random secret, at least 32 characters. Production startup rejects the default. |
| `JWT_ACCESS_TTL` | `15m` | Short-lived signed access token. |
| `REFRESH_TOKEN_DAYS` | `30` | Hashed database refresh session expiry; cookie is HttpOnly and SameSite=Lax. |
| `PLATFORM_COMMISSION_BPS` | `1000` | Basis points (1000 = 10%), bounded to 0–10000. Captured per order item. |
| `COOKIE_SECURE` | `false` | Local HTTP only; production cookies are Secure regardless. |
| `PAYMENT_PROVIDER` | `mock` | Local signed webhook simulation only. Razorpay test/live adapter is not implemented. Production rejects `mock`; do not claim provider checkout or settlement is live. |
| `MOCK_PAYMENT_WEBHOOK_SECRET` | local placeholder | Replace with a random secret for local demonstrations. Never expose to the frontend. |
| `DEMO_ADMIN_EMAIL` | unset | Optional; must be set together with password for a development-only seed admin. |
| `DEMO_ADMIN_PASSWORD` | unset | Optional; minimum 12 characters; never committed. Seed refuses production. |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | unset | Reserved for a future approved provider adapter; no account/credentials were available. |
| `AWS_REGION`, `AWS_S3_BUCKET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | unset | S3 upload integration is pending; use a least-privilege role in deployment rather than long-lived keys. |
| `VITE_API_URL` | `http://localhost:4000/api/v1` | Frontend build-time API base URL. |

Credentials for email verification, password reset delivery and managed Elasticsearch are not wired yet. Those features are not enabled by environment variables alone.
