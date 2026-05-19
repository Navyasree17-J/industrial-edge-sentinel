import { useMemo } from "react";

export default function AnomalyTimeline({ insights = [] }) {
  const timeline = useMemo(() => {
    return [...Array(60)].map((_, i) => {
      const hasEvent = Math.random() > 0.72;

      return {
        minute: i,
        severity: hasEvent
          ? ["low", "medium", "high"][
              Math.floor(Math.random() * 3)
            ]
          : null,
      };
    });
  }, [insights]);

  const colors = {
    low: "#10b981",
    medium: "#f59e0b",
    high: "#ef4444",
  };

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        height: 78,
        background: "var(--bg-card)",
        borderTop: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        padding: "10px 18px",
        zIndex: 999,
        backdropFilter: "blur(10px)",
        boxShadow: "0 -4px 12px rgba(0,0,0,0.15)",
      }}
    >
      {/* Title */}
      <div
        style={{
          minWidth: 180,
          paddingRight: 20,
        }}
      >
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: "var(--text-primary)",
          }}
        >
          Anomaly Timeline
        </div>

        <div
          style={{
            fontSize: 11,
            color: "var(--text-muted)",
            marginTop: 2,
          }}
        >
          Last 60 minutes
        </div>
      </div>

      {/* Timeline */}
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          gap: 4,
          overflow: "hidden",
        }}
      >
        {timeline.map((item, idx) => (
          <div
            key={idx}
            title={
              item.severity
                ? `Anomaly (${item.severity})`
                : "No event"
            }
            style={{
              width: 10,
              height: item.severity ? 34 : 14,
              borderRadius: 999,
              background: item.severity
                ? colors[item.severity]
                : "var(--border)",
              transition: "all 0.3s ease",
              cursor: item.severity ? "pointer" : "default",
              animation:
                item.severity === "high"
                  ? "pulse-dot 1.5s infinite"
                  : "none",
            }}
          />
        ))}
      </div>

      {/* Legend */}
      <div
        style={{
          display: "flex",
          gap: 12,
          marginLeft: 20,
          fontSize: 11,
          color: "var(--text-secondary)",
        }}
      >
        <Legend color="#10b981" label="Low" />
        <Legend color="#f59e0b" label="Medium" />
        <Legend color="#ef4444" label="High" />
      </div>
    </div>
  );
}

function Legend({ color, label }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 5,
      }}
    >
      <div
        style={{
          width: 10,
          height: 10,
          borderRadius: "50%",
          background: color,
        }}
      />

      <span>{label}</span>
    </div>
  );
}