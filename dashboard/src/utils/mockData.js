// Rich mock data — used when backend/Prometheus is unreachable

export const PODS_BASE = [
  { pod: "historian-0",               role: "historian",        ns: "industrial", cpu: 0.63, mem: 0.75, writeLat: 68, restarts: 1, node: "edge-node-01", status: "Running" },
  { pod: "ml-inference-6b9d-xk2p",   role: "ml-inference",    ns: "industrial", cpu: 0.87, mem: 0.68, writeLat: null, restarts: 2, node: "edge-node-01", status: "Running" },
  { pod: "sensor-ingestion-85f-9q3r", role: "sensor-ingestion",ns: "industrial", cpu: 0.40, mem: 0.84, writeLat: null, restarts: 0, node: "edge-node-01", status: "Running" },
  { pod: "alerting-5d8c-zx7w",       role: "alerting",         ns: "industrial", cpu: 0.17, mem: 0.31, writeLat: null, restarts: 0, node: "edge-node-01", status: "Running" },
  { pod: "prometheus-0",             role: "monitoring",        ns: "monitoring", cpu: 0.11, mem: 0.27, writeLat: null, restarts: 0, node: "edge-node-01", status: "Running" },
];

export const ROLE_COLORS = {
  "historian":        "var(--historian-color)",
  "ml-inference":     "var(--inference-color)",
  "sensor-ingestion": "var(--sensor-color)",
  "alerting":         "var(--alerting-color)",
  "monitoring":       "var(--monitoring-color)",
};

export const AGENT_COLORS = {
  cpu_agent:    "var(--cpu-agent)",
  memory_agent: "var(--mem-agent)",
  pvc_agent:    "var(--pvc-agent)",
  log_agent:    "var(--log-agent)",
};

export const AGENT_LABELS = {
  cpu_agent:    "CPU",
  memory_agent: "MEM",
  pvc_agent:    "PVC",
  log_agent:    "LOG",
};

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function rand(a, b)        { return a + Math.random() * (b - a); }

export function tickPods(pods, tick) {
  return pods.map((p, i) => {
    const spike = tick > 8 && i < 2;
    if (i === 0) return { ...p, cpu: clamp(p.cpu + (spike ? 0.02 : 0) + rand(-0.025, 0.03), 0, 0.99), mem: clamp(p.mem + rand(-0.01, 0.02), 0, 0.99), writeLat: clamp(p.writeLat + (spike ? 4 : -2) + rand(-3, 5), 5, 120) };
    if (i === 1) return { ...p, cpu: clamp(p.cpu + (spike ? 0.015 : 0) + rand(-0.03, 0.03), 0, 0.99), mem: clamp(p.mem + rand(-0.01, 0.02), 0, 0.99) };
    return { ...p, cpu: clamp(p.cpu + rand(-0.025, 0.025), 0, 0.99), mem: clamp(p.mem + rand(-0.015, 0.015), 0, 0.99) };
  });
}

export function generateInsight(pods, tick) {
  const agents = ["pvc_agent", "cpu_agent", "memory_agent", "log_agent"];
  const agent  = agents[Math.floor(Math.random() * agents.length)];
  const pod    = pods[Math.floor(Math.random() * 4)];
  const sev    = tick % 6 === 0 ? "critical" : "warning";
  const msgs = {
    pvc_agent:    `${pods[0].pod}: PVC write latency ${Math.round(pods[0].writeLat || 68)}ms (baseline 5ms, ${Math.round((pods[0].writeLat || 68) / 5)}× degradation) — cascade risk`,
    cpu_agent:    `${pod.pod}: CPU at ${Math.round(pod.cpu * 100)}% — possible saturation or retry storm`,
    memory_agent: `${pod.pod}: Memory at ${Math.round(pod.mem * 100)}% — buffer bloat detected`,
    log_agent:    `${pod.pod}: ${Math.floor(2 + Math.random() * 5)}× '${["timeout","retry","packet_drop","storage_error"][Math.floor(Math.random()*4)]}' in recent logs`,
  };
  return { id: `${agent}_${Date.now()}`, source_agent: agent, pod: pod.pod, namespace: pod.ns, severity: sev, metric: agent.replace("_agent","")+"_util", value: parseFloat((65 + Math.random() * 30).toFixed(1)), message: msgs[agent], timestamp: new Date().toISOString() };
}

export function generateCascadeChain(pods) {
  return {
    chain_id: "cascade_demo_001",
    root_cause: "PVC write degradation in historian pod",
    severity: "critical",
    detected_at: new Date().toISOString(),
    affected_pods: ["historian-0", "ml-inference-6b9d-xk2p", "sensor-ingestion-85f-9q3r", "alerting-5d8c-zx7w"],
    steps: [
      { step: 1, pod: "historian-0",               event: "PVC write latency spike",       detail: `historian-0: PVC write latency ${Math.round(pods[0]?.writeLat||68)}ms (baseline 5ms) — cascade root cause` },
      { step: 2, pod: "ml-inference-6b9d-xk2p",   event: "CPU saturation / queue overflow",detail: `ml-inference: CPU at ${Math.round((pods[1]?.cpu||0.87)*100)}% — input queue at 87% capacity, retry storm` },
      { step: 3, pod: "sensor-ingestion-85f-9q3r", event: "Memory bloat / packet drop",    detail: `sensor-ingestion: Memory at ${Math.round((pods[2]?.mem||0.84)*100)}% — dropping 3.2% of packets from sensor_group_C` },
      { step: 4, pod: "alerting-5d8c-zx7w",       event: "Incomplete data — blind spot",   detail: "alerting: Receiving incomplete sensor stream — temperature_anomaly rule cannot evaluate" },
    ],
    recommendation: "1. Throttle historian write rate or add PVC IOPS limit (ioLimit: 500 IOPS).\n2. Add backpressure queue (Redis/Kafka) between historian and ML inference.\n3. Scale ML inference horizontally or reduce model batch size from 32 to 16.\n4. Add circuit breaker on alerting pod to use cached baseline when sensor stream is degraded.",
  };
}

export function initTimeseries(points = 25) {
  const now   = Date.now();
  const bases = { historian: 0.62, mlInference: 0.45, sensorIngestion: 0.38, alerting: 0.17 };
  const result = {};
  Object.entries(bases).forEach(([k, base]) => {
    result[k] = Array.from({ length: points }, (_, i) => {
      const spike = i > 18 && (k === "historian" || k === "mlInference");
      const t = new Date(now - (points - i) * 3000);
      return {
        time: t.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
        cpu: clamp(base + (spike ? 0.25 : 0) + rand(-0.04, 0.06), 0, 0.99),
        mem: clamp(base + 0.12 + rand(-0.03, 0.04), 0, 0.99),
        wl:  k === "historian" ? clamp(8 + (spike ? 60 : 0) + rand(0, 10), 5, 120) : undefined,
      };
    });
  });
  return result;
}

export function pushTimeseries(prev, pods) {
  const now  = new Date();
  const time = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const next = { ...prev };
  const keys = ["historian", "mlInference", "sensorIngestion", "alerting"];
  const podIdx = [0, 1, 2, 3];
  keys.forEach((k, i) => {
    const p    = pods[podIdx[i]] || pods[0];
    const last = prev[k]?.[prev[k].length - 1] || {};
    const entry = { time, cpu: clamp(p.cpu + rand(-0.02, 0.02), 0, 0.99), mem: clamp(p.mem + rand(-0.01, 0.01), 0, 0.99) };
    if (k === "historian") entry.wl = clamp((last.wl || 10) + (p.writeLat > 50 ? rand(3, 8) : rand(-3, 2)), 5, 120);
    const arr = [...(prev[k] || []), entry];
    next[k] = arr.slice(-30);
  });
  return next;
}

export function getDependencyMap(pods) {
  return {
    nodes: [
      { id: "historian-0",               role: "historian",        ns: "industrial" },
      { id: "ml-inference-6b9d-xk2p",   role: "ml-inference",    ns: "industrial" },
      { id: "sensor-ingestion-85f-9q3r", role: "sensor-ingestion",ns: "industrial" },
      { id: "alerting-5d8c-zx7w",       role: "alerting",         ns: "industrial" },
    ],
    edges: [
      { from: "historian-0",               to: "ml-inference-6b9d-xk2p",   type: "data-dependency", label: "PVC I/O" },
      { from: "ml-inference-6b9d-xk2p",   to: "sensor-ingestion-85f-9q3r",type: "data-dependency", label: "inference queue" },
      { from: "sensor-ingestion-85f-9q3r",to: "alerting-5d8c-zx7w",       type: "data-dependency", label: "sensor stream" },
      { from: "ml-inference-6b9d-xk2p",   to: "alerting-5d8c-zx7w",       type: "inference-result",label: "anomaly score" },
    ],
    cascade_path: ["historian-0", "ml-inference-6b9d-xk2p", "sensor-ingestion-85f-9q3r", "alerting-5d8c-zx7w"],
  };
}
