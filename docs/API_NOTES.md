# Backend contract for frontend work

Scope: static inspection of route registration/handlers, input schemas, auth/access code, error handling, Prisma field types, Supabase config, and shared-package public exports/declarations. Business service implementations, tests, migrations, and package implementation bodies were not inspected; the app, builds and tests were not run. Public contract declarations describe intended response fields; service-produced responses and service-only checks are not independently verified here.

## Connection and authentication

- API origin defaults to `http://127.0.0.1:3001` (`PORT`, bound to loopback); every endpoint below has prefix `/api/v1`.
- API startup uses server-only `DATABASE_URL`, `SUPABASE_URL`, optional `SUPABASE_PUBLISHABLE_KEY` (needed for legacy HS256 and invitation email verification), and `SUPABASE_SERVICE_ROLE_KEY` for photos. Never expose database/service-role credentials to the browser.
- No frontend environment variable is defined by backend code. Suggested new Vite convention: `VITE_API_BASE_URL=/api/v1` with a same-origin development proxy to the API; this is a recommendation, not existing configuration. No CORS plugin/allow-list or OPTIONS handler is registered; direct cross-origin bearer requests need a proxy or approved backend CORS work.
- Protected routes require `Authorization: Bearer <Supabase access token>`; the API neither reads nor sets session cookies. JSON mutations use `Content-Type: application/json`.
- No API login, logout, signup, session, or refresh endpoints exist. `GET /me/contexts` lists available workspaces, not an auth session. A frontend-only API auth flow therefore cannot currently be implemented without an additional auth integration decision.
- Verification uses Supabase issuer `${SUPABASE_URL}/auth/v1`, audience/role `authenticated`, UUID subject, and expiration; anonymous identities are rejected. ES256/RS256 use JWKS; legacy HS256 uses Supabase's `/auth/v1/user` verification.
- Missing, invalid, or expired tokens return 401 `UNAUTHENTICATED`, with `WWW-Authenticate: Bearer`; API does not refresh tokens. Auth infrastructure failure returns 503 `AUTH_UNAVAILABLE`. Supabase config sets JWT lifetime to 3600 seconds and refresh-token rotation on (10-second reuse interval).
- Store access requires an active organization membership AND active store assignment, checked against PostgreSQL on requests; invalid/inaccessible scope returns 403 without revealing its existence. Roles are `OWNER` and `SALESPERSON`.
- Both assigned roles reach product/sale handlers. Organization management is owner-oriented via the shared owner guard; individual service calls to that guard are outside this inspection. Acquisition-cost visibility is controlled by `salespersonCanViewAcquisitionCost` (default false); actual product redaction lives in uninspected service/presenter code.
- Protected route group sends `Cache-Control: private, no-store`. Health is public.

## Errors and validation

- Application error JSON is exactly `{ "code": string, "message": string }`, optionally with `"field": string`; no outer `error` envelope. Messages are Azerbaijani. A validation example is `{ "code": "INVALID_SALE", "message": "Satış məlumatlarını yoxlayın.", "field": "saleAmount" }`.
- 400: `INVALID_ONBOARDING`, `INVALID_MEMBERSHIP`, `INVALID_SETTINGS`, `INVALID_PRODUCT`, `INVALID_SALE`, `SALE_PAYMENT_TOO_LOW`, `SALE_PAYMENT_NOT_DUE`.
- 401: `UNAUTHENTICATED`; 403: `ACCESS_DENIED`.
- 404: `PRODUCT_NOT_FOUND`, `SALE_NOT_FOUND`.
- 409: `INVITATION_UNAVAILABLE`, `PURITY_CONFLICT`, `PRODUCT_CODE_CONFLICT`, `PHOTO_CONFLICT`, `SALE_CONFLICT`.
- 503: `AUTH_UNAVAILABLE`, `PHOTO_UNAVAILABLE`; unexpected errors in protected group become 500 `INTERNAL_ERROR` with `{code,message}`.
- No registered route supplies Fastify JSON Schema and no Zod schema is used. Validation is manual: shared `parseOnboarding`, `parseProductCreate`, `parsePurity`, `parseRate`, route checks, auth UUID checks, and backend `parseSaleInput`. TypeScript interfaces alone do not validate requests.
- Invalid onboarding is a direct 400 `{code,message}` response; product/sale validation may include `field`, others usually do not. No validation issue array exists. Non-`AccessError` failures (including malformed JSON in the protected plugin) map to 500 instead of preserving their Fastify status. Unmatched routes/default Fastify errors outside this handler can use Fastify's `{statusCode,error,message}` shape.
- Route-level validation gaps: `GET /health` has no input checks; `GET /me/contexts` checks identity only; membership listing, invitation revoke/resend, member activate/deactivate and store assign/remove do not validate params locally; settings GET does not validate params locally.
- Product detail/photo-upload and sale detail delegate ID checks; sales listing delegates query validation; product/sale options validate scope only; onboarding/product/rate parsers and service-only checks are not audited beyond their public entry points. These are inspection limits, not proof that downstream validation is absent.

## Numbers, lists, retries

- Money and weights in public contracts are decimal **strings**; never use `parseFloat`. Money object (`Money`) is `{amount:string,currency:string}`. AZN uses 2 minor-unit digits; existing code supports other ISO currencies, so do not assume every amount is AZN.
- Sale input enforces currency minor-unit precision, weight up to 3 decimal places (12 integer digits), exchange rate up to 8 (12 integer digits), and amount up to 16 integer digits. Purity is an integer JSON number, 1–999 (fineness), not a fractional percentage. Product/purity options also return numbers.
- Database precision is not display precision: weight `Decimal(15,3)`; acquisition cost/sale/payment amount `(20,4)`; gold rate `(18,4)`; exchange rate `(24,8)`; settlement/change/converted amounts `(32,4)`; trade-in calculated/accepted values `(32,15)`. Default sale amount uses `(28,4)`. No Prisma Float fields were found.
- Response contracts declare strings but do not promise fixed trailing-zero padding; preserve exact values. `roundMoneyHalfUp` is exported, but service calculation/rounding implementation was not inspected.
- Product list query: `organizationId`, `storeId`, optional `q` (trimmed, max 160), `status=IN_STOCK|SOLD`, `category` (max 80), `purity` (integer query string), `after` (nonempty, max 80), `facets=1`. Other `facets` values act as false. NUL is rejected in q/category/after.
- Sale list accepts scoped `q`, `date`, `after`; their validation, date timezone, cursor encoding, page sizes, and ordering are service-defined and unverified. Both list contracts return `{items,nextCursor?}`; pass `nextCursor` unchanged as `after`. No route-level limit/page/sort convention is exposed; do not invent one.
- `POST /sales` requires `Idempotency-Key` matching `[A-Za-z0-9._:-]{1,128}`. Schema uniqueness scope is organization/store/actor/key; request digest is stored. Preserve key and payload on uncertain retries; replay/conflicting-payload behavior lives in the service and was not audited. No other mutation has route-level idempotency-key support.

## Endpoints

All paths below are relative to `/api/v1`. `Auth` = authenticated identity; `Store` = Auth + active scoped assignment (either role); `Owner*` = owner management intent, service enforcement not verified here. Every product/sale endpoint also requires query `organizationId` and `storeId`. `O` abbreviates `/organizations/:organizationId`. `—` means no body. Contract names are expanded below.

| Module | Method/path | Purpose | Access | Body fields | Response fields/contract |
| --- | --- | --- | --- | --- | --- |
| Health | GET `/health` | Liveness | Public | — | `{status:"ok"}` |
| Access | GET `O/stores/:storeId/access` | Verify current store access | Store | — | `{userId,organizationId,storeId,role,settings:{defaultCurrency,salespersonCanViewAcquisitionCost}}` |
| Onboarding | POST `/onboarding` | Create initial workspace | Auth | `organizationName,storeName,defaultCurrency` | `OnboardingResult` |
| Onboarding | GET `/me/contexts` | List accessible workspaces | Auth | — | `StoreContext[]` |
| Memberships | GET `O/memberships` | List staff/invites/stores | Owner* | — | `MembershipDirectory` |
| Memberships | POST `O/invitations` | Invite salesperson | Owner* | `email,storeId` | `InvitationSummary` + `delivery` |
| Memberships | POST `O/invitations/:id/revoke` | Revoke invite | Owner* | — | `InvitationSummary` + `delivery` |
| Memberships | POST `O/invitations/:id/resend` | Replace/resend invite | Owner* | — | `InvitationSummary` + `delivery` |
| Memberships | POST `O/members/:userId/deactivate` | Deactivate member | Owner* | — | Service result; no route response schema |
| Memberships | POST `O/members/:userId/reactivate` | Reactivate member | Owner* | — | Service result; no route response schema |
| Memberships | POST `O/members/:userId/stores/:storeId/assign` | Assign store | Owner* | — | Service result; no route response schema |
| Memberships | POST `O/members/:userId/stores/:storeId/remove` | Remove store access | Owner* | — | Service result; no route response schema |
| Memberships | POST `/invitations/accept` | Accept invite for verified email | Auth | `token` (43 URL-safe characters) | Service result; no route response schema |
| Settings | GET `O/settings` | Read trading settings | Owner* | — | `TradingSettings` |
| Settings | POST `O/settings` | Set cost visibility | Owner* | `salespersonCanViewAcquisitionCost:boolean` only | Service result; public `OrganizationSettings` |
| Settings | POST `O/purities` | Add purity | Owner* | `value` | Service result; public `PurityGrade` |
| Settings | POST `O/purities/:value/deactivate` | Deactivate purity | Owner* | — | Service result; public `PurityGrade` |
| Settings | POST `O/purities/:value/reactivate` | Reactivate purity | Owner* | — | Service result; public `PurityGrade` |
| Settings | POST `O/rates` | Append old-gold rate | Owner* | Parsed by `parseRate`; public rate fields `purity,currency,amountPerGram` (parser internals not inspected) | Service result; public `OldGoldRate` |
| Products | GET `/products` | Filter inventory | Store | — | `ProductList` |
| Products | POST `/products` | Create item | Store | `code,name,category,purity,weight,acquisitionCost:Money,note?` | 201 `ProductDetail` |
| Products | GET `/products/options` | Creation options | Store | — | `{defaultCurrency,purities:number[]}` |
| Products | GET `/products/:id` | Detail + movements | Store | — | `ProductDetail` |
| Products | POST `/products/:id/photo-upload` | Start signed upload | Store | — | `ProductPhotoUpload` |
| Products | POST `/products/:id/photo-confirm` | Confirm uploaded photo | Store | `uploadId` UUID only | Service result; no route response schema |
| Sales | POST `/sales` | Sell item, optional old gold/payment | Store | `SaleCreateInput`; required idempotency header | 201 service result; public `SaleResult` |
| Sales | GET `/sales` | Sale history | Store | — | `SaleList` |
| Sales | GET `/sales/options` | Trading/payment options | Store | — | Service result; no exported options contract or route response schema |
| Sales | GET `/sales/:id` | Persisted sale | Store | — | Service result; public `SaleResult` |

No separate inventory-movement, return, old-gold exchange, stock-adjustment, customer, report, login/session, or general user CRUD endpoints are registered. Movements are nested in product detail; old-gold trade-ins are nested in sales.

### Public response/request field reference

- `OnboardingResult`: `organizationId,storeId,membershipId`. `StoreContext`: `organizationId,organizationName,storeId,storeName,role`.
- `MembershipDirectory`: `stores:{id,name}[]`, `invitations:InvitationSummary[]`, `members:{userId,email:string|null,status,storeIds:string[]}[]`.
- `InvitationSummary`: `id,email,storeId,status,expiresAt`; status `pending|accepted|expired|revoked`; delivery `sent|failed|not_sent`; member status `active|inactive`.
- `OrganizationSettings`: `defaultCurrency,salespersonCanViewAcquisitionCost`; `PurityGrade`: `value,active`; `OldGoldRate`: `id,purity,currency,amountPerGram,effectiveAt,current`; `TradingSettings`: `settings:OrganizationSettings,purities:PurityGrade[],rates:OldGoldRate[]`.
- `ProductListItem`: `id,code,name,category,purity,weight,status`; `ProductList`: `items:ProductListItem[],nextCursor?,filters?:{categories:string[],purities:number[]}`.
- `ProductDetail`: ProductListItem + `acquisitionCost?:Money,note:string|null,createdAt,photo:{url,contentType,size}|null,movements:{id,kind,actorId,createdAt}[],sale:{id,total:Money,createdAt}|null`. Movement kinds: `PRODUCT_ADDED|PRODUCT_SOLD|OLD_GOLD_RECEIVED`.
- `ProductPhotoUpload`: `uploadId,uploadUrl`; signed upload transport/content restrictions and confirmation response are service-defined, not established by route code alone.
- `SaleCreateInput`: `productId,saleAmount,expectedCurrency?,tradeIns?:{purity,weight,rateId,overrideAmount?}[],payment?:{currency,amount,exchangeRate?}`. At most 100 trade-ins; same-currency exchangeRate must equal 1 (defaults to `"1"`); foreign payment requires it. Currency mismatch with expectedCurrency throws `SALE_CONFLICT` on `currency`.
- Explicit tender must cover the final balance after trade-ins (`SALE_PAYMENT_TOO_LOW`, field `payment.amount`) and is only accepted when a balance is due (`SALE_PAYMENT_NOT_DUE`, field `payment`). If tender is omitted, a positive balance is recorded as paid in the sale currency.
- `SaleResult`: `id,actorId,createdAt,currency,saleAmount,tradeInTotal,balance,payout,payment:{currency,amount,exchangeRate,convertedAmount,change}|null,product:{id,code,name,category,purity,weight,status:"SOLD"},tradeIns:{id,purity,rateId,weight,appliedRate,calculatedValue,acceptedValue,overridden}[]`.
- `SaleList`: `{items:{id,createdAt,actorId,currency,saleAmount,product,balance,paymentCurrency:string|null}[],nextCursor?}`; `product` matches SaleResult.product. Date fields in public response contracts are strings; no route response serializer enforces a timestamp format.

## OpenAPI, Supabase, shared packages

- No OpenAPI/Swagger registration or spec endpoint exists in API registration. This document is a manually maintained contract.
- `supabase/config.toml` configures local PostgreSQL, Auth, private Storage (`product-photos`, 5 MiB, JPEG/PNG/WebP), Studio, SMTP and other Supabase services; it is not hosting-only. Data API exposes `public,graphql_public`, not Prisma's private `mizan` schema. Config enables Supabase migration/seed runners, but application schema ownership is Prisma (per project guidance); migration contents were not inspected.
- Frontend business reads/writes must use Fastify, never Supabase Data API or Prisma. Current authentication depends on Supabase, and photo responses expose signed URLs; a blanket claim that the browser never contacts Supabase cannot be established. API-only authentication requires missing proxy/session endpoints or an approved direct Auth exception.
- Only packages are `@mizan/contracts` and `@mizan/database`. Both root exports map types to `src/index.ts` and runtime to `dist/index.js`; no subpath exports. Package manifests were checked solely to establish their public entry points and browser dependencies.
- `@mizan/contracts` is browser-safe at its public dependency surface: imports are relative to its own modules, no runtime dependencies, Node-only imports or Prisma dependencies. It exports plain TypeScript types/interfaces, manual parser functions and constants, **not Zod schemas**. Add `"@mizan/contracts": "workspace:*"` to web dependencies when integrating; runtime dist must be built before consumption. No dependency was changed here.
- Contracts exports (names only, grouped by module):
  - decimal: `DecimalString`, `parseDecimal`, `roundMoneyHalfUp`.
  - money: `MoneyInput`, `currencyMinorUnits`, `parseMoney`.
  - onboarding: `OnboardingRequest`, `OnboardingResult`, `StoreContext`, `parseOnboarding`.
  - memberships: `InvitationStatus`, `MembershipStatus`, `InvitationDelivery`, `StoreOption`, `InvitationSummary`, `SalespersonSummary`, `MembershipDirectory`, `invitationTokenPattern`, `normalizeInvitationEmail`.
  - settings: `defaultPurities`, `OrganizationSettings`, `PurityGrade`, `OldGoldRate`, `TradingSettings`, `parsePurity`, `parseRate`.
  - products: `ProductStatus`, `ProductCreateInput`, `ProductListItem`, `ProductDetail`, `ProductList`, `ProductPhotoUpload`, `ProductPhotoConfirmInput`, `parseProductCreate`.
  - sales: `SaleCreateInput`, `SaleList`, `SaleResult`.
- `@mizan/database` exports `createDatabase`, `Prisma`; depends on Prisma/PostgreSQL libraries and is **backend-only**. Never import it or `packages/database` into `apps/web`.

## Findings / inspection limits

- Browser integration is incomplete: no CORS registration, API auth/session endpoints, or backend-defined frontend env names; proxy/Auth configuration needs an explicit implementation decision.
- Error behavior is inconsistent: non-AccessError failures become 500, field hints are optional, and unmatched routes can use Fastify's default envelope.
- No route JSON Schema/OpenAPI exists; local validation gaps and delegated validation are listed above. Several response fields/options and pagination rules require a later targeted service inspection.
- Owner checks, acquisition-cost redaction, mutation transactions, service arithmetic and idempotent replay were outside the permitted service inspection; no claim of missing transactions/permission checks or float arithmetic is made. Prisma financial fields are Decimal, and store access checks are verified.
- Existing organization/store roles and multi-currency contract remain documented as shipped; this task makes no scope or behavior changes.
