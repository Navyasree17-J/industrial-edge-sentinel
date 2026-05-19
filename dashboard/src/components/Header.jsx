import { useData } from "../context/DataContext";
import { AGENT_LABELS } from "../utils/mockData";

const AGENT_KEYS = ["cpu_agent", "memory_agent", "pvc_agent", "log_agent"];

function AgentPill({ agent, status }) {
  const label = AGENT_LABELS[agent] || agent;

  const colors = {
    ok: {
      bg: "rgba(16,185,129,0.12)",
      border: "#10b981",
      text: "#10b981",
    },
    busy: {
      bg: "rgba(245,158,11,0.12)",
      border: "#f59e0b",
      text: "#f59e0b",
    },
    error: {
      bg: "rgba(239,68,68,0.12)",
      border: "#ef4444",
      text: "#ef4444",
    },
    idle: {
      bg: "rgba(148,163,184,0.12)",
      border: "#94a3b8",
      text: "#94a3b8",
    },
  };

  const c = colors[status] || colors.idle;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 5,
        padding: "4px 10px",
        borderRadius: 20,
        background: c.bg,
        border: `1px solid ${c.border}`,
        fontSize: 10,
        fontWeight: 600,
        color: c.text,
        letterSpacing: "0.04em",
      }}
    >
      <span
        style={{
          width: 5,
          height: 5,
          borderRadius: "50%",
          background: c.border,
          animation: status === "ok" ? "pulse-dot 2s infinite" : "none",
        }}
      />
      {label}
    </div>
  );
}

export default function Header({
  activeTab,
  onTabChange,
  theme,
  setTheme,
}) {
  const { agentStatus, apiOnline, lastUpdate, chains } = useData();

  return (
    <header
      style={{
        background: "var(--bg-header)",
        borderBottom: "1px solid var(--border)",
        position: "sticky",
        top: 0,
        zIndex: 100,
        boxShadow: "var(--shadow-sm)",
      }}
    >
      {/* Main header row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: "0 20px",
          height: 58,
        }}
      >
        {/* Logo */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              background:
                "linear-gradient(135deg,#f59e0b,#ef4444)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 17,
              boxShadow: "var(--shadow-md)",
            }}
          >
            ⚡
          </div>

          <div>
            <div
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: "#f8fafc",
                letterSpacing: "-0.01em",
              }}
            >
              Industrial Edge Anomaly Sentinel
            </div>

            <div
              style={{
                fontSize: 10,
                color: "#94a3b8",
                marginTop: 1,
              }}
            >
              ABB Edge Platform · Kubernetes · Multi-agent AI
            </div>
          </div>
        </div>

        <div style={{ flex: 1 }} />

        {/* Agent Pills */}
        <div style={{ display: "flex", gap: 6 }}>
          {AGENT_KEYS.map((k) => (
            <AgentPill
              key={k}
              agent={k}
              status={agentStatus[k] || "idle"}
            />
          ))}
        </div>

        {/* Live Status */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 10,
            color: "#94a3b8",
            flexShrink: 0,
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: apiOnline ? "#10b981" : "#f59e0b",
              animation: "pulse-dot 2s infinite",
            }}
          />

          {apiOnline ? "Live" : "Demo mode"}

          &nbsp;·&nbsp;

          {lastUpdate.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })}
        </div>

        {/* Theme Toggle */}
        <button
          onClick={() =>
            setTheme(theme === "dark" ? "light" : "dark")
          }
          style={{
            marginLeft: 10,
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid var(--border)",
            background: "var(--bg-card)",
            color: "var(--text-primary)",
            cursor: "pointer",
            fontSize: 16,
            transition: "var(--transition)",
          }}
        >
          {theme === "dark" ? "☀️" : "🌙"}
        </button>
      </div>

      {/* Cascade Alert */}
      {chains.length > 0 && (
        <div
          style={{
            background: "#7f1d1d",
            padding: "8px 20px",
            display: "flex",
            alignItems: "center",
            gap: 10,
            animation: "slide-in-down 0.3s ease",
          }}
        >
          <span style={{ fontSize: 14 }}>⚡</span>

          <div style={{ flex: 1 }}>
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "#fecaca",
              }}
            >
              CASCADE FAILURE DETECTED —
            </span>

            <span
              style={{
                fontSize: 11,
                color: "#fca5a5",
              }}
            >
              {" "}
              Storage stress propagating upstream ·{" "}
              {chains[0].affected_pods?.length || 4} pods affected
            </span>
          </div>

          <button
            onClick={() => onTabChange("cascade")}
            style={{
              fontSize: 11,
              padding: "4px 12px",
              borderRadius: 6,
              fontWeight: 600,
              background: "#ef4444",
              border: "none",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            View chain →
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div
        style={{
          display: "flex",
          gap: 2,
          padding: "0 20px",
          background: "var(--bg-header2)",
        }}
      >
        {[
          { id: "overview", label: "Overview" },
          { id: "pods", label: "Pods" },
          {
            id: "cascade",
            label:
              chains.length > 0
                ? `⚡ Cascade (${chains.length})`
                : "Cascade",
          },
          { id: "insights", label: "Insights" },
          { id: "timeseries", label: "Timeseries" },
          { id: "dependency", label: "Dependency map" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            style={{
              padding: "12px 14px",
              border: "none",
              cursor: "pointer",
              fontSize: 12,
              fontWeight: activeTab === tab.id ? 600 : 500,
              background: "transparent",
              color:
                activeTab === tab.id
                  ? "#f8fafc"
                  : "#94a3b8",
              borderBottom:
                activeTab === tab.id
                  ? "2px solid #f59e0b"
                  : "2px solid transparent",
              transition: "var(--transition)",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </header>
  );
}