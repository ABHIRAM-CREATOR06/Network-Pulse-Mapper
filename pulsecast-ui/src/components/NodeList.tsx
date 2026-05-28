import { useSimulationStore } from '../store/simulationStore';
import { occupancyToColor, roleToColor } from '../utils/colors';

export function NodeList() {
  const topologyNodes = useSimulationStore((s) => s.topologyNodes);
  
  return (
    <div className="feature-card" style={{ marginTop: 'var(--space-md)' }}>
      <div className="eyebrow" style={{ marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
        <span>Nodes</span>
        <span className="mono">{topologyNodes.length}</span>
      </div>
      <div style={{ display: 'flex', gap: 'var(--space-md)', overflowX: 'auto', paddingBottom: 'var(--space-xs)' }}>
        {topologyNodes.map((n) => (
          <NodeCardMini key={n.id} nodeId={n.id} role={n.role} />
        ))}
      </div>
    </div>
  );
}

function NodeCardMini({ nodeId, role }: { nodeId: string, role: string }) {
  // Subscribe specifically to this node's telemetry to update at 2Hz
  const telemetry = useSimulationStore((s) => s.nodes.get(nodeId));
  const occupancy = telemetry?.occupancy ?? 0;
  const queueDepth = telemetry?.queue_depth ?? 0;
  const queueCapacity = telemetry?.queue_capacity ?? 500;

  const color = occupancyToColor(occupancy);
  const roleColor = roleToColor(role);
  const selectedNode = useSimulationStore((s) => s.selectedNode);
  const setSelectedNode = useSimulationStore((s) => s.setSelectedNode);
  const isSelected = selectedNode === nodeId;

  return (
    <div
      className={`node-card ${isSelected ? 'selected' : ''}`}
      style={{ minWidth: '220px', flexShrink: 0 }}
      onClick={() => setSelectedNode(isSelected ? null : nodeId)}
    >
      <div className="node-avatar" style={{ background: roleColor }}>
        {nodeId}
      </div>
      <div className="node-info">
        <div className="node-name">Node {nodeId}</div>
        <div className="node-role" style={{ fontSize: '12px', textTransform: 'capitalize' }}>{role.replace('_', ' ')}</div>
        <div className="node-queue-bar">
          <div
            className="node-queue-fill"
            style={{ width: `${occupancy * 100}%`, background: color }}
          />
        </div>
      </div>
      <div className="node-stats" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', marginLeft: 'auto' }}>
        <span style={{ color, fontWeight: 600 }}>{(occupancy * 100).toFixed(0)}%</span>
        <span style={{ fontSize: '0.65rem', color: 'var(--ink-muted)' }}>
          {queueDepth}/{queueCapacity}
        </span>
      </div>
    </div>
  );
}
