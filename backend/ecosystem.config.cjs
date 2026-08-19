// PM2 cluster config — the load-balancing half of this setup.
//
// `.cjs`, not `.js`: package.json has "type": "module" (the app itself
// is ESM), but PM2's own config loader expects to `require()` this file,
// which fails on an ESM file under that package.json setting. `.cjs`
// opts this one file back into CommonJS regardless of the package.json
// setting; src/index.js and everything it imports stays ESM and is
// unaffected — PM2 just spawns `node src/index.js` per worker, it
// doesn't require() the app itself.
//
// exec_mode: "cluster" is what actually load-balances: PM2 spawns
// `instances` copies of src/index.js, all bound to the same PORT via
// Node's cluster module (SO_REUSEPORT under the hood), and round-robins
// incoming connections across them. Nginx (see deploy/nginx.conf) then
// only needs to proxy to that one port — the multi-core fan-out happens
// here, not in Nginx.
module.exports = {
  apps: [
    {
      name: "carpool-backend",
      script: "src/index.js",
      cwd: __dirname,
      exec_mode: "cluster",
      // "max" uses every CPU core. If Postgres/Redis/Nginx run on this
      // same box (common on a single small VPS), consider "-1" instead
      // (max minus one) so the OS/DB/proxy always keep a free core —
      // change this one line, no other config needed.
      instances: "max",
      env: {
        NODE_ENV: "production",
      },
      // Each worker gets its own PORT env from the shell/.env — cluster
      // mode needs them all on the *same* port (that's what makes the
      // OS-level load balancing work), so PORT must stay a single fixed
      // value, not per-worker.
      max_memory_restart: "500M",
      autorestart: true,
      // Backs off restart attempts instead of hot-looping a worker that
      // crashes immediately on boot (e.g. bad env var) — caps retries
      // from hammering Postgres/Redis with connection attempts.
      exp_backoff_restart_delay: 200,
      // Gives in-flight requests (and the booking-expiry/no-show crons
      // on worker 0 — see index.js's isCronWorker guard) a moment to
      // finish before PM2 sends SIGKILL during a reload/restart.
      kill_timeout: 8000,
      watch: false,
    },
  ],
};
