import { ROLE_COLORS } from "../utils/mockData";
import { MetricBar } from "./UI";
import GaugeChart from "./GaugeChart";

function barColor(v, w, c) {
  return v >= c ? "var(--red)" : v >= w ? "var(--amber)" : "var(--green)";
}

function MetricRow({ label, value, displayValue, warnAt, critAt, max = 1 }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
        <span style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 500 }}>{label}</span>
        <span style={{ fontSize: 10, fontWeight: 600, color: barColor(value, warnAt, critAt) }}>
          {displayValue}
        </span>
      </div>
      <MetricBar value={value} max={max} warnAt={warnAt} critAt={critAt} />
    </div>
  );
}

export default function PodCard({ pod, isSelected, onClick }) {
  const roleColor  = ROLE_COLORS[pod.role] || "var(--text-muted)";
  const isCritical = pod.cpu >= 0.9 || pod.mem >= 0.88 || (pod.writeLat && pod.writeLat > 60);
  const isWarning  = !isCritical && (pod.cpu >= 0.75 || pod.mem >= 0.78 || (pod.writeLat && pod.writeLat > 25));
  const dotColor   = isCritical ? "var(--red)" : isWarning ? "var(--amber)" : "var(--green)";

  return (
    <div
      onClick={() => onClick?.(pod)}
      style={{
        background: isSelected ? "var(--amber-bg)" : "var(--bg-card)",
        border: isSelected ? `1.5px solid var(--amber)` : "1px solid var(--border)",
        borderRadius: "var(--radius-lg)", padding: "12px 14px", cursor: "pointer",
        transition: "var(--transition)", boxShadow: "var(--shadow-sm)",
      }}
    >
      {/* Pod header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <div style={{
          width: 8, height: 8, borderRadius: "50%", background: dotColor, flexShrink: 0,
          animation: isCritical ? "pulse-dot 1.5s infinite" : "none",
        }} />
        <span className="truncate" style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", flex: 1 }}>
          {pod.pod}
        </span>
        <span style={{
          fontSize: 9, padding: "2px 7px", borderRadius: 4, fontWeight: 600, flexShrink: 0,
          background: `${roleColor}18`, color: roleColor, letterSpacing: "0.04em",
        }}>
          {pod.role}
        </span>
      </div>

      {/* Gauge Metrics */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          marginTop: 16,
          flexWrap: "wrap",
        }}
      >
        <GaugeChart
          label="CPU"
          value={Math.round((pod.cpu || 0) * 100)}
          color="#8b5cf6"
        />

        <GaugeChart
          label="Memory"
          value={Math.round((pod.mem || 0) * 100)}
          color="#06b6d4"
        />

        {pod.writeLat != null && (
          <GaugeChart
            label="PVC"
            value={Math.min(Math.round((pod.writeLat / 120) * 100), 100)}
            color="#f59e0b"
          />
        )}
      </div>

      {/* Footer */}
      <div style={{
        marginTop: 10, paddingTop: 8, borderTop: "1px solid var(--border)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <span style={{ fontSize: 9, color: "var(--text-muted)" }}>
          restarts: {pod.restarts ?? 0} &nbsp;·&nbsp; {pod.ns}
        </span>
        <span style={{
          fontSize: 9, padding: "1px 6px", borderRadius: 3,
          background: "var(--green-bg)", color: "var(--green)", fontWeight: 600,
        }}>
          {pod.status || "Running"}
        </span>
      </div>
    </div>
  );
}
