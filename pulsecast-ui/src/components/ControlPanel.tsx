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
      <div className="glass-card">
        <div className="card-header">
          <span className="card-title">⏱ Simulation Speed</span>
        </div>
        <div className="speed-buttons">
          {speeds.map((s) => (
            <button
              key={s.value}
              className={`speed-btn ${speed === s.value ? 'active' : ''}`}
              onClick={() => handleSpeed(s)}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Routing Strategy */}
      <div className="glass-card">
        <div className="card-header">
          <span className="card-title">🔀 Routing Strategy</span>
        </div>
        <div className="control-section">
          <select
            className="control-select"
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
      <div className="glass-card">
        <div className="card-header">
          <span className="card-title">⚡ Traffic Injection</span>
          {selectedNode && (
            <span className="mono text-accent" style={{ fontSize: '0.75rem' }}>
              Source: {selectedNode}
            </span>
          )}
        </div>
        <div className="scenario-grid">
          <button
            className="scenario-btn"
            onClick={() => injectScenario('burst', 80, 15)}
            id="btn-burst"
          >
            💥 Burst
          </button>
          <button
            className="scenario-btn"
            onClick={() => injectScenario('storm', 40, 20)}
            id="btn-storm"
          >
            🌊 Storm
          </button>
          <button
            className="scenario-btn"
            onClick={() => injectScenario('link_fail', 0, 30)}
            id="btn-link-fail"
          >
            🔌 Link Fail
          </button>
          <button
            className="scenario-btn"
            onClick={() => injectScenario('node_overload', 500, 1)}
            id="btn-overload"
          >
            🔥 Overload
          </button>
          <button
            className="scenario-btn full-width"
            onClick={() => injectScenario('cascade', 60, 25)}
            id="btn-cascade"
          >
            🌀 Cascade
          </button>
        </div>
      </div>

      {/* Node List */}
      <div className="glass-card">
        <div className="card-header">
          <span className="card-title">🖧 Nodes</span>
          <span className="mono" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {topologyNodes.length}
          </span>
        </div>
        <div className="node-cards" id="node-list">
          {topologyNodes.map((n) => {
            // Inline mini node card to avoid import cycle
            const telemetry = useSimulationStore.getState().nodes.get(n.id);
            return (
              <NodeCardMini
                key={n.id}
                nodeId={n.id}
                occupancy={n.occupancy}
                role={n.role}
                queueDepth={telemetry?.queue_depth ?? 0}
                queueCapacity={telemetry?.queue_capacity ?? 500}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* Mini node card used inside the control panel */
import { occupancyToColor, roleToColor } from '../utils/colors';

function NodeCardMini({
  nodeId,
  occupancy,
  role,
  queueDepth,
  queueCapacity,
}: {
  nodeId: string;
  occupancy: number;
  role: string;
  queueDepth: number;
  queueCapacity: number;
}) {
  const color = occupancyToColor(occupancy);
  const roleColor = roleToColor(role);
  const selectedNode = useSimulationStore((s) => s.selectedNode);
  const setSelectedNode = useSimulationStore((s) => s.setSelectedNode);
  const isSelected = selectedNode === nodeId;

  return (
    <div
      className="node-card"
      style={{
        borderColor: isSelected ? 'var(--accent-blue)' : undefined,
        cursor: 'pointer',
      }}
      onClick={() => setSelectedNode(isSelected ? null : nodeId)}
    >
      <div className="node-avatar" style={{ background: roleColor }}>
        {nodeId}
      </div>
      <div className="node-info">
        <div className="node-name">Node {nodeId}</div>
        <div className="node-role">{role.replace('_', ' ')}</div>
        <div className="node-queue-bar">
          <div
            className="node-queue-fill"
            style={{ width: `${occupancy * 100}%`, background: color }}
          />
        </div>
      </div>
      <div className="node-stats">
        <span style={{ color }}>{(occupancy * 100).toFixed(0)}%</span>
        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
          {queueDepth}/{queueCapacity}
        </span>
      </div>
    </div>
  );
}
