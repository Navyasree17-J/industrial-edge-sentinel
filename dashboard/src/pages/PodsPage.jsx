import { useState } from "react";
import { useData } from "../context/DataContext";
import PodCard from "../components/PodCard";
import { SectionTitle, Card } from "../components/UI";
import { ROLE_COLORS } from "../utils/mockData";

function PodDetail({ pod }) {
  if (!pod) return null;
  const roleColor = ROLE_COLORS[pod.role] || "var(--text-muted)";

  const rows = [
    { label: "Namespace",     value: pod.ns || pod.namespace || "industrial" },
    { label: "Node",          value: pod.node || "edge-node-01" },
    { label: "Status",        value: pod.status || "Running" },
    { label: "Restarts",      value: pod.restarts ?? 0 },
    { label: "CPU",           value: `${Math.round(pod.cpu * 100)}%` },
    { label: "Memory",        value: `${Math.round(pod.mem * 100)}%` },
    pod.writeLat != null
      ? { label: "Write latency", value: `${Math.round(pod.writeLat)}ms` }
      : null,
  ].filter(Boolean);

  return (
    <Card style={{ position: "sticky", top: 80 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <div style={{
          width: 36, height: 36, borderRadius: "var(--radius-md)",
          background: `${roleColor}18`, display: "flex", alignItems: "center",
          justifyContent: "center", fontSize: 18,
        }}>
          {{ historian: "🗄️", "ml-inference": "🧠", "sensor-ingestion": "📡", alerting: "🔔", monitoring: "📊" }[pod.role] || "📦"}
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>{pod.pod}</div>
          <div style={{ fontSize: 10, color: roleColor, fontWeight: 600, marginTop: 2 }}>{pod.role}</div>
        </div>
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderBottom: i < rows.length - 1 ? "1px solid var(--border)" : "none" }}>
              <td style={{ padding: "7px 0", color: "var(--text-secondary)", width: "45%" }}>{row.label}</td>
              <td style={{ padding: "7px 0", fontWeight: 500, color: "var(--text-primary)", fontFamily: typeof row.value === "number" || /\d/.test(String(row.value)) ? "var(--font-mono)" : "inherit" }}>
                {row.value}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

export default function PodsPage() {
  const { pods } = useData();
  const [selectedPod, setSelectedPod] = useState(null);
  const [nsFilter, setNsFilter]       = useState("all");

  const namespaces = [...new Set(pods.map(p => p.ns || p.namespace || "default"))];
  const filtered   = nsFilter === "all" ? pods : pods.filter(p => (p.ns || p.namespace) === nsFilter);

  return (
    <div style={{ display: "grid", gridTemplateColumns: selectedPod ? "1fr 280px" : "1fr", gap: 16 }}>
      {/* Pod grid */}
      <div>
        {/* Filter bar */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <SectionTitle>All pods ({filtered.length})</SectionTitle>
          <div style={{ flex: 1 }} />
          <div style={{ display: "flex", gap: 5 }}>
            {["all", ...namespaces].map(ns => (
              <button
                key={ns}
                onClick={() => setNsFilter(ns)}
                style={{
                  padding: "4px 10px", borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border)", background: nsFilter === ns ? "var(--bg-header)" : "var(--bg-card)",
                  color: nsFilter === ns ? "var(--text-inverse)" : "var(--text-secondary)",
                  fontSize: 11, cursor: "pointer", fontWeight: nsFilter === ns ? 600 : 400,
                }}
              >
                {ns}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: selectedPod ? "1fr" : "1fr 1fr", gap: 10 }}>
          {filtered.map(pod => (
            <PodCard
              key={pod.pod}
              pod={pod}
              isSelected={selectedPod?.pod === pod.pod}
              onClick={p => setSelectedPod(prev => prev?.pod === p.pod ? null : p)}
            />
          ))}
        </div>
      </div>

      {/* Detail panel */}
      {selectedPod && <PodDetail pod={selectedPod} />}
    </div>
  );
}
