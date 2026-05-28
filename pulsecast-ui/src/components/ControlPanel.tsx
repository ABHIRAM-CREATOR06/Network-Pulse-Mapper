import { useSimulationStore } from '../store/simulationStore';
import type { WSCommand, ScenarioType, RoutingStrategy, SimulationSpeed, NodeId } from '../utils/types';

interface ControlPanelProps {
  sendCommand: (cmd: WSCommand) => void;
}

export function ControlPanel({ sendCommand }: ControlPanelProps) {
  const speed = useSimulationStore((s) => s.speed);
  const setSpeed = useSimulationStore((s) => s.setSpeed);
  const routingStrategy = useSimulationStore((s) => s.routingStrategy);
  const setRoutingStrategy = useSimulationStore((s) => s.setRoutingStrategy);
  const topologyNodes = useSimulationStore((s) => s.topologyNodes);
  const selectedNode = useSimulationStore((s) => s.selectedNode);

  const speeds: { label: string; value: SimulationSpeed; wsValue: string }[] = [
    { label: '1×', value: '1x', wsValue: '1x' },
    { label: '2×', value: '2x', wsValue: '2x' },
    { label: '10×', value: '10x', wsValue: '10x' },
  ];

  const strategies: { label: string; value: RoutingStrategy }[] = [
    { label: 'Shortest Path', value: 'shortest_path' },
    { label: 'Congestion Aware', value: 'congestion_aware' },
    { label: 'Predictive Reroute', value: 'predictive_reroute' },
    { label: 'Memory Based', value: 'memory_based' },
  ];

  const handleSpeed = (s: typeof speeds[number]) => {
    setSpeed(s.value);
    sendCommand({ command: 'set_speed', speed: s.wsValue });
  };

  const handleStrategy = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value as RoutingStrategy;
    setRoutingStrategy(value);
    sendCommand({ command: 'set_routing_strategy', strategy: value, node_id: null });
  };

  const injectScenario = (type: ScenarioType, intensity = 50, duration = 20) => {
    const source = selectedNode || topologyNodes[0]?.id || 'A';
    const targets: NodeId[] = type === 'link_fail' && topologyNodes.length > 1
      ? [topologyNodes[1].id]
      : type === 'storm'
        ? topologyNodes.map((n) => n.id)
        : [];

    sendCommand({
      command: 'inject_scenario',
      scenario_type: type,
      source_node: source,
      target_nodes: targets,
      intensity,
      duration_ticks: duration,
    });
  };

  return (
    <div className="control-panel">
      {/* Speed Control */}
      <div className="feature-card">
        <div className="eyebrow" style={{ marginBottom: '8px' }}>
          Simulation Speed
        </div>
        <div className="speed-toggle">
          {speeds.map((s) => (
            <button
              key={s.value}
              className={speed === s.value ? 'active' : ''}
              onClick={() => handleSpeed(s)}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Routing Strategy */}
      <div className="feature-card">
        <div className="eyebrow" style={{ marginBottom: '8px' }}>
          Routing Strategy
        </div>
        <div className="carbon-select-container">
          <select
            className="carbon-select"
            value={routingStrategy}
            onChange={handleStrategy}
            id="routing-strategy-select"
          >
            {strategies.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Traffic Injection */}
      <div className="feature-card">
        <div className="eyebrow" style={{ marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
          <span>Traffic Injection</span>
          {selectedNode && (
            <span className="mono" style={{ color: 'var(--primary)' }}>
              Target: {selectedNode}
            </span>
          )}
        </div>
        <div className="scenario-grid">
          <button onClick={() => injectScenario('burst', 80, 15)} id="btn-burst">
            Burst
          </button>
          <button onClick={() => injectScenario('storm', 40, 20)} id="btn-storm">
            Storm
          </button>
          <button className="danger" onClick={() => injectScenario('link_fail', 0, 30)} id="btn-link-fail">
            Link Fail
          </button>
          <button className="danger" onClick={() => injectScenario('node_overload', 500, 1)} id="btn-overload">
            Overload
          </button>
          <button className="danger full-width" onClick={() => injectScenario('cascade', 60, 25)} id="btn-cascade">
            Cascade
          </button>
        </div>
      </div>

    </div>
  );
}
