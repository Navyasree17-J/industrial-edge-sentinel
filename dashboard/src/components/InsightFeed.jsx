import { SeverityBadge, AgentBadge, EmptyState } from "./UI";

function InsightItem({ insight, isNew }) {
  const severityDot = {
    critical: "var(--red)", warning: "var(--amber)", info: "var(--blue)",
  };
  const dot = severityDot[insight.severity] || "var(--blue)";

  const rowBg = isNew
    ? "var(--red-bg)"
    : insight.severity === "warning"
    ? "var(--amber-bg)"
    : "var(--bg-surface)";

  const rowBorder = isNew
    ? "var(--red-border)"
    : insight.severity === "warning"
    ? "var(--amber-border)"
    : "var(--border)";

  return (
    <div
      className={isNew ? "anim-slide-in" : ""}
      style={{
        display: "flex", gap: 10, alignItems: "flex-start",
        padding: "9px 11px", borderRadius: "var(--radius-md)",
        background: rowBg, border: `1px solid ${rowBorder}`,
        marginBottom: 6, transition: "background 0.4s ease",
      }}
    >
      <div style={{
        width: 7, height: 7, borderRadius: "50%", background: dot,
        marginTop: 5, flexShrink: 0,
        animation: isNew ? "pulse-dot 1.5s 3" : "none",
      }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 4 }}>
          <AgentBadge agent={insight.source_agent} />
          <SeverityBadge severity={insight.severity} />
        </div>
        <div style={{ fontSize: 12, color: "var(--text-primary)", lineHeight: 1.55, wordBreak: "break-word" }}>
          {insight.message}
        </div>
        <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 4 }}>
          {new Date(insight.timestamp).toLocaleTimeString()}
          &nbsp;·&nbsp;
          {insight.metric}: <span style={{ fontFamily: "var(--font-mono)" }}>{parseFloat(insight.value).toFixed(1)}</span>
        </div>
      </div>
    </div>
  );
}

export default function InsightFeed({ insights, maxItems = 25 }) {
  if (!insights.length) {
    return <EmptyState icon="✅" title="No anomalies detected" subtitle="All agents nominal — monitoring every 15s" />;
  }

  return (
    <div style={{ overflowY: "auto", maxHeight: "calc(100vh - 280px)" }}>
      {insights.slice(0, maxItems).map((ins, i) => (
        <InsightItem key={ins.id || i} insight={ins} isNew={i === 0} />
      ))}
    </div>
  );
}
