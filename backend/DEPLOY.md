# Backend deploy — rate limiting & Redis caching

What changed and why, plus how this actually runs in production.

## Where this runs

Production is a single Railway service (`carpool-backend-api`, project `carpool-backend`),
one instance, backed by Neon Postgres (external) and Railway-managed Redis. Not a VPS —
there's no Nginx or PM2 in front of this, Railway's own edge handles TLS/routing, and the
service runs `npm start` directly.

An earlier version of this doc described a PM2-cluster + Nginx setup written for a VPS
target. That was built on a wrong assumption about where production actually runs and
was removed — Railway's single-vCPU hobby tier has nothing for a multi-process cluster
to parallelize across, and Railway's edge already does what the Nginx config would have.
If a real VPS deploy ever happens, or Railway replicas get turned on, see "If this ever
needs to scale" below — the code is already safe for that, just not wired up for it.

## What's new

1. **Rate limiting** (`src/middleware/rateLimit.js`) — Redis-backed per-IP limits: a
   generous global safety net on every route, a tighter one on `/api/auth/*`
   (send-otp/verify-otp — a different, complementary layer to the phone-keyed
   cooldown/attempt-counter that route already had; this one closes the "one IP, many
   phone numbers" SMS-pumping gap), and a moderate one on `/api/payments/*`.
2. **Redis caching** (`src/lib/cache.js`) — the three caches that already existed
   (`userCache.js`, `appConfig.js`, `signedUrlCache.js`) were plain in-memory `Map`s.
   Now backed by Redis instead — same TTLs, same invalidation rules, same call sites,
   no behavior change to any route. Doesn't matter for correctness at a single instance
   (that was only ever a multi-process concern), but costs nothing extra either, and
   means cache state survives a redeploy instead of starting cold every time.

Neither of these depends on how many instances are running — both apply exactly the
same at 1 instance as at 10.

## Deploying

```bash
cd backend
railway up      # deploys the current directory to the linked Railway service
railway logs    # tail production logs
railway status  # check the linked project/service/deployment
```

`railway status` confirms which project/environment/service is linked before you run
`railway up` — deploying with the wrong thing linked is a real risk worth a 5-second
check, not just a formality.

## Verifying it's live

```bash
curl https://carpool-backend-api-production.up.railway.app/health   # -> {"ok":true}

# Confirm rate limiting is live (429 after the auth limit — 20/15min)
for i in $(seq 1 25); do curl -s -o /dev/null -w "%{http_code}\n" \
  -X POST https://carpool-backend-api-production.up.railway.app/api/auth/send-otp \
  -H "Content-Type: application/json" -d '{"phone":"9999999999"}'; done
```

## If this ever needs to scale (more than 1 instance)

Two things in this codebase already exist specifically to make that safe, even though
nothing uses them yet at 1 instance:

- **`isCronWorker` guard in `src/index.js`** — the booking-expiry/no-show/recurring-ride
  `setInterval`s only run on `NODE_APP_INSTANCE === "0"` (or when that var is unset, as
  it is on a single Railway instance today). Without this, a second replica would fire
  every cron independently — duplicate refunds, duplicate notifications.
- **Socket.IO Redis adapter (`src/lib/socket.js`)** — `io.to(...).emit(...)` calls for
  chat/notifications only reach sockets connected to the *same* process by default.
  With more than one instance, the driver and passenger in a chat could land on
  different instances and never see each other's messages. The Redis adapter fans room
  emits out through Redis pub/sub so this stays correct regardless of instance count.

Turning on more than 1 Railway replica is a dashboard/plan setting, not a code change —
these two pieces mean that flip doesn't also require revisiting this code.

## Things this deliberately does NOT change

- **Socket.IO CORS is still `origin: "*"`** — unrelated to this work, left as-is.
- **Admin's own suspend/reinstate flow still isn't wired to invalidate this cache** —
  pre-existing gap (see the comment in `userCache.js`), unrelated to this change; still
  bounded by the 3s TTL either way.
