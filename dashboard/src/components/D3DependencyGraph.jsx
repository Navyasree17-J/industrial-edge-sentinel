import { useEffect, useRef } from "react";

export default function D3DependencyGraph({ chains = [] }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    const width = canvas.width;
    const height = canvas.height;

    const nodes = [
      { id: "sensor", x: 120, y: 120, color: "#06b6d4" },
      { id: "historian", x: 320, y: 220, color: "#f59e0b" },
      { id: "inference", x: 520, y: 120, color: "#8b5cf6" },
      { id: "alerting", x: 720, y: 220, color: "#ef4444" },
      { id: "monitoring", x: 920, y: 120, color: "#10b981" },
    ];

    const links = [
      ["sensor", "historian"],
      ["historian", "inference"],
      ["inference", "alerting"],
      ["alerting", "monitoring"],
    ];

    let pulse = 0;

    function draw() {
      ctx.clearRect(0, 0, width, height);

      ctx.strokeStyle = "#475569";
      ctx.lineWidth = 2;

      links.forEach(([a, b], i) => {
        const n1 = nodes.find((n) => n.id === a);
        const n2 = nodes.find((n) => n.id === b);

        ctx.beginPath();
        ctx.moveTo(n1.x, n1.y);
        ctx.lineTo(n2.x, n2.y);
        ctx.stroke();

        const t = (pulse + i * 0.2) % 1;

        const px = n1.x + (n2.x - n1.x) * t;
        const py = n1.y + (n2.y - n1.y) * t;

        ctx.beginPath();
        ctx.arc(px, py, 6, 0, Math.PI * 2);
        ctx.fillStyle = "#ef4444";
        ctx.fill();
      });

      nodes.forEach((node) => {
        ctx.beginPath();
        ctx.arc(node.x, node.y, 34, 0, Math.PI * 2);

        ctx.fillStyle = node.color;
        ctx.fill();

        ctx.shadowColor = node.color;
        ctx.shadowBlur = 18;

        ctx.fill();

        ctx.shadowBlur = 0;

        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 12px Inter";
        ctx.textAlign = "center";

        ctx.fillText(
          node.id.toUpperCase(),
          node.x,
          node.y + 4
        );
      });

      pulse += 0.01;

      requestAnimationFrame(draw);
    }

    draw();
  }, [chains]);

  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: 16,
        padding: 20,
        overflow: "auto",
      }}
    >
      <div
        style={{
          marginBottom: 16,
          fontSize: 16,
          fontWeight: 700,
          color: "var(--text-primary)",
        }}
      >
        AI Dependency Cascade Graph
      </div>

      <canvas
        ref={canvasRef}
        width={1050}
        height={400}
        style={{
          width: "100%",
          background: "var(--bg-surface)",
          borderRadius: 14,
        }}
      />
    </div>
  );
}