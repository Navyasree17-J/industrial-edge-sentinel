"""
Memory Agent — watches sensor ingestion pod for buffer bloat.
Detects OOM risk, memory leaks, and queue overflow patterns.
"""

import logging
from ..collectors.prometheus_client import PrometheusClient

logger = logging.getLogger(__name__)


class MemoryAgent:
    """Monitors memory usage, focusing on buffer bloat in sensor ingestion pods."""

    BLOAT_THRESHOLD = 0.80        # 80% of limit
    LEAK_RATE_MB_PER_MIN = 50    # MB/min growth = likely leak
    OOM_RISK_THRESHOLD = 0.92

    def __init__(self, prom: PrometheusClient):
        self.prom = prom
        self.status = "idle"
        self._focus_pods: dict[str, str] = {}
        self._prev_mem: dict[str, float] = {}

    async def analyze(self) -> list:
        from .orchestrator import AgentSignal
        self.status = "analyzing"
        signals = []

        try:
            usage_metrics = await self.prom.query(
                'container_memory_working_set_bytes{container!="",container!="POD"}'
            )
            limit_metrics = await self.prom.query(
                'kube_pod_container_resource_limits{resource="memory"}'
            )
            limit_map = {
                f"{m['metric'].get('namespace','')}/{m['metric'].get('pod','')}":
                float(m['value'][1])
                for m in limit_metrics
            }

            for m in usage_metrics:
                pod = m["metric"].get("pod", "unknown")
                ns = m["metric"].get("namespace", "default")
                key = f"{ns}/{pod}"
                usage_bytes = float(m["value"][1])
                limit_bytes = limit_map.get(key, 512 * 1024 * 1024)  # default 512MB

                utilization = usage_bytes / limit_bytes if limit_bytes > 0 else 0

                # Buffer bloat — especially sensor pods
                if utilization >= self.BLOAT_THRESHOLD:
                    sev = "critical" if utilization >= self.OOM_RISK_THRESHOLD else "warning"
                    signals.append(AgentSignal(
                        source="memory_agent",
                        target="orchestrator",
                        signal_type="investigate",
                        severity=sev,
                        pod_name=pod,
                        namespace=ns,
                        metric="memory_utilization",
                        value=round(utilization * 100, 1),
                        message=(
                            f"{pod}: Memory at {utilization*100:.1f}% "
                            f"({'OOM risk' if sev=='critical' else 'buffer bloat'}) — "
                            f"{'sensor ingestion queue may be backing up' if 'sensor' in pod else 'check for memory leak'}"
                        ),
                    ))

                # Leak detection via growth rate
                if key in self._prev_mem:
                    growth_mb_per_s = (usage_bytes - self._prev_mem[key]) / (15 * 1024 * 1024)
                    growth_mb_per_min = growth_mb_per_s * 60
                    if growth_mb_per_min >= self.LEAK_RATE_MB_PER_MIN:
                        signals.append(AgentSignal(
                            source="memory_agent",
                            target="log_agent",
                            signal_type="correlate",
                            severity="warning",
                            pod_name=pod,
                            namespace=ns,
                            metric="memory_growth_rate",
                            value=round(growth_mb_per_min, 1),
                            message=f"{pod}: Memory growing at {growth_mb_per_min:.0f} MB/min — possible leak or unbounded queue",
                        ))

                self._prev_mem[key] = usage_bytes

            self.status = "ok"
        except Exception as e:
            logger.error(f"MemoryAgent error: {e}")
            self.status = "error"

        return signals

    async def focus_on(self, pod: str, reason: str):
        self._focus_pods[pod] = reason
        logger.info(f"MemoryAgent focusing on {pod}: {reason}")
