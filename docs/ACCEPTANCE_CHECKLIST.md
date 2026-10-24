# Acceptance checklist — FS-01 Multi-Vendor Marketplace

## Implemented in the Current Milestone

- [x] **Zero-Config Database Engine:** Automatic dual-mode database connector (`apps/api/src/db.ts`). Connects to external MongoDB Atlas or Docker if reachable; automatically boots an embedded in-memory MongoDB replica for seamless local evaluation if no daemon is listening.
- [x] **Rich Seed Catalog:** 12 authentic artisan products across 4 categories with real Unsplash photography, 4 distinct vendors, 1 customer, 1 admin, 3 active promotional coupons, and verified buyer reviews.
- [x] **React Client-Side Routing:** Full `react-router-dom` configuration with navigation between Storefront (`/`), Product Detail (`/product/:id`), Order Tracking (`/orders`), Vendor Studio (`/vendor/dashboard`), and Admin Command Center (`/admin/dashboard`).
- [x] **Storefront & Product Discovery:** Search query filtering, category pills, price and rating sorting, quick "Add to Bag", and product cards linking to full details.
- [x] **Product Detail View:** Dedicated product page with high-res imagery, stock status, quantity picker, trust badges, verified customer reviews list, and interactive review submission.
- [x] **Multi-Vendor Cart & Checkout:** Slide-over bag drawer, line item quantity controls, saved shipping address selection and creation, active coupon promo application (`WELCOME10`, `FLAT500`, `FESTIVE25`) with instant discount recalculation, and 1-click test checkout.
- [x] **Order Lifecycle & Timeline Tracker:** Visual 4-stage fulfillment tracker (`Placed` $\rightarrow$ `Packed` $\rightarrow$ `Shipped` $\rightarrow$ `Delivered`) with tracking numbers, courier metadata, itemized line totals, and discount breakdown.
- [x] **Printable Tax Invoices:** System-generated HTML tax invoices with print/PDF support (`/api/v1/orders/:id/invoice`) containing platform GSTIN, vendor details, billing/shipping address, itemized tax lines, and payment references.
- [x] **Artisan Vendor Studio (`/vendor/dashboard`):**
  - Vendor onboarding application for prospective sellers (`applyVendor`).
  - Product Catalog Studio with stock manager, pricing in ₹, and status indicators.
  - Image upload adapter with local static fallback and S3 compatibility (`saveBase64Image`).
  - Order Fulfillment Management: Vendor actions to transition items from `UNFULFILLED` $\rightarrow$ `PACKED` $\rightarrow$ `SHIPPED` $\rightarrow$ `DELIVERED`.
  - Vendor Earnings & Ledger: Recorded payable balances and immutable ledger entries.
- [x] **Admin Command Center (`/admin/dashboard`):**
  - Real-time KPI Metric Cards: Gross Merchandise Value (GMV), Platform Commission Earned (10%), Completed Orders, and Active Vendors.
  - Vendor Onboarding Approvals: 1-click approve or reject vendor applicants.
  - Product Catalog Moderation: 1-click toggle to publish or archive platform listings.
  - Platform Analytics: Top-selling products and vendor sales breakdowns.
  - Coupon Management: Active promotional discount codes.
  - Immutable Audit Log Feed: Real-time record of all administrative operations.
- [x] **Role-Based Authentication & Demo Switcher:** JWT access tokens + HttpOnly rotating refresh session cookies. Includes 1-click demo buttons in Auth modal to switch between Buyer, Vendor, and Admin roles.
- [x] **Passing Test Suite & Production Build:** Vitest automated tests pass (10 API unit tests, 2 Web tests) and Vite/TypeScript production build succeeds with clean output bundles.
