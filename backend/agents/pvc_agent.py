"""
PVC/Storage Agent — tracks historian pod write patterns.
This is the root-cause agent: PVC write degradation initiates the cascade.
Monitors write latency percentiles, IOPS, queue depth, and disk saturation.
"""

import logging
from ..collectors.prometheus_client import PrometheusClient

logger = logging.getLogger(__name__)


class PVCAgent:
    """
    Monitors PVC I/O patterns.
    Central to the Industrial Sentinel: historian pod storage stress
    is the primary root cause of cascading failures.
    """

    WRITE_LATENCY_WARN_MS = 20     # normal: ~5ms
    WRITE_LATENCY_CRIT_MS = 60     # critical: >60ms = severe degradation
    IOPS_SATURATION_PCT = 0.80
    DISK_FULL_WARN_PCT = 0.80
    DISK_FULL_CRIT_PCT = 0.90
    QUEUE_DEPTH_WARN = 8

    def __init__(self, prom: PrometheusClient):
        self.prom = prom
        self.status = "idle"
        self._baseline_latency: dict[str, float] = {}

    async def analyze(self) -> list:
        from .orchestrator import AgentSignal
        self.status = "analyzing"
        signals = []

        try:
            # Write latency (99th percentile)
            latency_metrics = await self.prom.query(
                'histogram_quantile(0.99, rate(kubelet_volume_stats_write_latency_bucket[2m]))'
            )
            # Fallback: block device latency
            if not latency_metrics:
                latency_metrics = await self.prom.query(
                    'rate(node_disk_write_time_seconds_total[2m]) / rate(node_disk_writes_completed_total[2m]) * 1000'
                )

            # IOPS
            iops_total = await self.prom.query(
                'rate(node_disk_writes_completed_total[2m])'
            )

            # Disk capacity
            disk_capacity = await self.prom.query(
                'kubelet_volume_stats_capacity_bytes'
            )
            disk_used = await self.prom.query(
                'kubelet_volume_stats_used_bytes'
            )

            # Queue depth
            queue_metrics = await self.prom.query(
                'node_disk_io_now'
            )

            # Process write latency
            for m in latency_metrics:
                pod = m["metric"].get("pod", m["metric"].get("device", "unknown"))
                ns = m["metric"].get("namespace", "default")
                raw = m["value"][1]
                if raw in ("NaN", "Inf", "+Inf"):
                    continue
                latency_ms = float(raw) * 1000 if float(raw) < 10 else float(raw)

                # Establish baseline
                key = f"{ns}/{pod}"
                if key not in self._baseline_latency:
                    self._baseline_latency[key] = latency_ms
                baseline = self._baseline_latency[key]
                ratio = latency_ms / max(baseline, 1.0)

                if latency_ms >= self.WRITE_LATENCY_CRIT_MS or ratio >= 10:
                    signals.append(AgentSignal(
                        source="pvc_agent",
                        target="orchestrator",
                        signal_type="investigate",
                        severity="critical",
                        pod_name=pod,
                        namespace=ns,
                        metric="write_latency_ms",
                        value=round(latency_ms, 1),
                        message=(
                            f"{pod}: PVC write latency {latency_ms:.0f}ms "
                            f"(baseline {baseline:.0f}ms, {ratio:.0f}× degradation) — "
                            "cascade risk: downstream inference queue will back up"
                        ),
                    ))
                elif latency_ms >= self.WRITE_LATENCY_WARN_MS:
                    signals.append(AgentSignal(
                        source="pvc_agent",
                        target="orchestrator",
                        signal_type="alert",
                        severity="warning",
                        pod_name=pod,
                        namespace=ns,
                        metric="write_latency_ms",
                        value=round(latency_ms, 1),
                        message=f"{pod}: PVC write latency elevated at {latency_ms:.0f}ms (threshold: {self.WRITE_LATENCY_WARN_MS}ms)",
                    ))

            # Process queue depth
            for m in queue_metrics:
                device = m["metric"].get("device", "unknown")
                depth = float(m["value"][1])
                if depth >= self.QUEUE_DEPTH_WARN:
                    signals.append(AgentSignal(
                        source="pvc_agent",
                        target="cpu_agent",
                        signal_type="correlate",
                        severity="warning",
                        pod_name=device,
                        namespace="node",
                        metric="io_queue_depth",
                        value=depth,
                        message=f"Disk {device}: I/O queue depth {depth:.0f} — storage contention, check historian pod",
                    ))

            # Disk capacity
            cap_map = {
                f"{m['metric'].get('namespace','')}/{m['metric'].get('persistentvolumeclaim','')}":
                float(m['value'][1]) for m in disk_capacity
            }
            for m in disk_used:
                pvc = m['metric'].get('persistentvolumeclaim', 'unknown')
                ns = m['metric'].get('namespace', 'default')
                key = f"{ns}/{pvc}"
                used = float(m['value'][1])
                cap = cap_map.get(key, 1)
                pct = used / cap if cap > 0 else 0

                if pct >= self.DISK_FULL_CRIT_PCT:
                    signals.append(AgentSignal(
                        source="pvc_agent",
                        target="orchestrator",
                        signal_type="alert",
                        severity="critical",
                        pod_name=pvc,
                        namespace=ns,
                        metric="disk_usage_pct",
                        value=round(pct * 100, 1),
                        message=f"PVC {pvc}: disk {pct*100:.0f}% full — imminent write failure, historian will crash",
                    ))

            self.status = "ok"
        except Exception as e:
            logger.error(f"PVCAgent error: {e}")
            self.status = "error"

        return signals
