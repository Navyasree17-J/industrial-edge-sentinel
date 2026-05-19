"""
CPU Agent — monitors ML inference pod for compute saturation.
Detects retry spikes and sustained high-load conditions.
"""

import logging
import time
from ..collectors.prometheus_client import PrometheusClient

logger = logging.getLogger(__name__)


class CPUAgent:
    """Monitors CPU usage across all pods, focusing on ML inference saturation."""

    SATURATION_THRESHOLD = 0.85     # 85% CPU
    SPIKE_THRESHOLD = 0.70          # 70% sudden spike
    SUSTAINED_WINDOW_S = 120        # 2-min sustained load = warning

    def __init__(self, prom: PrometheusClient):
        self.prom = prom
        self.status = "idle"
        self._focus_pods: dict[str, str] = {}   # pod → reason
        self._history: dict[str, list[float]] = {}

    async def analyze(self) -> list:
        from .orchestrator import AgentSignal
        self.status = "analyzing"
        signals = []

        try:
            metrics = await self.prom.query_range(
                'rate(container_cpu_usage_seconds_total{container!="",container!="POD"}[2m])',
                step="15s",
            )
            limits = await self.prom.query(
                'kube_pod_container_resource_limits{resource="cpu"}'
            )
            limit_map = {f"{m['metric'].get('namespace','')}/{m['metric'].get('pod','')}":
                         float(m['value'][1]) for m in limits}

            for series in metrics:
                pod = series["metric"].get("pod", "unknown")
                ns = series["metric"].get("namespace", "default")
                values = [float(v[1]) for v in series["values"] if v[1] != "NaN"]
                if not values:
                    continue

                current = values[-1]
                key = f"{ns}/{pod}"
                limit = limit_map.get(key, 1.0)
                utilization = current / limit if limit > 0 else current

                # Track history
                hist = self._history.setdefault(key, [])
                hist.append(utilization)
                if len(hist) > 20:
                    hist.pop(0)

                # Saturation check
                if utilization >= self.SATURATION_THRESHOLD:
                    signals.append(AgentSignal(
                        source="cpu_agent",
                        target="orchestrator",
                        signal_type="investigate" if utilization >= 0.95 else "alert",
                        severity="critical" if utilization >= 0.95 else "warning",
                        pod_name=pod,
                        namespace=ns,
                        metric="cpu_utilization",
                        value=round(utilization * 100, 1),
                        message=f"{pod}: CPU at {utilization*100:.1f}% — possible saturation or retry storm",
                    ))

                # Focused investigation
                base = pod.split("-")[0]
                if any(base in fp for fp in self._focus_pods):
                    if utilization > self.SPIKE_THRESHOLD:
                        signals.append(AgentSignal(
                            source="cpu_agent",
                            target="log_agent",
                            signal_type="correlate",
                            severity="warning",
                            pod_name=pod,
                            namespace=ns,
                            metric="cpu_spike_during_focus",
                            value=round(utilization * 100, 1),
                            message=f"{pod}: CPU spike {utilization*100:.1f}% during PVC-triggered focus — likely retry overhead",
                        ))

            self.status = "ok"
        except Exception as e:
            logger.error(f"CPUAgent error: {e}")
            self.status = "error"

        return signals

    async def focus_on(self, pod: str, reason: str):
        """Called by orchestrator to increase scrutiny on a pod."""
        self._focus_pods[pod] = reason
        logger.info(f"CPUAgent focusing on {pod}: {reason}")
