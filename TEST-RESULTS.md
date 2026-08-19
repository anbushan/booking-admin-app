# Test results — rate limiting / load balancing / Redis caching change

**Date:** 2026-08-19
**Scope tested:** backend (full functional regression + new-infra sanity), admin (build + smoke), mobile (static checks only — see note).
**Result: all executable checks passed — 0 failures.** See "What this does NOT cover" before deploying, and the Verdict section for what's still needed before this reaches production.

---

## 1. Sanity — the three things this change actually added

Manually verified against the running local backend (Postgres `carpool_dev` + local Redis), described in full in `backend/DEPLOY.md`.

| # | Area | Test | Method | Expected | Actual | Result |
|---|------|------|--------|----------|--------|--------|
| 1 | Rate limiting | General limiter applies to every route | `GET /health` × several | `RateLimit-*` headers present, 200s | Present, 200 | ✅ PASS |
| 2 | Rate limiting | Auth limiter blocks past 20 req/15 min per IP | 25× `POST /api/auth/verify-otp` from one IP | First ~20 succeed/fail on business logic, rest 429 | 19 passed business logic (1 slot pre-used by an earlier call), then 429 from request 20 onward | ✅ PASS |
| 3 | Rate limiting | Redis-backed, not per-process | Inspected `rl:*` keys in Redis directly | Keys exist under `rl:general:`/`rl:auth:`/`rl:payments:` prefixes | Confirmed present with correct prefixes | ✅ PASS |
| 4 | Redis caching | `appConfig.js` cache round-trips through Redis | Called `getAppConfig()` directly, inspected `cache:app-config` key | Config JSON present in Redis, correct values | Present, `platformFeePercent: 10` etc. matched DB row | ✅ PASS |
| 5 | Redis caching | `userCache.js` role-switch invalidation is instant | E2E case #14 below | Next request after `PUT /me/role` reflects new role immediately | Reflected immediately | ✅ PASS |
| 6 | Load balancer | PM2 cluster mode boots cleanly (ESM entrypoint) | `pm2 start ecosystem.config.cjs` | All 8 workers (one per core) `online`, 0 restarts | 8/8 online, 0 restarts, no errors in any worker's error log | ✅ PASS |
| 7 | Load balancer | Cluster actually serves traffic | 10× `curl /health` while cluster running | All 200 | All 200 | ✅ PASS |
| 8 | Load balancer | Cron guard prevents duplicate cron execution | Reviewed worker logs for the `isCronWorker` boundary | Only worker 0 would fire the `setInterval`s | Code inspected + all 8 workers started clean; no duplicate-side-effect signal in logs | ✅ PASS |
| 9 | Load balancer | Socket.IO Redis adapter wires up without error | Cluster boot logs (adapter connects on `attachSocketServer`) | No connection errors on any of the 8 workers | None | ✅ PASS |
| 10 | Regression | Single-process dev mode still works unmodified | `npm run dev` after all changes | Boots, `/health` 200 | Boots, 200 | ✅ PASS |

Cluster mode was stopped after verification and the box was returned to normal single-process `npm run dev`, matching the existing local workflow — nothing was left running in cluster mode.

---

## 2. Backend — full functional regression (automated)

Real HTTP + Socket.IO calls against the actual API, real Postgres dev DB, real Redis — using the app's own dev-mode test hooks (`DEV_TEST_NUMBERS`, `ALLOW_MOCK_PAYMENT_CONFIRM`, `EKO_MOCK_MODE`, `WEATHER_MOCK_MODE`) so no real SMS/payment/verification provider was touched. Full driver+passenger journey: signup → vehicle → publish ride → book → accept → pay → chat → start trip → OTP handoff → live location → complete → review, plus every other route group and the authz/authn edge cases.

Repeatable via `cd backend && npm run test:e2e` (harness: `backend/test/e2e.mjs`). Note: back-to-back runs under ~30s apart will show a few `Auth` failures — that's the real per-phone OTP resend cooldown and/or the new IP rate limiter correctly doing their job against the script's own repeated calls, not a bug.

**54 / 54 passed.**

| Area | Test | Result | Detail |
|---|---|---|---|
| Infra | `GET /health` | ✅ PASS | |
| Infra | `GET /api/app-status` | ✅ PASS | |
| Infra | `GET /api/i18n/locales` | ✅ PASS | |
| Infra | `GET /api/i18n/en` | ✅ PASS | |
| Auth | `send-otp` (driver test number) | ✅ PASS | status=200 |
| Auth | `verify-otp` (driver test number) | ✅ PASS | status=200 |
| Auth | `send-otp` (passenger test number) | ✅ PASS | status=200 |
| Auth | `verify-otp` (passenger test number) | ✅ PASS | status=200 |
| Auth | wrong OTP is rejected | ✅ PASS | status=400 |
| Users | `PUT /api/users/me` — driver registers | ✅ PASS | |
| Users | `PUT /api/users/me` — passenger registers | ✅ PASS | |
| Users | `GET /api/users/me` | ✅ PASS | |
| Users | `PUT /api/users/me/role` | ✅ PASS | |
| Users | role-switch visible on the very next request (Redis cache correctness) | ✅ PASS | role=PASSENGER |
| Vehicles | `POST /api/vehicles` | ✅ PASS | status=201 |
| Vehicles | `GET /api/vehicles` | ✅ PASS | |
| Rides | `POST /api/rides` (publish) | ✅ PASS | status=201 |
| Rides | `GET /api/rides/my` | ✅ PASS | |
| Rides | `GET /api/rides/search` | ✅ PASS | status=200 |
| Rides | fare-cap rejects an unreasonable price | ✅ PASS | status=400 |
| Bookings | `POST /api/bookings` | ✅ PASS | status=201 |
| Bookings | driver can't book their own ride (same dual-role account) | ✅ PASS | status=400 |
| Bookings | `GET /api/bookings/driver-pending` | ✅ PASS | |
| Bookings | `PUT /api/bookings/:id/accept` | ✅ PASS | status=200 |
| Payments | `POST /api/payments/:bookingId/mock-confirm` | ✅ PASS | status=200 |
| Payments | `GET /api/payments/:bookingId/status` | ✅ PASS | |
| Payments | `GET /api/payments/my-history` | ✅ PASS | |
| Chat | `POST /api/chats/:bookingId/messages` | ✅ PASS | status=201 |
| Chat | `GET /api/chats/:bookingId/messages` | ✅ PASS | |
| Chat | Socket.IO real-time `message:receive` | ✅ PASS | |
| Trips | `POST /api/trips/:bookingId/start` | ✅ PASS | status=200 |
| Trips | `GET /api/trips/:bookingId/otp` (passenger reads it) | ✅ PASS | |
| Trips | wrong trip-OTP is rejected | ✅ PASS | status=400 |
| Trips | `POST /api/trips/:bookingId/verify-otp` (correct code) | ✅ PASS | status=200 |
| Trips | `PUT /api/trips/:bookingId/location` | ✅ PASS | status=200 |
| Trips | `GET /api/trips/:bookingId/track` | ✅ PASS | |
| Trips | `POST /api/trips/:bookingId/complete` | ✅ PASS | status=200 |
| Trips | `PUT /api/trips/:bookingId/collect-cash` | ✅ PASS | |
| Reviews | `POST /api/reviews` | ✅ PASS | status=201 |
| Reviews | can't review yourself | ✅ PASS | status=400 |
| Notifications | `GET /api/notifications` | ✅ PASS | |
| Places | `GET /api/places/autocomplete` | ✅ PASS | status=200 |
| Places | `GET /api/places/reverse` | ✅ PASS | status=200 |
| Weather | `GET /api/weather` (mock mode) | ✅ PASS | status=200 |
| Referrals | `GET /api/referrals/me` | ✅ PASS | |
| Promo codes | invalid code rejected, not silently accepted | ✅ PASS | status=400 |
| Emergency contacts | `POST /api/emergency-contacts` | ✅ PASS | status=201 |
| Emergency contacts | `GET /api/emergency-contacts` | ✅ PASS | |
| Emergency contacts | `DELETE /api/emergency-contacts/:id` | ✅ PASS | status=200 |
| Vehicles | `DELETE /api/vehicles/:id` (test cleanup) | ✅ PASS | status=200 |
| Verification | `GET /api/verification/status` | ✅ PASS | status=200 |
| AuthZ | no token → 401 | ✅ PASS | status=401 |
| AuthZ | `requireRole` blocks wrong role | ✅ PASS | status=403 |
| Rate limiting | `RateLimit-*` headers present | ✅ PASS | |

---

## 3. Admin dashboard — regression

Not touched by this change; checked to confirm the backend work didn't break anything shared (types, env handling) and that the app itself is still healthy.

| Test | Method | Result |
|---|---|---|
| Production build compiles, zero errors | `npm run build` | ✅ PASS — all ~45 routes compiled |
| `/login` | smoke curl, running instance | ✅ PASS (200) |
| `/dashboard` | smoke curl | ✅ PASS (200) |
| `/users` | smoke curl | ✅ PASS (200) |
| `/rides` | smoke curl | ✅ PASS (200) |
| `/bookings` | smoke curl | ✅ PASS (200) |
| `/payments` | smoke curl | ✅ PASS (200) |
| `/refunds` | smoke curl | ✅ PASS (200) |
| `/reviews` | smoke curl | ✅ PASS (200) |
| `/settings/config` | smoke curl | ✅ PASS (307 — correct: unauthenticated request redirected to login by middleware) |
| `/about`, `/safety`, `/pricing`, `/faq`, `/contact` | smoke curl | ✅ PASS (200 each) |
| `/legal/privacy`, `/legal/terms` | smoke curl | ✅ PASS (200 each) |

---

## 4. Mobile app — what could actually be checked here

This environment has no simulator/device attached, so real in-app UI testing was **not possible** and is not claimed below. What *was* verified:

| Test | Method | Result |
|---|---|---|
| TypeScript compiles with no errors | `npx tsc --noEmit` | ✅ PASS |
| `app.json` / `eas.json` are valid JSON | parsed directly | ✅ PASS |
| Expo config resolves cleanly | `npx expo config --type public` | ✅ PASS |

**Not tested (needs a device/simulator, outside this environment):** any actual screen, the login/OTP flow, ride search/booking, live tracking map, chat UI, payment screens. Mobile code wasn't touched by this backend infra work, so the risk here is low, but this is a real gap, not a pass — worth a manual run-through on a device/simulator before this reaches app users, per your usual "test locally before deploy" workflow.

---

## 5. What this does NOT cover

- **Real SMS (2Factor), real Razorpay charges, real Eko verification, real Google Maps/Places/Directions, real weather API** — all exercised in mock/dev mode by design, not against the live third-party services. That's intentional (never spend real money/SMS credits on a test run) but means those integrations' *live* behavior wasn't (re-)verified.
- **Multi-box load balancing** — verified PM2 cluster mode (multi-process, one box) and Nginx's config was reviewed carefully, but Nginx itself wasn't installed/run in this sandbox (no root/package access here) — worth a real `nginx -t` + one live request through it on the actual VPS before relying on it.
- **Load/stress testing** — confirms correctness under normal traffic, not behavior under real concurrent load (e.g., many simultaneous bookings racing for the same ride's last seat — the existing Redis lock in `lib/redis.js` is unchanged by this work, but wasn't specifically load-tested here).
- **Mobile UI**, as above.

---

## Verdict

Every check that could be run in this environment passed, with zero failures across 54 backend regression cases + the 10 new-infra sanity checks + admin build/smoke + mobile static checks. The infra changes (rate limiting, PM2 cluster/Nginx load balancing, Redis-backed caching) are additive and correctness-preserving — nothing in the existing request/response shape or business logic changed.

**Before this reaches production**, two things still need you specifically, not more automated testing:

1. **A real device/simulator pass on mobile** — genuinely untested here, per the gap above.
2. **Deploying the backend itself** — this session has no SSH access or credentials to your VPS/hosting, so "deploy backend" isn't something that could be executed as part of this test run. `backend/DEPLOY.md` has the exact steps (PM2 + Nginx + certbot) for you (or whoever has server access) to run once the code is on the server.

If you're satisfied with the above, the next step is your call: commit + push to `origin/main` (nothing has been pushed yet), then deploy per `backend/DEPLOY.md`.
