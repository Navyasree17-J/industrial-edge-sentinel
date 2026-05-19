// All API calls — falls back to mock data when backend unreachable

const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

async function get(path) {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export const api = {
  health:        () => get("/health"),
  podMetrics:    () => get("/api/v1/metrics/pods"),
  insights:      (sev, limit = 50) => get(`/api/v1/insights?limit=${limit}${sev ? `&severity=${sev}` : ""}`),
  cascadeChains: () => get("/api/v1/cascade/chains"),
  dependencyMap: () => get("/api/v1/dependency-map"),
  state:         () => get("/api/v1/state"),
  timeseries:    (metric, window = "10m") => get(`/api/v1/metrics/timeseries/${metric}?window=${window}`),
};
