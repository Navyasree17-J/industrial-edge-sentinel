export default function GaugeChart({
  value = 0,
  label = "Metric",
  color = "#3b82f6",
}) {
  const radius = 42;
  const stroke = 8;

  const normalized = Math.min(Math.max(value, 0), 100);

  const circumference = 2 * Math.PI * radius;

  const offset =
    circumference - (normalized / 100) * circumference;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
      }}
    >
      <svg width="110" height="110">
        {/* Background circle */}
        <circle
          cx="55"
          cy="55"
          r={radius}
          stroke="var(--border)"
          strokeWidth={stroke}
          fill="none"
        />

        {/* Progress arc */}
        <circle
          cx="55"
          cy="55"
          r={radius}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 55 55)"
          style={{
            transition: "stroke-dashoffset 0.6s ease",
          }}
        />

        {/* Center value */}
        <text
          x="50%"
          y="50%"
          dominantBaseline="middle"
          textAnchor="middle"
          fill="var(--text-primary)"
          style={{
            fontSize: 18,
            fontWeight: 700,
          }}
        >
          {normalized}%
        </text>
      </svg>

      <div
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: "var(--text-secondary)",
        }}
      >
        {label}
      </div>
    </div>
  );
}