"""
FastAPI REST API — serves metrics, insights, and cascade chains to the dashboard.
Designed to run on edge hardware with minimal overhead.
"""
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi import FastAPI, Depends, HTTPException
from pydantic import BaseModel
from ..alerting import send_cascade_alert

from ..auth import (
    create_access_token,
    authenticate_user,
    get_current_user
)
from fastapi import FastAPI

app = FastAPI()

@app.post("/auth/login")
def login(data: LoginRequest):

    if not authenticate_user(
        data.username,
        data.password
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid credentials"
        )

    token = create_access_token({
        "sub": data.username
    })

    return {
        "access_token": token,
        "token_type": "bearer"
    }
    
import asyncio
import json
import os
import time
import random
from datetime import datetime, timedelta
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from ..agents.orchestrator import MultiAgentOrchestrator

class LoginRequest(BaseModel):
    username: str
    password: str
orchestrator: MultiAgentOrchestrator | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global orchestrator
    prom_url = os.getenv("PROMETHEUS_URL", "http://prometheus:9090")
    orchestrator = MultiAgentOrchestrator(prom_url=prom_url)

    task = asyncio.create_task(orchestrator.start())
    yield
    await orchestrator.stop()
    task.cancel()


app = FastAPI(
    title="Industrial Edge Anomaly Sentinel API",
    description="Multi-agent AI system for real-time pod resource analysis and cascading failure detection",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok", "timestamp": datetime.now().isoformat()}


@app.get("/api/v1/state")
def get_state(user=Depends(get_current_user)):
    """Full orchestrator state: insights, chains, agent status."""
    if orchestrator is None:
        raise HTTPException(503, "Orchestrator not ready")
    return orchestrator.get_state()


@app.get("/api/v1/metrics/pods")
async def get_pod_metrics(user=Depends(get_current_user)):
    """Current resource utilization for all pods."""
    if orchestrator is None:
        return _mock_pod_metrics()
    try:
        cpu = await orchestrator.prom.query(
            'rate(container_cpu_usage_seconds_total{container!="",container!="POD"}[2m])'
        )
        mem = await orchestrator.prom.query(
            'container_memory_working_set_bytes{container!="",container!="POD"}'
        )
        return _combine_pod_metrics(cpu, mem)
    except Exception:
        return _mock_pod_metrics()


@app.get("/api/v1/metrics/timeseries/{metric}")
async def get_timeseries(metric: str, pod: str = None, window: str = "10m", user=Depends(get_current_user)):
    """Historical timeseries for a specific metric."""
    if orchestrator is None:
        return _mock_timeseries(metric, pod)
    try:
        query_map = {
            "cpu": 'rate(container_cpu_usage_seconds_total{container!="POD"}[2m])',
            "memory": 'container_memory_working_set_bytes{container!="POD"}',
            "write_latency": 'rate(node_disk_write_time_seconds_total[2m])/rate(node_disk_writes_completed_total[2m])*1000',
            "iops": 'rate(node_disk_writes_completed_total[2m])',
            "net_rx": 'rate(container_network_receive_bytes_total[2m])',
            "net_tx": 'rate(container_network_transmit_bytes_total[2m])',
        }
        promql = query_map.get(metric)
        if not promql:
            raise HTTPException(400, f"Unknown metric: {metric}")
        if pod:
            promql = promql.replace("{", f'{{pod=~"{pod}",' if "{" in promql else f'{{pod=~"{pod}"}}')
        data = await orchestrator.prom.query_range(promql, duration=window)
        return data
    except HTTPException:
        raise
    except Exception:
        return _mock_timeseries(metric, pod)


@app.get("/api/v1/cascade/chains")
def get_cascade_chains(user=Depends(get_current_user)):
    """All detected cascade failure chains."""
    if orchestrator is None:
        return _mock_cascade_chains()
    chains = orchestrator.cascade_chains
    for chain in chains:
        send_cascade_alert(chain)
    if not chains:
        return _mock_cascade_chains()
    return [
        {
            "chain_id": c.chain_id,
            "steps": c.steps,
            "root_cause": c.root_cause,
            "affected_pods": c.affected_pods,
            "severity": c.severity,
            "recommendation": c.recommendation,
            "detected_at": c.detected_at,
        }
        for c in chains
    ]


@app.get("/api/v1/insights")
def get_insights(severity: str = None, limit: int = 50, user=Depends(get_current_user)):
    """Recent agent insights, optionally filtered by severity."""
    if orchestrator is None:
        return _mock_insights()
    insights = orchestrator.insights
    if severity:
        insights = [i for i in insights if i.get("severity") == severity]
    return insights[:limit]


@app.get("/api/v1/dependency-map")
async def get_dependency_map(
    user=Depends(get_current_user)
):
    """Pod interdependency graph for visualization."""
    if orchestrator is None:
        return _mock_dependency_map()
    pods = await orchestrator.k8s.list_pods()
    return _build_dependency_map(pods, orchestrator.dependency_map)


@app.get("/api/v1/stream/insights")
async def stream_insights(user=Depends(get_current_user)):
    """Server-Sent Events stream for real-time insight delivery."""
    async def generate():
        last_seen = 0
        while True:
            if orchestrator:
                new_insights = [
                    i for i in orchestrator.insights
                    if i.get("id", "").split("_")[-1].isdigit()
                    and int(i["id"].split("_")[-1]) > last_seen
                ]
                for insight in new_insights:
                    ts = int(insight["id"].split("_")[-1])
                    if ts > last_seen:
                        last_seen = ts
                    yield f"data: {json.dumps(insight)}\n\n"
            await asyncio.sleep(2)

    return StreamingResponse(generate(), media_type="text/event-stream")


# ── Mock data helpers (used when Prometheus/K8s unreachable) ──────────────────

def _mock_pod_metrics():
    now = time.time()
    pods = [
        {"name": "historian-0", "namespace": "industrial", "role": "historian"},
        {"name": "ml-inference-6b9d4f-xk2p9", "namespace": "industrial", "role": "ml-inference"},
        {"name": "sensor-ingestion-85f6d-9q3r1", "namespace": "industrial", "role": "sensor-ingestion"},
        {"name": "alerting-5d8c7b-zx7w2", "namespace": "industrial", "role": "alerting"},
        {"name": "prometheus-0", "namespace": "monitoring", "role": "monitoring"},
    ]
    result = []
    for p in pods:
        # Simulate historian under stress
        if p["role"] == "historian":
            cpu = round(random.uniform(0.55, 0.78), 3)
            mem = round(random.uniform(0.70, 0.88), 3)
            write_lat = round(random.uniform(45, 95), 1)
        elif p["role"] == "ml-inference":
            cpu = round(random.uniform(0.72, 0.91), 3)
            mem = round(random.uniform(0.60, 0.80), 3)
            write_lat = None
        elif p["role"] == "sensor-ingestion":
            cpu = round(random.uniform(0.30, 0.55), 3)
            mem = round(random.uniform(0.75, 0.92), 3)
            write_lat = None
        else:
            cpu = round(random.uniform(0.10, 0.35), 3)
            mem = round(random.uniform(0.20, 0.45), 3)
            write_lat = None

        result.append({
            "pod": p["name"],
            "namespace": p["namespace"],
            "role": p["role"],
            "cpu_utilization": cpu,
            "memory_utilization": mem,
            "write_latency_ms": write_lat,
            "restart_count": random.randint(0, 3),
            "status": "Running",
            "node": "edge-node-01",
            "timestamp": now,
        })
    return result


def _mock_timeseries(metric: str, pod: str = None):
    now = int(time.time())
    pods_data = []
    pod_list = [
        ("historian-0", "industrial"),
        ("ml-inference-6b9d4f-xk2p9", "industrial"),
        ("sensor-ingestion-85f6d-9q3r1", "industrial"),
        ("alerting-5d8c7b-zx7w2", "industrial"),
    ]
    if pod:
        pod_list = [(p, n) for p, n in pod_list if pod in p]

    for pname, ns in pod_list:
        values = []
        base = 0.3 if "cpu" in metric else 200_000_000
        spike_start = 14

        for i in range(20):
            ts = now - (19 - i) * 30
            if i >= spike_start and "historian" in pname and metric in ("cpu", "write_latency"):
                jitter = random.uniform(0.3, 0.5)
            else:
                jitter = random.uniform(-0.05, 0.1)

            val = base * (1 + jitter)
            values.append([ts, str(round(val, 4))])

        pods_data.append({
            "metric": {"pod": pname, "namespace": ns},
            "values": values,
        })
    return pods_data


def _mock_cascade_chains():
    return [{
        "chain_id": "cascade_demo_001",
        "steps": [
            {"step": 1, "pod": "historian-0", "event": "PVC write latency spike",
             "detail": "historian-0: PVC write latency 78ms (baseline 5ms, 15× degradation) — cascade risk: downstream inference queue will back up"},
            {"step": 2, "pod": "ml-inference", "event": "CPU saturation / queue overflow",
             "detail": "ml-inference: CPU at 89.2% — input queue at 87% capacity, retry storm from historian backpressure"},
            {"step": 3, "pod": "sensor-ingestion", "event": "Memory bloat / packet drop",
             "detail": "sensor-ingestion: Memory at 88.3% — dropping 3.2% of packets from sensor_group_C"},
            {"step": 4, "pod": "alerting", "event": "Incomplete data — blind spot risk",
             "detail": "alerting: Receiving incomplete sensor stream — temperature_anomaly rule cannot evaluate"},
        ],
        "root_cause": "PVC write degradation in historian pod",
        "affected_pods": ["historian-0", "ml-inference-6b9d4f-xk2p9", "sensor-ingestion-85f6d-9q3r1", "alerting-5d8c7b-zx7w2"],
        "severity": "critical",
        "recommendation": (
            "1. Throttle historian write rate or add PVC IOPS limit (ioLimit: 500). "
            "2. Add backpressure queue (Redis/Kafka) between historian and ML inference. "
            "3. Scale ML inference horizontally or reduce model batch size from 32 to 16. "
            "4. Add circuit breaker on alerting pod to use cached baseline when sensor stream is degraded."
        ),
        "detected_at": (datetime.now() - timedelta(minutes=3)).isoformat(),
    }]


def _mock_insights():
    ts_base = time.time()
    return [
        {"id": f"pvc_agent_{int(ts_base-30)}", "source_agent": "pvc_agent", "pod": "historian-0",
         "namespace": "industrial", "severity": "critical", "metric": "write_latency_ms", "value": 78.3,
         "message": "historian-0: PVC write latency 78ms (baseline 5ms, 15× degradation) — cascade risk",
         "timestamp": (datetime.now() - timedelta(seconds=30)).isoformat()},
        {"id": f"cpu_agent_{int(ts_base-45)}", "source_agent": "cpu_agent", "pod": "ml-inference-6b9d4f-xk2p9",
         "namespace": "industrial", "severity": "critical", "metric": "cpu_utilization", "value": 89.2,
         "message": "ml-inference: CPU at 89.2% — possible saturation or retry storm",
         "timestamp": (datetime.now() - timedelta(seconds=45)).isoformat()},
        {"id": f"memory_agent_{int(ts_base-60)}", "source_agent": "memory_agent", "pod": "sensor-ingestion-85f6d-9q3r1",
         "namespace": "industrial", "severity": "warning", "metric": "memory_utilization", "value": 88.3,
         "message": "sensor-ingestion: Memory at 88.3% — buffer bloat, sensor ingestion queue may be backing up",
         "timestamp": (datetime.now() - timedelta(seconds=60)).isoformat()},
        {"id": f"log_agent_{int(ts_base-75)}", "source_agent": "log_agent", "pod": "historian-0",
         "namespace": "industrial", "severity": "critical", "metric": "log_storage_error_count", "value": 3,
         "message": 'historian-0: 3× \'storage_error\' in logs — sample: "ERROR fsync timeout after 5000ms"',
         "timestamp": (datetime.now() - timedelta(seconds=75)).isoformat()},
        {"id": f"log_agent_{int(ts_base-90)}", "source_agent": "log_agent", "pod": "sensor-ingestion-85f6d-9q3r1",
         "namespace": "industrial", "severity": "warning", "metric": "log_packet_drop_count", "value": 7,
         "message": 'sensor-ingestion: 7× \'packet_drop\' in logs — sample: "WARN Buffer overflow — dropping 12 packets"',
         "timestamp": (datetime.now() - timedelta(seconds=90)).isoformat()},
    ]


def _mock_dependency_map():
    return {
        "nodes": [
            {"id": "historian-0", "role": "historian", "namespace": "industrial"},
            {"id": "ml-inference", "role": "ml-inference", "namespace": "industrial"},
            {"id": "sensor-ingestion", "role": "sensor-ingestion", "namespace": "industrial"},
            {"id": "alerting", "role": "alerting", "namespace": "industrial"},
        ],
        "edges": [
            {"from": "historian-0", "to": "ml-inference", "type": "data-dependency"},
            {"from": "ml-inference", "to": "sensor-ingestion", "type": "data-dependency"},
            {"from": "sensor-ingestion", "to": "alerting", "type": "data-dependency"},
            {"from": "ml-inference", "to": "alerting", "type": "inference-result"},
        ],
        "cascade_path": ["historian-0", "ml-inference", "sensor-ingestion", "alerting"],
    }


def _combine_pod_metrics(cpu_data, mem_data) -> list:
    result = {}
    for m in cpu_data:
        pod = m["metric"].get("pod", "unknown")
        ns = m["metric"].get("namespace", "default")
        result[pod] = {
            "pod": pod,
            "namespace": ns,
            "cpu_utilization": round(float(m["value"][1]), 3),
            "memory_utilization": 0,
            "status": "Running",
        }
    for m in mem_data:
        pod = m["metric"].get("pod", "unknown")
        if pod in result:
            result[pod]["memory_utilization"] = round(float(m["value"][1]) / (512 * 1024 * 1024), 3)
    return list(result.values())


def _build_dependency_map(pods: list, dep_map: dict) -> dict:
    nodes = [
        {"id": p["metadata"]["name"], "namespace": p["metadata"]["namespace"],
         "role": p["metadata"]["name"].split("-")[0]}
        for p in pods
    ]
    edges = []
    for pod, deps in dep_map.items():
        for dep in deps:
            edges.append({"from": dep, "to": pod, "type": "data-dependency"})
    return {"nodes": nodes, "edges": edges, "cascade_path": list(dep_map.keys())}

app.mount("/assets", StaticFiles(directory="static/assets"), name="assets")


@app.get("/")
async def serve_dashboard():
    return FileResponse("static/index.html")