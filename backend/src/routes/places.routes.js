import { Router } from "express";
import { redis } from "../lib/redis.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// GET /api/places/autocomplete?input=&sessionToken=
router.get("/autocomplete", requireAuth, async (req, res) => {
  const { input, sessionToken } = req.query;
  if (!input || String(input).length < 3) return res.json([]);

  const cacheKey = `places:autocomplete:${input}`;
  const cached = await redis.get(cacheKey);
  if (cached) return res.json(JSON.parse(cached));

  // TODO: call Google Places Autocomplete (New) API here with the session
  // token. Cache ONLY the place_id + description per Google's terms — do
  // not cache full place details beyond 30 days (see plan section 4).
  const url = `https://places.googleapis.com/v1/places:autocomplete`;
  const body = { input, sessionToken };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": process.env.GOOGLE_MAPS_API_KEY,
    },
    body: JSON.stringify(body),
  }).catch(() => null);

  if (!response || !response.ok) {
    return res.status(502).json({ error: "Location search is temporarily unavailable." });
  }

  const data = await response.json();
  const results = (data.suggestions || []).map((s) => ({
    placeId: s.placePrediction?.placeId,
    description: s.placePrediction?.text?.text,
  }));

  await redis.set(cacheKey, JSON.stringify(results), "EX", 60); // short cache, place IDs only
  res.json(results);
});

// GET /api/places/details?placeId=&sessionToken=
// This call terminates the Autocomplete session — required for keystroke
// billing to zero out under session-token pricing.
router.get("/details", requireAuth, async (req, res) => {
  const { placeId, sessionToken } = req.query;

  const response = await fetch(
    `https://places.googleapis.com/v1/places/${placeId}?sessionToken=${sessionToken}`,
    {
      headers: {
        "X-Goog-Api-Key": process.env.GOOGLE_MAPS_API_KEY,
        // Required by Places API (New) on every request — it 400s without
        // one. Only ask for what this route actually returns.
        "X-Goog-FieldMask": "location,formattedAddress",
      },
    }
  ).catch(() => null);

  if (!response || !response.ok) {
    return res.status(502).json({ error: "Couldn't resolve that location." });
  }

  const data = await response.json();
  res.json({
    lat: data.location?.latitude,
    lng: data.location?.longitude,
    address: data.formattedAddress,
  });
});

// GET /api/geocode/reverse?lat=&lng=
router.get("/reverse", requireAuth, async (req, res) => {
  const { lat, lng } = req.query;

  const response = await fetch(
    `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${process.env.GOOGLE_MAPS_API_KEY}`
  ).catch(() => null);

  if (!response || !response.ok) {
    return res.status(502).json({ error: "Couldn't resolve that location." });
  }

  const data = await response.json();
  const address = data.results?.[0]?.formatted_address || "Unknown location";
  res.json({ address });
});

export default router;
