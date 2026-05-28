import { useWebSocket } from './hooks/useWebSocket';
import { useSimulationStore } from './store/simulationStore';
import { Header } from './components/Header';
import { TopologyView } from './components/TopologyView';
import { PulseView } from './components/PulseView';
import { ForecastHeatmap } from './components/ForecastHeatmap';
import { Timeline } from './components/Timeline';
import { ControlPanel } from './components/ControlPanel';

function App() {
  const { sendCommand } = useWebSocket();
  const activeView = useSimulationStore((s) => s.activeView);
  const setActiveView = useSimulationStore((s) => s.setActiveView);

  const views = [
    { id: 'topology' as const, label: 'Topology' },
    { id: 'pulse' as const, label: 'Pulse' },
    { id: 'forecast' as const, label: 'Forecast' },
    { id: 'timeline' as const, label: 'Timeline' },
  ];

  return (
    <div className="app">
      <Header />

      <div className="app-content">
        {/* Main Visualization Area */}
        <div className="viz-area">
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

          {/* Visualization Container */}
          <div className="viz-main" id="viz-container">
            {/* Topology always rendered (provides node positions for pulse/forecast) */}
            <div style={{
              width: '100%',
              height: '100%',
              display: activeView === 'timeline' ? 'none' : 'block',
              position: 'relative',
            }}>
              <TopologyView />

              {/* Pulse overlay */}
              {(activeView === 'pulse' || activeView === 'topology') && (
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
          </div>
        </div>

        {/* Right Panel — Controls */}
        <ControlPanel sendCommand={sendCommand} />
      </div>
    </div>
  );
}

export default App;
