import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { Card, SectionTitle } from "./UI";

const POD_SERIES = [
  { key: "historian",        color: "var(--historian-color)", label: "historian" },
  { key: "mlInference",      color: "var(--inference-color)", label: "ml-inference" },
  { key: "sensorIngestion",  color: "var(--sensor-color)",   label: "sensor-ingestion" },
  { key: "alerting",         color: "var(--alerting-color)", label: "alerting" },
];

function buildChartData(tsData, metric) {
  const labels = tsData.historian?.map(p => p.time) || [];
  return labels.map((time, i) => {
    const point = { time };
    POD_SERIES.forEach(({ key }) => {
      const v = tsData[key]?.[i]?.[metric];
      if (v !== undefined) point[key] = parseFloat(v.toFixed(4));
    });
    return point;
  });
}

function ChartLegend({ series }) {
  return (
    <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 8 }}>
      {series.map(s => (
        <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: "var(--text-secondary)" }}>
          <div style={{ width: 12, height: 3, background: s.color, borderRadius: 2 }} />
          {s.label}
        </div>
      ))}
    </div>
  );
}

function CustomTooltip({ active, payload, label, formatter }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)",
      padding: "8px 12px", boxShadow: "var(--shadow-md)", fontSize: 11,
    }}>
      <div style={{ fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: p.stroke }} />
          <span style={{ color: "var(--text-secondary)" }}>{p.name}:</span>
          <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>
            {formatter ? formatter(p.value) : p.value}
          </span>
        </div>
      ))}
    </div>
  );
}

function SingleChart({ title, data, series, yFormatter, yDomain, referenceLines = [] }) {
  return (
    <Card style={{ marginBottom: 12 }}>
      <SectionTitle>{title}</SectionTitle>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
          <defs>
            {series.map(s => (
              <linearGradient key={s.key} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={s.color} stopOpacity={0.2} />
                <stop offset="95%" stopColor={s.color} stopOpacity={0.02} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.6} />
          <XAxis dataKey="time" tick={{ fontSize: 9, fill: "var(--text-muted)" }} interval={5} />
          <YAxis tick={{ fontSize: 9, fill: "var(--text-muted)" }} tickFormatter={yFormatter} domain={yDomain} />
          <Tooltip content={<CustomTooltip formatter={yFormatter} />} />
          {referenceLines.map((r, i) => (
            <ReferenceLine key={i} y={r.y} stroke={r.color} strokeDasharray="5 3" strokeWidth={1}
              label={{ value: r.label, fill: r.color, fontSize: 9, position: "right" }} />
          ))}
          {series.map(s => (
            <Area key={s.key} type="monotone" dataKey={s.key} name={s.label}
              stroke={s.color} fill={`url(#grad-${s.key})`}
              strokeWidth={1.8} dot={false} connectNulls />
          ))}
        </AreaChart>
      </ResponsiveContainer>
      <ChartLegend series={series} />
    </Card>
  );
}

export default function TimeseriesCharts({ tsData }) {
  const cpuData = buildChartData(tsData, "cpu");
  const memData = buildChartData(tsData, "mem");
  const wlData  = buildChartData({ historian: tsData.historian }, "wl").map(p => ({
    time: p.time, historian: p.historian,
  }));

  return (
    <div>
      <SingleChart
        title="CPU utilization — all pods (live)"
        data={cpuData}
        series={POD_SERIES}
        yFormatter={v => `${Math.round(v * 100)}%`}
        yDomain={[0, 1]}
        referenceLines={[{ y: 0.85, color: "var(--red)", label: "85% crit" }]}
      />
      <SingleChart
        title="Memory utilization — all pods"
        data={memData}
        series={POD_SERIES}
        yFormatter={v => `${Math.round(v * 100)}%`}
        yDomain={[0, 1]}
        referenceLines={[{ y: 0.88, color: "var(--red)", label: "88% crit" }]}
      />
      <SingleChart
        title="PVC write latency — historian pod (root-cause indicator)"
        data={wlData}
        series={[{ key: "historian", color: "var(--historian-color)", label: "write latency (ms)" }]}
        yFormatter={v => `${Math.round(v)}ms`}
        yDomain={[0, 130]}
        referenceLines={[
          { y: 20,  color: "var(--amber)", label: "20ms warn" },
          { y: 60,  color: "var(--red)",   label: "60ms crit" },
        ]}
      />
    </div>
  );
}
