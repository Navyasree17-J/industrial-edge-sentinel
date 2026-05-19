import { useState } from "react";
import { SeverityBadge } from "./UI";

const STEP_COLORS = ["var(--red)", "var(--amber)", "var(--amber)", "var(--red)"];

function ChainStep({ step, isLast }) {
  const color = STEP_COLORS[step.step - 1] || "var(--amber)";
  return (
    <div style={{ display: "flex", gap: 12 }}>
      {/* Timeline spine */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
        <div style={{
          width: 26, height: 26, borderRadius: "50%", background: color,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 11, fontWeight: 700, color: "#fff", flexShrink: 0,
        }}>
          {step.step}
        </div>
        {!isLast && (
          <div style={{ width: 2, flex: 1, background: "var(--red-border)", minHeight: 14, margin: "4px 0", borderRadius: 1 }} />
        )}
      </div>
      {/* Content */}
      <div style={{ paddingBottom: isLast ? 0 : 14 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", marginBottom: 3 }}>
          <span style={{ color }}>{step.pod}</span>
          {" "}—{" "}
          {step.event}
        </div>
        <div style={{ fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.55 }}>
          {step.detail}
        </div>
      </div>
    </div>
  );
}

export default function CascadeChain({ chain }) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div style={{
      border: "1.5px solid var(--red-border)", borderRadius: "var(--radius-lg)",
      overflow: "hidden", background: "var(--bg-card)", marginBottom: 14,
      animation: "cascade-pulse 3s infinite", boxShadow: "var(--shadow-md)",
    }}>
      {/* Header */}
      <div
        onClick={() => setExpanded(e => !e)}
        style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", cursor: "pointer", background: "var(--red-bg)" }}
      >
        <span style={{ fontSize: 18, flexShrink: 0 }}>⚡</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#991b1b" }}>Cascading failure detected</div>
          <div style={{ fontSize: 11, color: "#b91c1c", marginTop: 2 }}>Root cause: {chain.root_cause}</div>
        </div>
        <SeverityBadge severity={chain.severity} />
        <span style={{ fontSize: 12, color: "var(--text-muted)", flexShrink: 0 }}>{expanded ? "▲" : "▼"}</span>
      </div>

      {expanded && (
        <div style={{ padding: "16px 16px" }} className="anim-fade-in">
          {/* Causal chain steps */}
          <div style={{ marginBottom: 16 }}>
            {chain.steps?.map((step, i) => (
              <ChainStep key={i} step={step} isLast={i === chain.steps.length - 1} />
            ))}
          </div>

          {/* Propagation timeline visual */}
          <div style={{
            display: "flex", alignItems: "center", gap: 0, overflowX: "auto",
            padding: "10px 12px", background: "var(--bg-surface)", borderRadius: "var(--radius-md)",
            marginBottom: 14, border: "1px solid var(--border)",
          }}>
            {chain.steps?.map((step, i) => {
              const color = STEP_COLORS[i] || "var(--amber)";
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
                  <div style={{
                    padding: "7px 12px", borderRadius: "var(--radius-md)", minWidth: 100, textAlign: "center",
                    background: `${color}14`, border: `1.5px solid ${color}`,
                  }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color }}>{step.pod.split("-")[0]}</div>
                    <div style={{ fontSize: 9, color: "var(--text-secondary)", marginTop: 2 }}>{step.event.split(" ")[0]}</div>
                  </div>
                  {i < chain.steps.length - 1 && (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", margin: "0 4px", flexShrink: 0 }}>
                      <span style={{ fontSize: 14, color: "var(--red)", lineHeight: 1 }}>→</span>
                      <span style={{ fontSize: 8, color: "var(--red)", marginTop: -2 }}>stress</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* AI Recommendation */}
          <div style={{ background: "var(--blue-bg)", borderRadius: "var(--radius-md)", padding: "12px 14px", border: "1px solid var(--blue-border)" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#1e40af", marginBottom: 6, letterSpacing: "0.05em" }}>
              AI RECOMMENDATION
            </div>
            <div style={{ fontSize: 12, color: "#1e40af", lineHeight: 1.7 }}>
              {chain.recommendation?.split("\n").map((line, i) => (
                <div key={i} style={{ marginBottom: line ? 4 : 0 }}>{line}</div>
              ))}
            </div>
          </div>

          <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 10 }}>
            Detected at {new Date(chain.detected_at).toLocaleTimeString()}
            &nbsp;·&nbsp;
            Affected: {chain.affected_pods?.join(" → ")}
          </div>
        </div>
      )}
    </div>
  );
}
