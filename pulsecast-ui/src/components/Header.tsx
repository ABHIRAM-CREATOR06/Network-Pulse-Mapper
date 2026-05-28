import { useSimulationStore } from '../store/simulationStore';

export function Header() {
  const connected = useSimulationStore((s) => s.connected);
  const speed = useSimulationStore((s) => s.speed);
  const totalSent = useSimulationStore((s) => s.totalPacketsSent);
  const totalDropped = useSimulationStore((s) => s.totalPacketsDropped);
  const nodeCount = useSimulationStore((s) => s.topologyNodes.length);

  return (
    <header className="header">
      <div className="header-brand">
        <div className="header-logo">⚡</div>
        <div>
          <div className="header-title">PulseCast</div>
          <div className="header-subtitle">Network Pulse Mapper</div>
        </div>
      </div>

      <div className="header-status">
        <div className="status-indicator">
          <span className="mono">{nodeCount} nodes</span>
        </div>
        <div className="status-indicator">
          <span className="text-green mono">{totalSent.toLocaleString()} sent</span>
        </div>
        <div className="status-indicator">
          <span className="text-red mono">{totalDropped.toLocaleString()} dropped</span>
        </div>
        <div className="status-indicator">
          <span className="mono">Speed: {speed}</span>
        </div>
        <div className="status-indicator">
          <span className={`status-dot ${connected ? 'connected' : 'disconnected'}`} />
          {connected ? 'Live' : 'Offline'}
        </div>
      </div>
    </header>
  );
}
