import { Router } from "express";
import { redis } from "../lib/redis.js";
import { requireAuth } from "../middleware/auth.js";
import { getCurrentWeather } from "../lib/weather.js";

const router = Router();

// GET /api/weather?lat=&lng= — current conditions for the mobile app's
// "view weather" map overlay. requireAuth same as places.routes.js
// above it, for the same reason: an unauthenticated proxy in front of a
// metered external API is an open invitation to burn through the quota.
//
// Coordinates rounded to 2 decimal places (~1.1km) for the cache key —
// weather doesn't meaningfully change block to block, so every rider
// checking traffic/weather on roughly the same route shares one upstream
// call instead of one each.
router.get("/", requireAuth, async (req, res) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.status(400).json({ error: "lat and lng are required." });
  }

  const cacheKey = `weather:${lat.toFixed(2)}:${lng.toFixed(2)}`;
  const cached = await redis.get(cacheKey);
  if (cached) return res.json(JSON.parse(cached));

  try {
    const weather = await getCurrentWeather(lat, lng);
    // 10 minutes — long enough to spare the API on a busy route, short
    // enough that a weather overlay someone's looking at right now isn't
    // showing yesterday's rain.
    await redis.set(cacheKey, JSON.stringify(weather), "EX", 600);
    res.json(weather);
  } catch (err) {
    res.status(502).json({ error: err.message || "Weather is temporarily unavailable." });
  }
});

export default router;
