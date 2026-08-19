# Backend deploy: rate limiting, load balancing, Redis caching

What changed and why, plus the steps to actually run it on a VPS.

## What's new

1. **Rate limiting** (`src/middleware/rateLimit.js`) — Redis-backed
   per-IP limits: a generous global safety net on every route, a
   tighter one on `/api/auth/*` (send-otp/verify-otp — a different,
   complementary layer to the phone-keyed cooldown/attempt-counter that
   route already had; this one closes the "one IP, many phone numbers"
   gap), and a moderate one on `/api/payments/*`.
2. **Load balancing** (`ecosystem.config.cjs` + `deploy/nginx.conf`) —
   PM2 runs one worker process per CPU core (cluster mode); Nginx sits
   in front, terminates TLS, and proxies to them, including the header
   handling Socket.IO's WebSocket upgrade needs.
3. **Redis caching** (`src/lib/cache.js`) — the three caches that
   already existed (`userCache.js`, `appConfig.js`, `signedUrlCache.js`)
   were plain in-memory `Map`s, which only stay correct with exactly one
   process. Now backed by Redis, so a cache write/invalidation on one
   PM2 worker is instantly visible to every other worker — same TTLs,
   same invalidation rules, same call sites, no behavior change to any
   route. Socket.IO also got a Redis adapter (`src/lib/socket.js`) so
   chat/notification rooms work across workers, not just within one.

Nothing above changes any route's request/response shape or business
logic — it's the difference between "correct with 1 process" and
"correct with N processes behind a load balancer."

## One-time server setup

```bash
# Nginx + certbot (Ubuntu/Debian)
sudo apt install nginx certbot python3-certbot-nginx

# Redis, if not already running (already required today for OTP/locks —
# this just makes it load-bearing for caching + rate limiting too)
sudo apt install redis-server
sudo systemctl enable --now redis-server
```

## Deploy

```bash
cd backend
npm install
npx prisma generate

# Start the whole cluster (reads ecosystem.config.cjs)
npm run cluster:start

# Zero-downtime redeploy after a git pull — restarts workers one at a
# time, so there's always at least one serving traffic
npm run cluster:reload

npm run cluster:logs     # tail every worker's logs
pm2 status               # see all running workers
pm2 startup && pm2 save  # survive a server reboot
```

## Nginx

```bash
sudo cp deploy/nginx.conf /etc/nginx/sites-available/carpool-backend
# edit server_name to your real domain first
sudo ln -s /etc/nginx/sites-available/carpool-backend /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# Adds the listen 443 ssl block + auto-renewal
sudo certbot --nginx -d api.example.com
```

## Verifying it's actually load-balanced

```bash
pm2 status                        # should show `instances` count = CPU cores
curl https://api.example.com/health   # -> {"ok":true}

# Confirm rate limiting is live (429 after the auth limit — 20/15min)
for i in $(seq 1 25); do curl -s -o /dev/null -w "%{http_code}\n" \
  -X POST https://api.example.com/api/auth/send-otp \
  -H "Content-Type: application/json" -d '{"phone":"9999999999"}'; done
```

## Things this deliberately does NOT change

- **Socket.IO CORS is still `origin: "*"`** — unrelated to this work,
  left as-is.
- **Crons run once, not once-per-worker** — `src/index.js` only starts
  the booking-expiry/no-show/recurring-ride `setInterval`s on the first
  PM2 worker (`NODE_APP_INSTANCE === "0"`), so scaling instances up/down
  never risks duplicate side effects (double refunds, double
  notifications, etc.).
- **Admin's own suspend/reinstate flow still isn't wired to invalidate
  this cache** — pre-existing gap (see the comment in `userCache.js`),
  unrelated to this change; still bounded by the 3s TTL either way.
