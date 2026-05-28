import { useSimulationStore } from '../store/simulationStore';
import { occupancyToColor, roleToColor } from '../utils/colors';
import type { NodeId } from '../utils/types';

export function NodeCard({ nodeId }: { nodeId: NodeId }) {
  const telemetry = useSimulationStore((s) => s.nodes.get(nodeId));
  const forecast = useSimulationStore((s) => s.forecast);
  const selectedNode = useSimulationStore((s) => s.selectedNode);
  const setSelectedNode = useSimulationStore((s) => s.setSelectedNode);

  if (!telemetry) return null;

  const occ = telemetry.occupancy;
  const color = occupancyToColor(occ);
  const roleColor = roleToColor(telemetry.role);
  const forecastScore = forecast?.scores[nodeId] ?? 0;
  const isSelected = selectedNode === nodeId;

  return (
    <div
      className={`node-card ${isSelected ? 'selected' : ''}`}
      style={{ cursor: 'pointer' }}
      onClick={() => setSelectedNode(isSelected ? null : nodeId)}
    >
      <div
        className="node-avatar"
        style={{ background: roleColor }}
      >
        {nodeId}
      </div>

      <div className="node-info">
        <div className="node-name">Node {nodeId}</div>
        <div className="node-role">{telemetry.role.replace('_', ' ')}</div>
        <div className="node-queue-bar">
          <div
            className="node-queue-fill"
            style={{
              width: `${occ * 100}%`,
              background: color,
            }}
          />
        </div>
      </div>

      <div className="node-stats">
        <span style={{ color }}>{(occ * 100).toFixed(0)}%</span>
        <span className="text-amber" style={{ fontSize: '0.65rem' }}>
          ƒ {(forecastScore * 100).toFixed(0)}%
        </span>
        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
          {telemetry.queue_depth}/{telemetry.queue_capacity}
        </span>
      </div>
    </div>
  );
}
