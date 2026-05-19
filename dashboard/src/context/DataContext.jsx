import { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import { api } from "../utils/api";
import {
  PODS_BASE, tickPods, generateInsight, generateCascadeChain,
  initTimeseries, pushTimeseries, getDependencyMap,
} from "../utils/mockData";

const DataCtx = createContext(null);

export function DataProvider({ children }) {
  const [pods,      setPods]      = useState(PODS_BASE.map(p => ({ ...p })));
  const [insights,  setInsights]  = useState([]);
  const [chains,    setChains]    = useState([]);
  const [tsData,    setTsData]    = useState(() => initTimeseries(25));
  const [depMap,    setDepMap]    = useState(() => getDependencyMap(PODS_BASE));
  const [agentStatus, setAgentStatus] = useState({ cpu_agent:"ok", memory_agent:"ok", pvc_agent:"ok", log_agent:"ok" });
  const [apiOnline, setApiOnline] = useState(false);
  const [lastUpdate,setLastUpdate]= useState(new Date());

  const tickRef = useRef(0);
  const podsRef = useRef(pods);
  podsRef.current = pods;

  // Try to fetch from real API
  const fetchFromApi = useCallback(async () => {
    try {
      const [metricsData, insightsData, chainsData, stateData] = await Promise.all([
        api.podMetrics(), api.insights(), api.cascadeChains(), api.state(),
      ]);
      setPods(metricsData);
      setInsights(insightsData);
      setChains(chainsData);
      if (stateData?.agent_status) setAgentStatus(stateData.agent_status);
      setApiOnline(true);
      setLastUpdate(new Date());
    } catch {
      setApiOnline(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => { fetchFromApi(); }, [fetchFromApi]);

  // Polling when API online
  useEffect(() => {
    if (!apiOnline) return;
    const id = setInterval(fetchFromApi, 15000);
    return () => clearInterval(id);
  }, [apiOnline, fetchFromApi]);

  // Simulation tick when API offline
  useEffect(() => {
    if (apiOnline) return;

    const id = setInterval(() => {
      tickRef.current += 1;
      const t = tickRef.current;

      setPods(prev => {
        const next = tickPods(prev, t);
        podsRef.current = next;
        return next;
      });

      setTsData(prev => pushTimeseries(prev, podsRef.current));

      if (t % 3 === 0) {
        setInsights(prev => {
          const ins = generateInsight(podsRef.current, t);
          return [ins, ...prev.slice(0, 59)];
        });
      }

      if (t === 10) {
        setChains([generateCascadeChain(podsRef.current)]);
        setAgentStatus(prev => ({ ...prev, pvc_agent: "busy" }));
      }
      if (t > 10) {
        setAgentStatus({ cpu_agent:"ok", memory_agent:"ok", pvc_agent:"busy", log_agent:"ok" });
      }

      setLastUpdate(new Date());
    }, 3000);

    return () => clearInterval(id);
  }, [apiOnline]);

  const criticalCount = insights.filter(i => i.severity === "critical").length;
  const warningCount  = insights.filter(i => i.severity === "warning").length;
  const stressedPods  = pods.filter(p => p.cpu >= 0.85 || p.mem >= 0.88 || (p.writeLat && p.writeLat > 50));

  return (
    <DataCtx.Provider value={{
      pods, insights, chains, tsData, depMap,
      agentStatus, apiOnline, lastUpdate,
      criticalCount, warningCount, stressedPods,
    }}>
      {children}
    </DataCtx.Provider>
  );
}

export const useData = () => useContext(DataCtx);
