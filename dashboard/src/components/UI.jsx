// Reusable primitive UI components

export function SeverityBadge({ severity }) {
  const styles = {
    critical: { bg: "var(--red-bg)",    border: "var(--red-border)",    text: "#991b1b" },
    warning:  { bg: "var(--amber-bg)",  border: "var(--amber-border)",  text: "#92400e" },
    info:     { bg: "var(--blue-bg)",   border: "var(--blue-border)",   text: "#1e40af" },
  };
  const s = styles[severity] || styles.info;
  return (
    <span style={{
      fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 4,
      background: s.bg, border: `1px solid ${s.border}`, color: s.text,
      textTransform: "uppercase", letterSpacing: "0.05em", flexShrink: 0,
    }}>
      {severity}
    </span>
  );
}

export function AgentBadge({ agent }) {
  const colors = {
    cpu_agent:    { bg: "rgba(139,92,246,0.12)", border: "rgba(139,92,246,0.3)", text: "#7c3aed" },
    memory_agent: { bg: "rgba(6,182,212,0.12)",  border: "rgba(6,182,212,0.3)",  text: "#0891b2" },
    pvc_agent:    { bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.3)", text: "#b45309" },
    log_agent:    { bg: "rgba(16,185,129,0.12)", border: "rgba(16,185,129,0.3)", text: "#059669" },
  };
  const labels = { cpu_agent:"CPU", memory_agent:"MEM", pvc_agent:"PVC", log_agent:"LOG" };
  const c = colors[agent] || colors.cpu_agent;
  return (
    <span style={{
      fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 4,
      background: c.bg, border: `1px solid ${c.border}`, color: c.text,
      letterSpacing: "0.05em", flexShrink: 0,
    }}>
      {labels[agent] || agent}
    </span>
  );
}

export function MetricBar({ value, max = 1, warnAt = 0.7, critAt = 0.9, height = 5 }) {
  const pct  = Math.min((value / max) * 100, 100);
  const color = value / max >= critAt ? "var(--red)" : value / max >= warnAt ? "var(--amber)" : "var(--green)";
  return (
    <div style={{ height, background: "var(--border)", borderRadius: 99, overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 99, transition: "width 0.5s ease" }} />
    </div>
  );
}

export function StatCard({ icon, value, label, color = "var(--text-primary)", sub }) {
  return (
    <div style={{
      background: "var(--bg-card)", borderRadius: "var(--radius-lg)",
      border: "1px solid var(--border)", padding: "14px 16px",
      display: "flex", flexDirection: "column", gap: 4,
      boxShadow: "var(--shadow-sm)",
    }}>
      <div style={{ fontSize: 18 }}>{icon}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>{label}</div>
      {sub && <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{sub}</div>}
    </div>
  );
}

export function SectionTitle({ children, action }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
      <h2 style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{children}</h2>
      {action}
    </div>
  );
}

export function Card({ children, style = {}, padding = "14px 16px" }) {
  return (
    <div style={{
      background: "var(--bg-card)", borderRadius: "var(--radius-lg)",
      border: "1px solid var(--border)", padding, boxShadow: "var(--shadow-sm)",
      ...style,
    }}>
      {children}
    </div>
  );
}

export function EmptyState({ icon = "✅", title, subtitle }) {
  return (
    <div style={{ textAlign: "center", padding: "48px 20px", color: "var(--text-muted)" }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>{icon}</div>
      <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 6 }}>{title}</div>
      {subtitle && <div style={{ fontSize: 12 }}>{subtitle}</div>}
    </div>
  );
}

export function Skeleton({ height = 80, style = {} }) {
  return <div className="skeleton" style={{ height, ...style }} />;
}
