import { useEffect, useState } from "react";
import { api } from "./api";
import type { WeatherCondition } from "../components/WeatherEffectOverlay";

// Backs the "view weather" toggle on RouteMapScreen/LiveTrackingScreen —
// only fetches once actually switched on (weather isn't needed for
// every single map view, no point calling it on every mount) and caches
// the result for that lat/lng so flipping the toggle off and back on
// doesn't refire the request.
export function useRouteWeather(enabled: boolean, lat: number, lng: number) {
  const [condition, setCondition] = useState<WeatherCondition | null>(null);
  const [tempC, setTempC] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

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
  }, [enabled]);

  return { condition, tempC, loading, error };
}
