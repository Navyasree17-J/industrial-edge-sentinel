"""
Log/IO Agent — parses logs from all four pod categories.
Detects: timeout errors, retry storms, connection failures, packet drops.
Collaborates with other agents on focused pod investigation.
"""

import re
import logging
import asyncio
from datetime import datetime
from ..collectors.k8s_client import K8sClient

logger = logging.getLogger(__name__)

# Patterns that indicate cascading failure symptoms
LOG_PATTERNS = {
    "timeout": re.compile(r"timeout|timed.out|deadline.exceeded", re.IGNORECASE),
    "retry": re.compile(r"retry|retrying|backoff|attempt\s+\d+", re.IGNORECASE),
    "connection_fail": re.compile(r"connection.refused|connection.reset|ECONNREFUSED|no.route", re.IGNORECASE),
    "packet_drop": re.compile(r"drop|dropped|packet.loss|overflow|buffer.full", re.IGNORECASE),
    "queue_overflow": re.compile(r"queue.full|queue.overflow|max.queue|backpressure", re.IGNORECASE),
    "oom_kill": re.compile(r"OOMKilled|out.of.memory|killed.process", re.IGNORECASE),
    "storage_error": re.compile(r"write.error|disk.full|no.space.left|ENOSPC|fsync", re.IGNORECASE),
    "inference_error": re.compile(r"inference.failed|model.error|prediction.timeout|batch.overflow", re.IGNORECASE),
}

SEVERITY_MAP = {
    "timeout": "warning",
    "retry": "info",
    "connection_fail": "critical",
    "packet_drop": "warning",
    "queue_overflow": "critical",
    "oom_kill": "critical",
    "storage_error": "critical",
    "inference_error": "warning",
}


class LogIOAgent:
    """Parses pod logs for operational anomaly signatures."""

    def __init__(self, k8s: K8sClient):
        self.k8s = k8s
        self.status = "idle"
        self._focus_pods: dict[str, str] = {}  # pod → pattern_override
        self._seen_lines: set[str] = set()      # dedup

    async def analyze(self) -> list:
        from .orchestrator import AgentSignal
        self.status = "analyzing"
        signals = []

        try:
            pods = await self.k8s.list_pods(namespaces=["industrial", "default", "monitoring"])
            tasks = [self._analyze_pod(pod) for pod in pods]
            results = await asyncio.gather(*tasks, return_exceptions=True)

            for r in results:
                if isinstance(r, list):
                    signals.extend(r)

            self.status = "ok"
        except Exception as e:
            logger.error(f"LogAgent error: {e}")
            self.status = "error"

        return signals

    async def _analyze_pod(self, pod: dict) -> list:
        from .orchestrator import AgentSignal
        signals = []
        pod_name = pod["metadata"]["name"]
        ns = pod["metadata"]["namespace"]

        # Determine which patterns to look for
        patterns = LOG_PATTERNS
        if pod_name in self._focus_pods:
            extra_pattern = self._focus_pods[pod_name]
            patterns = {**LOG_PATTERNS, "focused": re.compile(extra_pattern, re.IGNORECASE)}

        try:
            lines = await self.k8s.get_pod_logs(pod_name, ns, tail_lines=200)
        except Exception:
            return signals

        match_counts: dict[str, int] = {}
        sample_lines: dict[str, str] = {}

        for line in lines:
            line_key = f"{pod_name}:{line[:80]}"
            if line_key in self._seen_lines:
                continue
            self._seen_lines.add(line_key)
            if len(self._seen_lines) > 10000:
                self._seen_lines = set(list(self._seen_lines)[-5000:])

            for pname, pattern in patterns.items():
                if pattern.search(line):
                    match_counts[pname] = match_counts.get(pname, 0) + 1
                    if pname not in sample_lines:
                        sample_lines[pname] = line.strip()[:200]

        # Generate signals for meaningful match counts
        for pname, count in match_counts.items():
            if count < 2 and pname not in ("oom_kill", "storage_error", "connection_fail"):
                continue
            severity = SEVERITY_MAP.get(pname, "info")
            # Escalate if we're in focused mode
            if pod_name in self._focus_pods and severity == "info":
                severity = "warning"

            signals.append(AgentSignal(
                source="log_agent",
                target="orchestrator",
                signal_type="correlate",
                severity=severity,
                pod_name=pod_name,
                namespace=ns,
                metric=f"log_{pname}_count",
                value=float(count),
                message=(
                    f"{pod_name}: {count}× '{pname}' in logs — "
                    f"sample: \"{sample_lines.get(pname, '')[:100]}\""
                ),
            ))

        return signals

    async def focus_on(self, pod: str, pattern: str):
        """Targeted log search requested by another agent."""
        self._focus_pods[pod] = pattern
        logger.info(f"LogAgent focusing on {pod} with pattern: {pattern}")
