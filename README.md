HEAD
# ⚡ Industrial Edge Anomaly Sentinel

**A multi-agent AI system for real-time pod resource analysis and cascading failure detection on industrial edge Kubernetes deployments.**

Built for ABB's accelerator program — targeting industrial IoT edge environments running K3s or MicroK8s on single-node clusters where downtime means equipment failure, not just inconvenience.

---

## Architecture overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Industrial Edge Node (K3s/MicroK8s)              │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │               Industrial Namespace                           │   │
│  │  ┌────────────┐  ┌──────────────┐  ┌──────────────────────┐ │   │
│  │  │ historian  │  │ ml-inference │  │  sensor-ingestion    │ │   │
│  │  │ (TimescaleDB│  │ (anomaly det.)│  │  (48 sensors@100Hz) │ │   │
│  │  │  + PVC)    │  │              │  │                      │ │   │
│  │  └─────┬──────┘  └──────┬───────┘  └──────────┬───────────┘ │   │
│  │        │  PVC I/O       │ queue              │ buffer       │   │
│  │        └────────────────┴────────────────────┘              │   │
│  │                         │                                   │   │
│  │                  ┌──────▼──────┐                            │   │
│  │                  │  alerting   │  (fires alarms)            │   │
│  │                  └─────────────┘                            │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │               Sentinel Namespace                             │   │
│  │                                                             │   │
│  │   ┌─────────────────────────────────────────────────────┐   │   │
│  │   │             Multi-Agent Orchestrator                │   │   │
│  │   │                                                     │   │   │
│  │   │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────┐  │   │   │
│  │   │  │CPU Agent │ │MEM Agent │ │PVC Agent │ │LOG    │  │   │   │
│  │   │  │|inference│ │(sensor   │ │(historian│ │Agent  │  │   │   │
│  │   │  │ saturat.)│ │ bloat)   │ │ write    │ │(retry │  │   │   │
│  │   │  │          │ │          │ │ latency) │ │ storms│  │   │   │
│  │   │  └────┬─────┘ └────┬─────┘ └────┬─────┘ └───┬───┘  │   │   │
│  │   │       └────────────┴────────────┴────────────┘      │   │   │
│  │   │                  Signal routing                      │   │   │
│  │   │               (cascade detection)                    │   │   │
│  │   └─────────────────────┬───────────────────────────────┘   │   │
│  │                         │                                   │   │
│  │   ┌─────────────────────▼───────────────────────────────┐   │   │
│  │   │        FastAPI REST API  +  SSE stream               │   │   │
│  │   └─────────────────────┬───────────────────────────────┘   │   │
│  │                         │                                   │   │
│  │   ┌─────────────────────▼───────────────────────────────┐   │   │
│  │   │         React Dashboard  (NodePort :30080)          │   │   │
│  │   └─────────────────────────────────────────────────────┘   │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  Monitoring: Prometheus + node-exporter + kube-state-metrics │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## The cascade failure problem this solves

Without the Sentinel, this failure happens silently:

```
PVC write speed degrades (historian hammering storage)
        ↓
ML inference pod input queue backs up
        ↓
Sensor ingestion starts dropping packets
        ↓
Alerting pod receives incomplete data
        ↓
Real anomaly goes undetected — equipment failure
```

The Sentinel detects the **causal chain before equipment failure**, surfacing:
"Storage stress on historian PVC is propagating upstream — 3 downstream pods show correlated degradation"

---

## ABB focus area mapping

| ABB Focus Area | How this project addresses it |
|---|---|
| Data and AI | Multi-agent AI framework with CPU, Memory, PVC, and Log/IO specialist agents |
| IoT | Sensor ingestion pod monitoring at 100Hz across 48 factory-floor sensors |
| Operational Technology (OT) | Edge-local analysis — no cloud connectivity required |
| Advanced Automation | Automated root-cause chain analysis and intelligent recommendations |
| Application & Business Process Monitoring | Real-time pod resource monitoring with NLP insights |
| Cloud, Hosting & Infrastructure | Kubernetes-native, K3s/MicroK8s compatible, RBAC-secured |
| Digital Workplace | Rich real-time dashboard with anomaly timeline and dependency map |
| Sustainability | Prevents unplanned downtime; optimizes resource usage on edge hardware |

---

## Project structure

```
industrial-edge-sentinel/
├── backend/
│   ├── agents/
│   │   ├── orchestrator.py     # Multi-agent coordinator + cascade detector
│   │   ├── cpu_agent.py        # CPU saturation detection
│   │   ├── memory_agent.py     # Buffer bloat + OOM risk
│   │   ├── pvc_agent.py        # Write latency + IOPS + disk capacity
│   │   └── log_agent.py        # Log parsing (timeouts, retries, drops)
│   ├── collectors/
│   │   ├── prometheus_client.py  # Pull-based Prometheus queries
│   │   └── k8s_client.py         # Pod discovery + log streaming
│   └── api/
│       └── server.py           # FastAPI endpoints + SSE stream
├── dashboard/
│   ├── src/
│   │   └── App.jsx             # Full React dashboard
│   ├── Dockerfile
│   └── package.json
├── k8s/
│   ├── manifests/
│   │   ├── industrial-workloads.yaml   # 4 industrial pod categories
│   │   └── sentinel-deployment.yaml    # Sentinel backend + dashboard
│   ├── rbac/
│   │   └── rbac.yaml                   # Read-only cluster access
│   └── monitoring/
│       └── prometheus.yaml             # Prometheus + alert rules
├── scripts/
│   ├── deploy.sh               # One-command K8s deploy
│   └── dev.sh                  # Local dev (no K8s needed)
├── docker-compose.yml          # Full-stack local testing
├── Dockerfile.backend
└── requirements.txt
```

---

## Quick start

### Option 1 — Local dev (no Kubernetes needed)

```bash
git clone <your-repo> && cd industrial-edge-sentinel

# Backend (Python 3.12+)
pip install -r requirements.txt
uvicorn backend.api.server:app --reload --port 8000

# Dashboard (Node 20+)
cd dashboard && npm install && npm run dev
```

Open http://localhost:3000 — runs with mock data when Prometheus/K8s is unreachable.

### Option 2 — Docker Compose (full stack)

```bash
docker compose up -d
```

- Dashboard: http://localhost:3000
- API docs: http://localhost:8000/docs
- Prometheus: http://localhost:9090

### Option 3 — K3s/MicroK8s deploy

```bash
# For K3s
export REGISTRY=your-registry.io/your-org
bash scripts/deploy.sh

# Access
# Dashboard:  http://<node-ip>:30080
# API:        http://<node-ip>:30800
```

For MicroK8s:
```bash
microk8s enable dns storage prometheus
export KUBECONFIG=/var/snap/microk8s/current/credentials/client.config
bash scripts/deploy.sh
```

For Minikube:
```bash
eval $(minikube docker-env)   # Use minikube's Docker daemon
export REGISTRY=localhost
bash scripts/deploy.sh
minikube service sentinel-dashboard -n sentinel
```

---

## API reference

| Endpoint | Description |
|---|---|
| `GET /health` | Health check |
| `GET /api/v1/metrics/pods` | Current CPU/memory/PVC for all pods |
| `GET /api/v1/metrics/timeseries/{metric}` | Historical data (cpu, memory, write_latency) |
| `GET /api/v1/cascade/chains` | Detected cascade failure chains |
| `GET /api/v1/insights?severity=critical` | Agent insights, filterable |
| `GET /api/v1/dependency-map` | Pod interdependency graph |
| `GET /api/v1/stream/insights` | Server-Sent Events live stream |

Full OpenAPI docs at `/docs`.

---

## Dashboard tabs

| Tab | What it shows |
|---|---|
| Overview | Split view: pod cards (left) + live agent insights (right) |
| Pods | All pod resource cards with CPU/memory/write-latency bars |
| Cascade | Causal chain visualization + AI recommendations |
| Insights | Live agent insight feed, filterable by severity |
| Timeseries | Real-time charts for CPU, memory, PVC write latency |
| Dependency map | Pod dependency graph + interdependency matrix |

---

## Multi-agent design

### CPU Agent
Monitors ML inference pod for compute saturation. Detects retry storms (CPU spikes caused by upstream backpressure). Threshold: 85% sustained, 95% critical.

### Memory Agent  
Watches sensor ingestion pod for buffer bloat. Detects unbounded queue growth (memory growing > 50 MB/min). Tracks OOM risk (> 92% of limit).

### PVC/Storage Agent
The most critical agent — PVC write degradation is the root cause. Monitors write latency percentiles (warn > 20ms, critical > 60ms), IOPS saturation, I/O queue depth, and disk capacity.

### Log/IO Agent
Parses logs from all four pod categories for: `timeout`, `retry`, `connection_fail`, `packet_drop`, `queue_overflow`, `oom_kill`, `storage_error`, `inference_error`. Can be focused by other agents on specific pods and patterns.

### Signal routing
When the PVC agent detects write degradation, it sends a signal to:
- Log agent → search for timeout/retry messages in downstream pods
- CPU agent → check if retries are causing compute spikes

This cross-agent collaboration enables the cascade detection before the alerting pod goes blind.

---

## Prometheus queries used

```promql
# PVC write latency (root cause metric)
rate(node_disk_write_time_seconds_total[2m]) / rate(node_disk_writes_completed_total[2m]) * 1000

# ML inference CPU saturation
rate(container_cpu_usage_seconds_total{pod=~"ml-inference.*"}[2m])
/ kube_pod_container_resource_limits{resource="cpu",pod=~"ml-inference.*"}

# Sensor ingestion memory (buffer bloat)
container_memory_working_set_bytes{pod=~"sensor-ingestion.*"}
/ kube_pod_container_resource_limits{resource="memory",pod=~"sensor-ingestion.*"}

# I/O queue depth
node_disk_io_now
```

---

## Edge deployment constraints

The system self-limits for edge hardware:
- Backend: 100m CPU request, 500m limit, 128MB–512MB memory
- Dashboard: 50m CPU, 200m limit, 64MB–256MB memory
- Prometheus: 7-day retention, 5GB max, pull interval 15s
- Single uvicorn worker (not multi-process)
- Quantized LLM fallback planned for next iteration

---

## Roadmap for production hardening

1. Replace mock data with real Prometheus — set `PROMETHEUS_URL` env var
2. Add LLM-powered NLP insights (Ollama + llama3.2 for offline edge inference)  
3. Add PagerDuty/Slack webhook for cascade alerts
4. Add PromQL-based forecasting (predict disk full in N hours)
5. Grafana dashboard JSON export for existing Grafana deployments
6. Helm chart for one-command deploy
7. Multi-node cluster support (currently single-node optimized)

---

## License

MIT — build on this freely for your ABB accelerator submission and beyond.

# industrial-edge-sentinel
ABB Accelerstor Hackathon
fc5552ef373c8f99ef723cc0051467e3a35bee2e
