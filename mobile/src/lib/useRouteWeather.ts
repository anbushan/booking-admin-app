import { useEffect, useState } from "react";
import { api } from "./api";
import type { WeatherCondition } from "../components/WeatherEffectOverlay";

// Backs the "view weather" toggle on RouteMapScreen/LiveTrackingScreen/
// RouteMiniMap — only fetches once actually switched on (weather isn't
// needed for every single map view, no point calling it on every mount)
// and caches the result for that lat/lng so flipping the toggle off and
// back on doesn't refire the request. `retry` is a separate explicit
// trigger (not just re-toggling `enabled`) so a failed fetch can be
// retried with a single tap on the still-on weather button, rather than
// needing to switch it off and on again.
export function useRouteWeather(enabled: boolean, lat: number, lng: number) {
  const [condition, setCondition] = useState<WeatherCondition | null>(null);
  const [tempC, setTempC] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [retryTick, setRetryTick] = useState(0);

  useEffect(() => {
    if (!enabled || condition != null || loading) return;
    setLoading(true);
    setError(false);
    api
      .getWeather(lat, lng)
      .then((res: any) => {
        setCondition(res.condition);
        setTempC(res.tempC);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [enabled, retryTick]);

  function retry() {
    setError(false);
    setCondition(null);
    setRetryTick((t) => t + 1);
  }

  return { condition, tempC, loading, error, retry };
}
