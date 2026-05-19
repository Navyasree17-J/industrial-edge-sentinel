import { ROLE_COLORS } from "../utils/mockData";
import { Card, SectionTitle } from "./UI";

const MATRIX_DATA = [
  { pod: "historian-0",               dep: "— (root cause)",              role: "Time-series storage",    risk: "critical", riskLabel: "Root cause" },
  { pod: "ml-inference-6b9d-xk2p",   dep: "historian (PVC write speed)", role: "Anomaly detection",      risk: "warning",  riskLabel: "Step 2 — queue overflow" },
  { pod: "sensor-ingestion-85f-9q3r", dep: "ml-inference (throughput)",   role: "Sensor telemetry (48×)", risk: "warning",  riskLabel: "Step 3 — packet drops" },
  { pod: "alerting-5d8c-zx7w",       dep: "sensor-ingestion + ml-inference", role: "Threshold alerting", risk: "critical", riskLabel: "Step 4 — blind spot" },
];

function PodNode({ role, pod, isActive }) {
  const color = ROLE_COLORS[role] || "var(--text-muted)";
  return (
    <div style={{
      padding: "10px 14px", borderRadius: "var(--radius-md)", minWidth: 110, textAlign: "center",
      background: isActive ? `${color}14` : "var(--bg-surface)",
      border: `${isActive ? "1.5px" : "1px"} solid ${isActive ? color : "var(--border)"}`,
      transition: "var(--transition)",
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, color }}>{role}</div>
      {pod && (
        <>
          <div style={{ fontSize: 9, color: "var(--text-muted)", marginTop: 3 }}>
            CPU {Math.round((pod.cpu || 0) * 100)}%
          </div>
          <div style={{ fontSize: 9, color: "var(--text-muted)" }}>
            MEM {Math.round((pod.mem || 0) * 100)}%
          </div>
          {pod.writeLat && (
            <div style={{ fontSize: 9, color: "var(--amber)", fontWeight: 500 }}>
              LAT {Math.round(pod.writeLat)}ms
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Arrow({ stressed }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", margin: "0 5px", flexShrink: 0 }}>
      <span style={{ fontSize: 16, color: stressed ? "var(--red)" : "var(--border-strong)", lineHeight: 1 }}>→</span>
      <span style={{ fontSize: 8, color: stressed ? "var(--red)" : "var(--text-muted)", marginTop: -2 }}>
        {stressed ? "stressed" : "ok"}
      </span>
    </div>
  );
}

export default function DependencyMap({ pods, depMap }) {
  const podByRole = {};
  (pods || []).forEach(p => { podByRole[p.role] = p; });
  const roles = ["historian", "ml-inference", "sensor-ingestion", "alerting"];
  const cascadeActive = roles.map(r => {
    const p = podByRole[r];
    return p && (p.cpu >= 0.75 || p.mem >= 0.8 || (p.writeLat && p.writeLat > 30));
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Flow diagram */}
      <Card>
        <SectionTitle>Pod dependency chain — cascade propagation path</SectionTitle>
        <div style={{ display: "flex", alignItems: "center", gap: 0, overflowX: "auto", paddingBottom: 4 }}>
          {roles.map((role, i) => (
            <div key={role} style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
              <PodNode role={role} pod={podByRole[role]} isActive={cascadeActive[i]} />
              {i < roles.length - 1 && <Arrow stressed={cascadeActive[i] && cascadeActive[i + 1]} />}
            </div>
          ))}
        </div>
        <div style={{
          marginTop: 12, padding: "8px 12px", background: "var(--bg-surface)",
          borderRadius: "var(--radius-md)", fontSize: 11, color: "var(--text-secondary)",
          border: "1px solid var(--border)",
        }}>
          <strong>Causal chain:</strong> PVC write degradation → historian backpressure → inference queue overflow → sensor packet loss → alerting blind spot
        </div>
      </Card>

      {/* Interdependency matrix */}
      <Card padding="0">
        <div style={{ padding: "14px 16px 10px", borderBottom: "1px solid var(--border)" }}>
          <SectionTitle>Interdependency matrix</SectionTitle>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: "var(--bg-surface)" }}>
                {["Pod", "Depends on", "Role", "Cascade risk"].map(h => (
                  <th key={h} style={{
                    padding: "10px 14px", textAlign: "left", fontWeight: 600,
                    color: "var(--text-secondary)", fontSize: 11,
                    borderBottom: "1px solid var(--border)", whiteSpace: "nowrap",
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MATRIX_DATA.map((row, i) => {
                const sc = row.risk === "critical" ? "var(--red)" : "var(--amber)";
                const sbg = row.risk === "critical" ? "var(--red-bg)" : "var(--amber-bg)";
                return (
                  <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "10px 14px", fontWeight: 600, color: "var(--text-primary)", fontFamily: "var(--font-mono)", fontSize: 11 }}>{row.pod}</td>
                    <td style={{ padding: "10px 14px", color: "var(--text-secondary)" }}>{row.dep}</td>
                    <td style={{ padding: "10px 14px", color: "var(--text-secondary)" }}>{row.role}</td>
                    <td style={{ padding: "10px 14px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{
                          fontSize: 9, padding: "2px 6px", borderRadius: 4,
                          background: sbg, color: sc, fontWeight: 700,
                          textTransform: "uppercase", letterSpacing: "0.04em",
                        }}>
                          {row.risk}
                        </span>
                        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{row.riskLabel}</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Edge info */}
      <Card>
        <SectionTitle>Network edges ({depMap?.edges?.length || 4} connections)</SectionTitle>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {(depMap?.edges || [
            { from: "historian-0", to: "ml-inference-6b9d-xk2p",   type: "data-dependency", label: "PVC I/O" },
            { from: "ml-inference-6b9d-xk2p", to: "sensor-ingestion-85f-9q3r", type: "data-dependency", label: "inference queue" },
            { from: "sensor-ingestion-85f-9q3r", to: "alerting-5d8c-zx7w", type: "data-dependency", label: "sensor stream" },
            { from: "ml-inference-6b9d-xk2p", to: "alerting-5d8c-zx7w", type: "inference-result", label: "anomaly score" },
          ]).map((edge, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "7px 10px", background: "var(--bg-surface)", borderRadius: "var(--radius-sm)",
              fontSize: 11,
            }}>
              <span style={{ fontFamily: "var(--font-mono)", color: "var(--text-primary)", fontSize: 10 }}>{edge.from.split("-")[0]}</span>
              <span style={{ color: "var(--amber)", fontWeight: 600 }}>→</span>
              <span style={{ fontFamily: "var(--font-mono)", color: "var(--text-primary)", fontSize: 10 }}>{edge.to.split("-")[0]}</span>
              <span style={{ flex: 1 }} />
              <span style={{ fontSize: 9, color: "var(--text-muted)" }}>{edge.label || edge.type}</span>
              <span style={{
                fontSize: 9, padding: "1px 6px", borderRadius: 3,
                background: edge.type === "data-dependency" ? "var(--blue-bg)" : "var(--purple-bg)",
                color: edge.type === "data-dependency" ? "var(--blue)" : "var(--purple)",
                fontWeight: 500,
              }}>
                {edge.type}
              </span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
