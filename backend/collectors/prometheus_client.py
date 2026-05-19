"""
Prometheus client for pull-based metric collection.
Designed for edge deployments — minimal overhead, pull-based.
"""

import aiohttp
import asyncio
import logging
import time
from typing import Any

logger = logging.getLogger(__name__)


class PrometheusClient:
    """Lightweight async Prometheus query client."""

    def __init__(self, base_url: str = "http://localhost:9090", timeout: int = 10):
        self.base_url = base_url.rstrip("/")
        self.timeout = aiohttp.ClientTimeout(total=timeout)
        self._session: aiohttp.ClientSession | None = None
        self._cache: dict[str, tuple[float, Any]] = {}
        self._cache_ttl = 10  # seconds

    async def _get_session(self) -> aiohttp.ClientSession:
        if self._session is None or self._session.closed:
            self._session = aiohttp.ClientSession(timeout=self.timeout)
        return self._session

    async def query(self, promql: str) -> list[dict]:
        """Instant query."""
        cache_key = f"instant:{promql}"
        cached = self._cache.get(cache_key)
        if cached and time.time() - cached[0] < self._cache_ttl:
            return cached[1]

        session = await self._get_session()
        try:
            async with session.get(
                f"{self.base_url}/api/v1/query",
                params={"query": promql},
            ) as resp:
                data = await resp.json()
                if data["status"] == "success":
                    result = data["data"]["result"]
                    self._cache[cache_key] = (time.time(), result)
                    return result
                logger.warning(f"Prometheus query failed: {data.get('error', 'unknown')}")
                return []
        except Exception as e:
            logger.error(f"Prometheus query error: {e}")
            return self._mock_data(promql)

    async def query_range(
        self,
        promql: str,
        duration: str = "10m",
        step: str = "30s",
    ) -> list[dict]:
        """Range query for trend analysis."""
        end = int(time.time())
        # Parse duration
        dur_map = {"m": 60, "h": 3600, "s": 1}
        unit = duration[-1]
        num = int(duration[:-1])
        start = end - (num * dur_map.get(unit, 60))

        session = await self._get_session()
        try:
            async with session.get(
                f"{self.base_url}/api/v1/query_range",
                params={
                    "query": promql,
                    "start": start,
                    "end": end,
                    "step": step,
                },
            ) as resp:
                data = await resp.json()
                if data["status"] == "success":
                    return data["data"]["result"]
                return []
        except Exception as e:
            logger.error(f"Prometheus range query error: {e}")
            return self._mock_range_data(promql)

    def _mock_data(self, promql: str) -> list[dict]:
        """Synthetic data for offline/dev use."""
        import random
        pods = [
            ("historian-0", "industrial"),
            ("ml-inference-6b9d-xk2p", "industrial"),
            ("sensor-ingestion-85f-9q3r", "industrial"),
            ("alerting-5d8c-zx7w", "industrial"),
        ]
        result = []
        for pod, ns in pods:
            if "cpu" in promql.lower():
                value = random.uniform(0.1, 0.95)
            elif "memory" in promql.lower():
                value = random.uniform(200_000_000, 480_000_000)
            else:
                value = random.uniform(0.0, 1.0)
            result.append({
                "metric": {"pod": pod, "namespace": ns, "container": pod.split("-")[0]},
                "value": [int(time.time()), str(value)],
            })
        return result

    def _mock_range_data(self, promql: str) -> list[dict]:
        """Synthetic range data."""
        import random
        now = int(time.time())
        pods = [
            ("historian-0", "industrial"),
            ("ml-inference-6b9d-xk2p", "industrial"),
            ("sensor-ingestion-85f-9q3r", "industrial"),
            ("alerting-5d8c-zx7w", "industrial"),
        ]
        result = []
        for pod, ns in pods:
            values = []
            base = random.uniform(0.2, 0.6)
            for i in range(20):
                ts = now - (19 - i) * 30
                jitter = random.uniform(-0.1, 0.3) if i > 14 else random.uniform(-0.05, 0.05)
                values.append([ts, str(max(0, min(1.0, base + jitter)))])
            result.append({
                "metric": {"pod": pod, "namespace": ns},
                "values": values,
            })
        return result

    async def close(self):
        if self._session and not self._session.closed:
            await self._session.close()
