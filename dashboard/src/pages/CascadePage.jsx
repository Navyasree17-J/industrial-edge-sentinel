import { useData } from "../context/DataContext";
import CascadeChain from "../components/CascadeChain";
import { EmptyState, SectionTitle } from "../components/UI";

export default function CascadePage() {
  const { chains } = useData();

  return (
    <div>
      <SectionTitle>{chains.length > 0 ? `${chains.length} cascade chain detected` : "Cascade failure detection"}</SectionTitle>

      {chains.length === 0 ? (
        <EmptyState
          icon="✅"
          title="No cascade failures detected"
          subtitle="The multi-agent system monitors PVC→inference→sensor→alerting chains in real-time. You will see cascade chains here when correlated failures are detected across multiple pods."
        />
      ) : (
        chains.map(chain => <CascadeChain key={chain.chain_id} chain={chain} />)
      )}

      {/* How it works */}
      <div style={{
        marginTop: 16, padding: "14px 16px", background: "var(--bg-card)",
        borderRadius: "var(--radius-lg)", border: "1px solid var(--border)",
        fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.7,
      }}>
        <div style={{ fontWeight: 600, color: "var(--text-primary)", marginBottom: 8, fontSize: 13 }}>
          How cascade detection works
        </div>
        <p style={{ marginBottom: 6 }}>
          The PVC agent polls write latency every 10s. When latency exceeds 60ms, it signals the Log agent to search for timeout/retry messages in downstream pods, and the CPU agent to check for saturation from retry storms.
        </p>
        <p style={{ marginBottom: 6 }}>
          The cascade detector runs every 30s, cross-referencing signals from all four agents. A cascade chain is raised when correlated critical/warning signals appear across ≥3 pods within a 5-minute window.
        </p>
        <p>
          The causal chain follows the dependency path: <strong>historian (PVC I/O)</strong> → <strong>ml-inference (queue)</strong> → <strong>sensor-ingestion (buffer)</strong> → <strong>alerting (data completeness)</strong>.
        </p>
      </div>
    </div>
  );
}
