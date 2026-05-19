import D3DependencyGraph from "../components/D3DependencyGraph";
import { useData } from "../context/DataContext";
import { SectionTitle } from "../components/UI";

export default function DependencyPage() {
  const { chains } = useData();
  return (
    <div>
      <SectionTitle>Pod interdependency & cascade map</SectionTitle>
      <D3DependencyGraph chains={chains} />
    </div>
  );
}
