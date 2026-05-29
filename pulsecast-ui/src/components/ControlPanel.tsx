import { useMemo, useState } from 'react';
import { useSimulationStore } from '../store/simulationStore';
import type {
  WSCommand,
  ScenarioType,
  RoutingStrategy,
  SimulationSpeed,
  NodeId,
  NodeRole,
} from '../utils/types';

interface ControlPanelProps {
  sendCommand: (cmd: WSCommand) => void;
}

export function ControlPanel({ sendCommand }: ControlPanelProps) {
  const speed = useSimulationStore((s) => s.speed);
  const setSpeed = useSimulationStore((s) => s.setSpeed);
  const trafficEnabled = useSimulationStore((s) => s.trafficEnabled);
  const setTrafficEnabled = useSimulationStore((s) => s.setTrafficEnabled);
  const routingStrategy = useSimulationStore((s) => s.routingStrategy);
  const setRoutingStrategy = useSimulationStore((s) => s.setRoutingStrategy);
  const topologyNodes = useSimulationStore((s) => s.topologyNodes);
  const selectedNode = useSimulationStore((s) => s.selectedNode);
  const setSelectedNode = useSimulationStore((s) => s.setSelectedNode);
  const layoutMode = useSimulationStore((s) => s.layoutMode);
  const setLayoutMode = useSimulationStore((s) => s.setLayoutMode);
  const requestFit = useSimulationStore((s) => s.requestFit);
  const requestAutoLayout = useSimulationStore((s) => s.requestAutoLayout);
  const [nodeRole, setNodeRole] = useState<NodeRole>('router');
  const [port, setPort] = useState(5010);

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

  const roles: { label: string; value: NodeRole }[] = [
    { label: 'Router', value: 'router' },
    { label: 'Sender', value: 'sender' },
    { label: 'Receiver', value: 'receiver' },
    { label: 'Congestion source', value: 'congestion_source' },
  ];

  const nextNodeId = useMemo(() => {
    const used = new Set(topologyNodes.map((node) => node.id));
    for (let i = 0; i < 26; i++) {
      const candidate = String.fromCharCode(65 + i);
      if (!used.has(candidate)) return candidate;
    }
    return `N${topologyNodes.length + 1}`;
  }, [topologyNodes]);

  const handleSpeed = (s: typeof speeds[number]) => {
    setSpeed(s.value);
    sendCommand({ command: 'set_speed', speed: s.wsValue });
  };

  const toggleTraffic = () => {
    const enabled = !trafficEnabled;
    setTrafficEnabled(enabled);
    sendCommand({ command: 'set_traffic_enabled', enabled });
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

  const addNode = () => {
    sendCommand({
      command: 'add_node',
      node_id: nextNodeId,
      port,
      role: nodeRole,
    });
    setSelectedNode(nextNodeId);
    setPort((current) => current + 1);
  };

  const removeSelectedNode = () => {
    if (!selectedNode) return;
    sendCommand({ command: 'remove_node', node_id: selectedNode });
    setSelectedNode(null);
  };

  return (
    <div className="control-panel">
      {/* Topology Playground */}
      <div className="feature-card playground-card">
        <div className="eyebrow playground-heading">
          <span>Topology Playground</span>
          <span className="mono">Next: {nextNodeId}</span>
        </div>
        <div className="playground-grid">
          <label className="carbon-select-container">
            <span className="carbon-select-label">Role</span>
            <select
              className="carbon-select"
              value={nodeRole}
              onChange={(event) => setNodeRole(event.target.value as NodeRole)}
            >
              {roles.map((role) => (
                <option key={role.value} value={role.value}>
                  {role.label}
                </option>
              ))}
            </select>
          </label>

          <label className="carbon-select-container">
            <span className="carbon-select-label">Port</span>
            <input
              className="text-input"
              type="number"
              min="1024"
              max="65535"
              value={port}
              onChange={(event) => setPort(Number(event.target.value))}
            />
          </label>
        </div>
        <div className="playground-actions">
          <button className="button-primary" onClick={addNode}>
            Add node
          </button>
          <button
            className="button-danger"
            onClick={removeSelectedNode}
            disabled={!selectedNode}
          >
            Remove selected
          </button>
        </div>
        <div className="playground-actions playground-actions-secondary">
          <button
            className={`button-ghost ${layoutMode === 'manual' ? 'active' : ''}`}
            onClick={() => setLayoutMode(layoutMode === 'manual' ? 'auto' : 'manual')}
          >
            Manual placement
          </button>
          <button className="button-ghost" onClick={requestAutoLayout}>
            Auto layout
          </button>
          <button className="button-ghost" onClick={requestFit}>
            Fit graph
          </button>
        </div>
      </div>

      {/* Speed Control */}
      <div className="feature-card">
        <div className="eyebrow playground-heading" style={{ marginBottom: '8px' }}>
          <span>Simulation Speed</span>
          <span className="mono">{trafficEnabled ? 'Sending' : 'Stopped'}</span>
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
        <button
          className={trafficEnabled ? 'button-danger traffic-toggle' : 'button-primary traffic-toggle'}
          onClick={toggleTraffic}
        >
          {trafficEnabled ? 'Stop sending' : 'Resume sending'}
        </button>
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
