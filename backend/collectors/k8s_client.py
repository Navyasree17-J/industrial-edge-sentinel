"""
Kubernetes client — pod discovery, log streaming, event watching.
Uses in-cluster config when deployed; falls back to kubeconfig for dev.
"""

import asyncio
import logging
import subprocess
import json
import time
from typing import AsyncIterator

logger = logging.getLogger(__name__)


class K8sClient:
    """Thin async wrapper around kubectl for edge compatibility."""

    def __init__(self, kubeconfig: str = None):
        self.kubeconfig = kubeconfig
        self._base_cmd = ["kubectl"]
        if kubeconfig:
            self._base_cmd += ["--kubeconfig", kubeconfig]

    def _run(self, args: list[str], timeout: int = 10) -> str:
        try:
            result = subprocess.run(
                self._base_cmd + args,
                capture_output=True,
                text=True,
                timeout=timeout,
            )
            if result.returncode != 0:
                logger.warning(f"kubectl error: {result.stderr.strip()}")
                return ""
            return result.stdout
        except subprocess.TimeoutExpired:
            logger.error(f"kubectl timeout: {args}")
            return ""
        except FileNotFoundError:
            logger.warning("kubectl not found — using mock data")
            return ""

    async def _run_async(self, args: list[str], timeout: int = 10) -> str:
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, lambda: self._run(args, timeout))

    async def list_pods(self, namespaces: list[str] = None) -> list[dict]:
        """List all pods across specified namespaces."""
        try:
            if namespaces:
                all_pods = []
                for ns in namespaces:
                    raw = await self._run_async([
                        "get", "pods", "-n", ns, "-o", "json"
                    ])
                    if raw:
                        data = json.loads(raw)
                        all_pods.extend(data.get("items", []))
                return all_pods
            else:
                raw = await self._run_async(["get", "pods", "-A", "-o", "json"])
                if raw:
                    return json.loads(raw).get("items", [])
        except Exception as e:
            logger.error(f"list_pods error: {e}")

        return self._mock_pods()

    async def get_pod_logs(
        self,
        pod_name: str,
        namespace: str = "default",
        tail_lines: int = 100,
        since: str = "5m",
    ) -> list[str]:
        """Fetch recent pod logs."""
        raw = await self._run_async([
            "logs", pod_name, "-n", namespace,
            f"--tail={tail_lines}",
            f"--since={since}",
        ], timeout=15)

        if raw:
            return [line for line in raw.splitlines() if line.strip()]

        return self._mock_logs(pod_name)

    async def get_pod_events(self, namespace: str = "industrial") -> list[dict]:
        """Get recent K8s events."""
        raw = await self._run_async([
            "get", "events", "-n", namespace,
            "--sort-by=.lastTimestamp", "-o", "json"
        ])
        if raw:
            try:
                return json.loads(raw).get("items", [])
            except Exception:
                pass
        return []

    async def get_pvcs(self, namespace: str = "industrial") -> list[dict]:
        """List PersistentVolumeClaims."""
        raw = await self._run_async([
            "get", "pvc", "-n", namespace, "-o", "json"
        ])
        if raw:
            try:
                return json.loads(raw).get("items", [])
            except Exception:
                pass
        return []

    def _mock_pods(self) -> list[dict]:
        pods = [
            ("historian-0", "industrial", "Running", "StatefulSet"),
            ("ml-inference-6b9d4f-xk2p9", "industrial", "Running", "Deployment"),
            ("sensor-ingestion-85f6d-9q3r1", "industrial", "Running", "Deployment"),
            ("alerting-5d8c7b-zx7w2", "industrial", "Running", "Deployment"),
            ("prometheus-0", "monitoring", "Running", "StatefulSet"),
            ("grafana-7d9f-p8k3", "monitoring", "Running", "Deployment"),
        ]
        result = []
        for name, ns, phase, owner in pods:
            result.append({
                "metadata": {
                    "name": name,
                    "namespace": ns,
                    "labels": {"app": name.split("-")[0]},
                    "ownerReferences": [{"kind": owner}],
                },
                "status": {
                    "phase": phase,
                    "containerStatuses": [{"ready": True, "restartCount": 0}],
                },
                "spec": {
                    "nodeName": "edge-node-01",
                    "containers": [{"name": name.split("-")[0], "resources": {
                        "requests": {"cpu": "100m", "memory": "128Mi"},
                        "limits": {"cpu": "500m", "memory": "512Mi"},
                    }}],
                },
            })
        return result

    def _mock_logs(self, pod_name: str) -> list[str]:
        import random
        base_name = pod_name.split("-")[0]
        log_templates = {
            "historian": [
                "INFO  Writing batch of 1024 time-series points to PVC",
                "WARN  Write latency spike: 78ms (baseline 5ms)",
                "ERROR fsync timeout after 5000ms on /data/timeseries.db",
                "INFO  Retrying write attempt 3/5",
                "WARN  PVC queue depth: 12 operations pending",
            ],
            "ml-inference": [
                "INFO  Processing inference batch size=32",
                "WARN  Input queue at 87% capacity — backpressure from historian",
                "ERROR timeout waiting for feature store response after 3000ms",
                "INFO  Retrying batch inference: attempt 2",
                "WARN  GPU memory at 94% — batch size reduction triggered",
            ],
            "sensor-ingestion": [
                "INFO  Receiving telemetry from 48 sensors at 100Hz",
                "WARN  Buffer overflow — dropping 12 packets from sensor_group_C",
                "ERROR connection reset by peer: ml-inference service unavailable",
                "WARN  Packet drop rate: 3.2% over last 60s",
                "INFO  Reconnecting to ML inference endpoint",
            ],
            "alerting": [
                "INFO  Evaluating 24 alert rules",
                "WARN  Sensor data incomplete — missing sensor_group_C readings",
                "ERROR Unable to evaluate threshold for temperature_anomaly rule",
                "WARN  Alerting on stale data — sensor stream delayed 45s",
            ],
        }
        templates = log_templates.get(base_name, ["INFO Nominal operation"])
        return random.sample(templates, min(len(templates), 3))
