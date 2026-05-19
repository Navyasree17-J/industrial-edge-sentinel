"""
Industrial Edge Anomaly Sentinel — Multi-Agent Orchestrator
Coordinates CPU, Memory, PVC/Storage, and Log/IO agents for cascading failure detection.
"""

import asyncio
import logging
import time
from dataclasses import dataclass, field
from typing import Any
from datetime import datetime

from .cpu_agent import CPUAgent
from .memory_agent import MemoryAgent
from .pvc_agent import PVCAgent
from .log_agent import LogIOAgent
from ..collectors.prometheus_client import PrometheusClient
from ..collectors.k8s_client import K8sClient

logger = logging.getLogger(__name__)


@dataclass
class AgentSignal:
    """Inter-agent communication signal."""
    source: str
    target: str
    signal_type: str          # "investigate", "correlate", "alert"
    severity: str             # "info", "warning", "critical"
    pod_name: str
    namespace: str
    metric: str
    value: float
    message: str
    timestamp: float = field(default_factory=time.time)


@dataclass
class CascadeChain:
    """Detected cascading failure chain."""
    chain_id: str
    steps: list[dict]
    root_cause: str
    affected_pods: list[str]
    severity: str
    recommendation: str
    detected_at: str


class MultiAgentOrchestrator:
    """
    Coordinates all four specialist agents.
    Detects inter-pod dependency failures and causal chains.
    """

    def __init__(self, prom_url: str = "http://prometheus:9090", kubeconfig: str = None):
        self.prom = PrometheusClient(prom_url)
        self.k8s = K8sClient(kubeconfig)

        self.cpu_agent = CPUAgent(self.prom)
        self.memory_agent = MemoryAgent(self.prom)
        self.pvc_agent = PVCAgent(self.prom)
        self.log_agent = LogIOAgent(self.k8s)

        self.signal_queue: asyncio.Queue[AgentSignal] = asyncio.Queue()
        self.cascade_chains: list[CascadeChain] = []
        self.insights: list[dict] = []
        self.running = False

        # Causal dependency map — who depends on whom
        self.dependency_map = {
            "historian": [],
            "ml-inference": ["historian"],
            "sensor-ingestion": ["ml-inference"],
            "alerting": ["sensor-ingestion", "ml-inference"],
        }

    async def start(self):
        """Start all agents and the signal router."""
        self.running = True
        logger.info("Starting Industrial Edge Anomaly Sentinel...")

        await asyncio.gather(
            self._run_cpu_agent(),
            self._run_memory_agent(),
            self._run_pvc_agent(),
            self._run_log_agent(),
            self._route_signals(),
            self._cascade_detector(),
        )

    async def stop(self):
        self.running = False

    # ── Agent runners ─────────────────────────────────────────────────────────

    async def _run_cpu_agent(self):
        while self.running:
            signals = await self.cpu_agent.analyze()
            for s in signals:
                await self.signal_queue.put(s)
            await asyncio.sleep(15)

    async def _run_memory_agent(self):
        while self.running:
            signals = await self.memory_agent.analyze()
            for s in signals:
                await self.signal_queue.put(s)
            await asyncio.sleep(15)

    async def _run_pvc_agent(self):
        while self.running:
            signals = await self.pvc_agent.analyze()
            for s in signals:
                await self.signal_queue.put(s)
            await asyncio.sleep(10)   # PVC is most critical; poll faster

    async def _run_log_agent(self):
        while self.running:
            signals = await self.log_agent.analyze()
            for s in signals:
                await self.signal_queue.put(s)
            await asyncio.sleep(20)

    # ── Signal router ─────────────────────────────────────────────────────────

    async def _route_signals(self):
        """
        Cross-agent signal routing.
        When PVC agent detects write degradation, ask log agent to investigate.
        """
        while self.running:
            try:
                signal = await asyncio.wait_for(self.signal_queue.get(), timeout=1.0)
                await self._handle_signal(signal)
            except asyncio.TimeoutError:
                continue

    async def _handle_signal(self, signal: AgentSignal):
        logger.info(f"[{signal.source}→{signal.target}] {signal.signal_type}: {signal.message}")

        # PVC write degradation → trigger log and CPU investigation
        if signal.source == "pvc_agent" and signal.signal_type == "investigate":
            if signal.metric in ("write_latency_ms", "iops_saturation"):
                downstream = self._get_downstream_pods(signal.pod_name)
                for pod in downstream:
                    await self.log_agent.focus_on(pod, "timeout|retry|queue|backpressure")
                    await self.cpu_agent.focus_on(pod, "retry_spike")

        # Memory bloat in sensor pod → check log agent for packet drops
        if signal.source == "memory_agent" and "sensor" in signal.pod_name:
            await self.log_agent.focus_on(signal.pod_name, "drop|overflow|buffer")

        # Log timeouts in inference pod → check CPU for saturation
        if signal.source == "log_agent" and "inference" in signal.pod_name:
            await self.cpu_agent.focus_on(signal.pod_name, "saturation")

        insight = {
            "id": f"{signal.source}_{int(signal.timestamp)}",
            "source_agent": signal.source,
            "pod": signal.pod_name,
            "namespace": signal.namespace,
            "severity": signal.severity,
            "message": signal.message,
            "metric": signal.metric,
            "value": signal.value,
            "timestamp": datetime.fromtimestamp(signal.timestamp).isoformat(),
        }
        self.insights.insert(0, insight)
        if len(self.insights) > 500:
            self.insights = self.insights[:500]

    # ── Cascade detector ──────────────────────────────────────────────────────

    async def _cascade_detector(self):
        """
        Periodically checks for causal chain patterns:
        PVC write degradation → historian backpressure → inference queue overflow
        → sensor packet loss → alerting blind spot
        """
        while self.running:
            await asyncio.sleep(30)
            await self._check_cascade_patterns()

    async def _check_cascade_patterns(self):
        recent_critical = [i for i in self.insights
                           if i["severity"] in ("warning", "critical")
                           and (time.time() - self._parse_ts(i["timestamp"])) < 300]

        sources = {i["pod"]: i for i in recent_critical}

        # Pattern: PVC + downstream CPU/memory degradation
        pvc_issues = [i for i in recent_critical if i["source_agent"] == "pvc_agent"]
        cpu_issues = [i for i in recent_critical if i["source_agent"] == "cpu_agent"]
        mem_issues = [i for i in recent_critical if i["source_agent"] == "memory_agent"]
        log_issues = [i for i in recent_critical if i["source_agent"] == "log_agent"]

        if pvc_issues and cpu_issues and (mem_issues or log_issues):
            chain = CascadeChain(
                chain_id=f"cascade_{int(time.time())}",
                steps=[
                    {"step": 1, "pod": "historian", "event": "PVC write latency spike",
                     "detail": pvc_issues[0]["message"]},
                    {"step": 2, "pod": "ml-inference", "event": "CPU saturation / queue overflow",
                     "detail": cpu_issues[0]["message"]},
                    {"step": 3, "pod": "sensor-ingestion", "event": "Memory bloat / packet drop",
                     "detail": mem_issues[0]["message"] if mem_issues else "buffer saturation"},
                    {"step": 4, "pod": "alerting", "event": "Incomplete data — blind spot risk",
                     "detail": "Alerting pod receiving incomplete sensor stream"},
                ],
                root_cause="PVC write degradation in historian pod",
                affected_pods=["historian", "ml-inference", "sensor-ingestion", "alerting"],
                severity="critical",
                recommendation=(
                    "1. Throttle historian write rate or add PVC IOPS limit. "
                    "2. Add backpressure queue between historian and ML inference. "
                    "3. Scale ML inference horizontally or reduce model batch size. "
                    "4. Add circuit breaker on alerting pod to use cached baseline."
                ),
                detected_at=datetime.now().isoformat(),
            )
            # De-duplicate
            existing_ids = {c.root_cause for c in self.cascade_chains}
            if chain.root_cause not in existing_ids or not self.cascade_chains:
                self.cascade_chains.insert(0, chain)
                logger.warning(f"CASCADE DETECTED: {chain.root_cause}")

    def _get_downstream_pods(self, pod_name: str) -> list[str]:
        """Return pods that depend on the given pod."""
        result = []
        base = pod_name.split("-")[0]
        for pod, deps in self.dependency_map.items():
            if any(base in d for d in deps):
                result.append(pod)
        return result

    def _parse_ts(self, ts_str: str) -> float:
        try:
            return datetime.fromisoformat(ts_str).timestamp()
        except Exception:
            return 0.0

    def get_state(self) -> dict[str, Any]:
        return {
            "insights": self.insights[:50],
            "cascade_chains": [
                {
                    "chain_id": c.chain_id,
                    "steps": c.steps,
                    "root_cause": c.root_cause,
                    "affected_pods": c.affected_pods,
                    "severity": c.severity,
                    "recommendation": c.recommendation,
                    "detected_at": c.detected_at,
                }
                for c in self.cascade_chains[:10]
            ],
            "agent_status": {
                "cpu_agent": self.cpu_agent.status,
                "memory_agent": self.memory_agent.status,
                "pvc_agent": self.pvc_agent.status,
                "log_agent": self.log_agent.status,
            },
        }
