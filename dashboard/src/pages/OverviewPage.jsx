import { useState } from "react";
import { useData } from "../context/DataContext";
import PodCard from "../components/PodCard";
import InsightFeed from "../components/InsightFeed";
import { StatCard, SectionTitle } from "../components/UI";

export default function OverviewPage() {
  const { pods, insights, chains, criticalCount, warningCount, stressedPods } = useData();
  const [selectedPod, setSelectedPod] = useState(null);

  const handlePodClick = (pod) => {
    setSelectedPod(prev => prev?.pod === pod.pod ? null : pod);
  };

  return (
    <div>
      {/* Summary stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, marginBottom: 16 }}>
        <StatCard icon="📦" value={pods.length}       label="Total pods"     />
        <StatCard icon="🔴" value={criticalCount}      label="Critical alerts" color="var(--red)"   />
        <StatCard icon="🟡" value={warningCount}       label="Warnings"       color="var(--amber)" />
        <StatCard icon="⚡" value={chains.length}      label="Cascade chains" color={chains.length > 0 ? "var(--red)" : "var(--text-primary)"} />
        <StatCard icon="🔥" value={stressedPods.length} label="Stressed pods" color={stressedPods.length > 0 ? "var(--amber)" : "var(--text-primary)"} />
      </div>

      {/* Two-column layout */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Left: pods */}
        <div>
          <SectionTitle>Pod resource status</SectionTitle>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {pods.map(pod => (
              <PodCard
                key={pod.pod}
                pod={pod}
                isSelected={selectedPod?.pod === pod.pod}
                onClick={handlePodClick}
              />
            ))}
          </div>
        </div>

        {/* Right: insights */}
        <div>
          <SectionTitle>Live agent insights</SectionTitle>
          <InsightFeed insights={insights} maxItems={20} />
        </div>
      </div>
    </div>
  );
}
