import { useWebSocket } from './hooks/useWebSocket';
import { useSimulationStore } from './store/simulationStore';
import { Header } from './components/Header';
import { TopologyView } from './components/TopologyView';
import { PulseView } from './components/PulseView';
import { ForecastHeatmap } from './components/ForecastHeatmap';
import { Timeline } from './components/Timeline';
import { ControlPanel } from './components/ControlPanel';
import { LearnView } from './components/LearnView';
import { NodeList } from './components/NodeList';

function App() {
  const { sendCommand } = useWebSocket();
  const activeView = useSimulationStore((s) => s.activeView);
  const setActiveView = useSimulationStore((s) => s.setActiveView);

  const views = [
    { id: 'topology' as const, label: 'Topology' },
    { id: 'pulse' as const, label: 'Pulse' },
    { id: 'forecast' as const, label: 'Forecast' },
    { id: 'timeline' as const, label: 'Timeline' },
    { id: 'learn' as const, label: 'Learn' },
  ];

  return (
    <div className="app">
      <Header />

      <div className="app-content">
        {/* Main Visualization Area */}
        <div className="viz-area" style={{ display: 'flex', flexDirection: 'column' }}>
          {/* View Tabs */}
          <div className="product-tabs" id="view-tabs">
            {views.map((v) => (
              <button
                key={v.id}
                className={`product-tab ${activeView === v.id ? 'selected' : ''}`}
                onClick={() => setActiveView(v.id)}
                id={`tab-${v.id}`}
              >
                {v.label}
              </button>
            ))}
          </div>

          <ControlPanel sendCommand={sendCommand} />

          {/* Visualization Container */}
          <div className="viz-main" id="viz-container">
            {/* Topology always rendered (provides node positions for pulse/forecast) */}
            <div style={{
              width: '100%',
              height: '100%',
              display: (activeView === 'timeline' || activeView === 'learn') ? 'none' : 'grid',
            }}>
              <TopologyView />

              {/* Pulse overlay */}
              {activeView === 'pulse' && (
                <PulseView />
              )}

              {/* Forecast heatmap overlay */}
              {activeView === 'forecast' && (
                <ForecastHeatmap />
              )}
            </div>

            {/* Timeline view */}
            {activeView === 'timeline' && (
              <Timeline />
            )}

            {/* Learn view */}
            {activeView === 'learn' && (
              <LearnView />
            )}
          </div>
          
          <NodeList />
        </div>
      </div>
    </div>
  );
}

export default App;
