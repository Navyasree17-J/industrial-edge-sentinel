import { useState } from "react";
import { useData } from "../context/DataContext";
import InsightFeed from "../components/InsightFeed";

const SEVERITIES = ["all", "critical", "warning", "info"];
const AGENTS     = ["all", "cpu_agent", "memory_agent", "pvc_agent", "log_agent"];
const AGENT_LABELS = { cpu_agent: "CPU", memory_agent: "MEM", pvc_agent: "PVC", log_agent: "LOG" };

function FilterPill({ value, active, onClick, color }) {
  return (
    <button
      onClick={() => onClick(value)}
      style={{
        padding: "4px 12px", borderRadius: 20, border: "1px solid var(--border)",
        background: active ? "var(--bg-header)" : "var(--bg-card)",
        color: active ? "var(--text-inverse)" : "var(--text-secondary)",
        fontSize: 11, cursor: "pointer", fontWeight: active ? 600 : 400,
        transition: "var(--transition)",
      }}
    >
      {value === "all" ? "All" : AGENT_LABELS[value] || value}
    </button>
  );
}

export default function InsightsPage() {
  const { insights } = useData();
  const [sevFilter,   setSevFilter]   = useState("all");
  const [agentFilter, setAgentFilter] = useState("all");

  const filtered = insights.filter(ins =>
    (sevFilter === "all" || ins.severity === sevFilter) &&
    (agentFilter === "all" || ins.source_agent === agentFilter)
  );

  const counts = { critical: 0, warning: 0, info: 0 };
  insights.forEach(i => { if (counts[i.severity] !== undefined) counts[i.severity]++; });

  return (
    <div>
      {/* Summary row */}
      <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
        {[
          { sev: "critical", color: "var(--red)",   bg: "var(--red-bg)",   label: "Critical" },
          { sev: "warning",  color: "var(--amber)", bg: "var(--amber-bg)", label: "Warning" },
          { sev: "info",     color: "var(--blue)",  bg: "var(--blue-bg)",  label: "Info" },
        ].map(({ sev, color, bg, label }) => (
          <div
            key={sev}
            onClick={() => setSevFilter(sevFilter === sev ? "all" : sev)}
            style={{
              flex: 1, padding: "10px 14px", borderRadius: "var(--radius-md)",
              background: bg, border: `1px solid ${color}44`,
              cursor: "pointer", textAlign: "center",
              outline: sevFilter === sev ? `2px solid ${color}` : "none",
            }}
          >
            <div style={{ fontSize: 20, fontWeight: 700, color }}>{counts[sev]}</div>
            <div style={{ fontSize: 11, color }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 16, marginBottom: 14, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
          <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>SEVERITY:</span>
          {SEVERITIES.map(s => <FilterPill key={s} value={s} active={sevFilter === s} onClick={setSevFilter} />)}
        </div>
        <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
          <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>AGENT:</span>
          {AGENTS.map(a => <FilterPill key={a} value={a} active={agentFilter === a} onClick={setAgentFilter} />)}
        </div>
        <div style={{ marginLeft: "auto", fontSize: 11, color: "var(--text-muted)", alignSelf: "center" }}>
          Showing {filtered.length} of {insights.length} insights
        </div>
      </div>

      <InsightFeed insights={filtered} maxItems={50} />
    </div>
  );
}
