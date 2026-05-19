import { useData } from "../context/DataContext";
import TimeseriesCharts from "../components/TimeseriesCharts";
import { SectionTitle } from "../components/UI";

export default function TimeseriesPage() {
  const { tsData, pods } = useData();

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <SectionTitle>Real-time metric timeseries</SectionTitle>
        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
          ↻ updating every 3s · last 30 data points
        </div>
      </div>

      {/* Quick pod health summary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginBottom: 16 }}>
        {pods.slice(0, 4).map(p => {
          const stress = p.cpu >= 0.85 || p.mem >= 0.85 || (p.writeLat && p.writeLat > 50);
          const warn   = !stress && (p.cpu >= 0.7 || p.mem >= 0.75);
          const color  = stress ? "var(--red)" : warn ? "var(--amber)" : "var(--green)";
          return (
            <div key={p.pod} style={{
              padding: "10px 12px", borderRadius: "var(--radius-md)",
              background: "var(--bg-card)", border: `1px solid ${color}44`,
            }}>
              <div style={{ fontSize: 10, fontWeight: 700, color, marginBottom: 4 }}>{p.role}</div>
              <div style={{ display: "flex", gap: 8, fontSize: 11, fontFamily: "var(--font-mono)" }}>
                <span style={{ color: "var(--text-secondary)" }}>CPU <span style={{ color: p.cpu >= 0.85 ? "var(--red)" : "var(--text-primary)", fontWeight: 600 }}>{Math.round(p.cpu * 100)}%</span></span>
                <span style={{ color: "var(--text-secondary)" }}>MEM <span style={{ color: p.mem >= 0.85 ? "var(--red)" : "var(--text-primary)", fontWeight: 600 }}>{Math.round(p.mem * 100)}%</span></span>
              </div>
              {p.writeLat != null && (
                <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", marginTop: 2 }}>
                  <span style={{ color: "var(--text-secondary)" }}>LAT </span>
                  <span style={{ color: p.writeLat > 60 ? "var(--red)" : p.writeLat > 20 ? "var(--amber)" : "var(--green)", fontWeight: 600 }}>
                    {Math.round(p.writeLat)}ms
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <TimeseriesCharts tsData={tsData} />
    </div>
  );
}
