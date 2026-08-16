// Current-weather lookup for the mobile app's "view weather" map overlay
// (LiveTrackingScreen / RouteMapScreen) — a background visual effect
// (rain, heat haze, clear) keyed off real conditions at the route's
// location, not decoration for its own sake.
//
// Same mock/real branching this codebase already uses for every other
// paid/external API (see lib/eko.js): WEATHER_MOCK_MODE=true returns a
// deterministic condition with no network call and no key needed, so the
// UI is fully testable before a real OPENWEATHER_API_KEY is ever set.
// Provider is OpenWeatherMap's Current Weather Data API (2.5) — a plain
// REST GET, free tier, no per-app registration flow beyond an API key.

const OPENWEATHER_URL = "https://api.openweathermap.org/data/2.5/weather";

// OpenWeatherMap's own `weather[0].main` buckets, condensed into what
// the mobile overlay actually renders a distinct visual for. Order
// matters — checked top to bottom, first match wins.
const CONDITION_MAP = [
  { match: ["Thunderstorm"], condition: "THUNDERSTORM" },
  { match: ["Rain", "Drizzle"], condition: "RAIN" },
  { match: ["Snow"], condition: "SNOW" },
  { match: ["Mist", "Smoke", "Haze", "Dust", "Fog", "Sand", "Ash", "Squall", "Tornado"], condition: "HAZY" },
  { match: ["Clouds"], condition: "CLOUDY" },
  { match: ["Clear"], condition: "CLEAR" },
];

// India-specific read on top of OpenWeatherMap's category: "hot" isn't a
// condition OWM reports directly, it's a clear/cloudy day past a heat
// threshold — genuinely a different background effect (heat haze) than
// an ordinary clear day, and worth distinguishing for the same reason
// this app is India-only in the first place.
const HOT_THRESHOLD_C = 35;

function classify(weatherMain, tempC) {
  if (tempC != null && tempC >= HOT_THRESHOLD_C && (weatherMain === "Clear" || weatherMain === "Clouds")) {
    return "HOT";
  }
  const found = CONDITION_MAP.find((c) => c.match.includes(weatherMain));
  return found ? found.condition : "CLEAR";
}

// Rotates through a few representative conditions by rounding lat so the
// same test coordinates give the same mock result every time (useful for
// screenshots/repeatable testing) while still letting you see every
// background effect just by nudging the pin around the map.
const MOCK_CONDITIONS = ["CLEAR", "RAIN", "HOT", "CLOUDY", "THUNDERSTORM", "HAZY"];

function mockWeather(lat, lng) {
  const idx = Math.abs(Math.round((lat + lng) * 10)) % MOCK_CONDITIONS.length;
  const condition = MOCK_CONDITIONS[idx];
  const tempC = condition === "HOT" ? 38 : condition === "RAIN" || condition === "THUNDERSTORM" ? 24 : 29;
  return {
    condition,
    tempC,
    description: `${condition[0]}${condition.slice(1).toLowerCase()} (mock)`,
    isMock: true,
  };
}

export async function getCurrentWeather(lat, lng) {
  if (process.env.WEATHER_MOCK_MODE === "true") {
    return mockWeather(lat, lng);
  }
  if (!process.env.OPENWEATHER_API_KEY) {
    throw new Error("OPENWEATHER_API_KEY is not set — set WEATHER_MOCK_MODE=true to test the weather overlay in the meantime.");
  }

  const url = `${OPENWEATHER_URL}?lat=${lat}&lon=${lng}&appid=${process.env.OPENWEATHER_API_KEY}&units=metric`;
  const response = await fetch(url).catch(() => null);
  if (!response || !response.ok) {
    throw new Error("Couldn't reach the weather service.");
  }
  const data = await response.json();
  const weatherMain = data.weather?.[0]?.main;
  const tempC = data.main?.temp != null ? Math.round(data.main.temp) : null;

  return {
    condition: classify(weatherMain, tempC),
    tempC,
    description: data.weather?.[0]?.description || weatherMain || "",
    isMock: false,
  };
}
