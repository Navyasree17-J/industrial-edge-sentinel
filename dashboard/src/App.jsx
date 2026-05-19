import { useState, useEffect } from "react";
import { useData } from "./context/DataContext";
import { DataProvider } from "./context/DataContext";
import Header from "./components/Header";
import OverviewPage    from "./pages/OverviewPage";
import PodsPage        from "./pages/PodsPage";
import CascadePage     from "./pages/CascadePage";
import InsightsPage    from "./pages/InsightsPage";
import TimeseriesPage  from "./pages/TimeseriesPage";
import DependencyPage  from "./pages/DependencyPage";
import AnomalyTimeline from "./components/AnomalyTimeline";

const PAGES = {
  overview:   OverviewPage,
  pods:       PodsPage,
  cascade:    CascadePage,
  insights:   InsightsPage,
  timeseries: TimeseriesPage,
  dependency: DependencyPage,
};

function AppInner() {
  const [activeTab, setActiveTab] = useState("overview");
  const { insights } = useData();
  const [theme, setTheme] = useState("dark");

useEffect(() => {
  document.documentElement.setAttribute("data-theme", theme);
}, [theme]);
  const Page = PAGES[activeTab] || OverviewPage;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-page)" }}>
      <Header
        activeTab={activeTab}
        onTabChange={setActiveTab}
        theme={theme}
        setTheme={setTheme}
      />
      <main style={{ maxWidth: 1400, margin: "0 auto", padding: "20px 20px 100px 20px" }}>
        <Page />
      </main>
      <AnomalyTimeline insights={insights} />
    </div>
  );
}

export default function App() {
  return (
    <DataProvider>
      <AppInner />
    </DataProvider>
  );
}
