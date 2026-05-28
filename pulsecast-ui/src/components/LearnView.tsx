export function LearnView() {
  return (
    <div className="learn-view" style={{ padding: 'var(--space-md)', overflowY: 'auto', height: '100%' }}>
      <div className="feature-card" style={{ marginBottom: 'var(--space-md)' }}>
        <h2 className="card-title">Traffic Injection Scenarios</h2>
        <div className="body-sm" style={{ marginBottom: 'var(--space-md)' }}>
          <strong>Burst:</strong> Injects a sudden, intense spike of traffic from a source node to a random destination. Useful for testing short-term queue stability.
        </div>
        <div className="body-sm" style={{ marginBottom: 'var(--space-md)' }}>
          <strong>Storm:</strong> Unleashes a massive, sustained flood of traffic targeting multiple nodes simultaneously. Tests network resilience and congestion control over time.
        </div>
        <div className="body-sm" style={{ marginBottom: 'var(--space-md)' }}>
          <strong>Link Fail:</strong> Simulates a physical cable cut by disabling a connection between nodes, forcing the network to dynamically reroute traffic in-flight.
        </div>
        <div className="body-sm" style={{ marginBottom: 'var(--space-md)' }}>
          <strong>Overload:</strong> Instantly maximizes the packet queue of a specific node, acting as a severe bottleneck to observe backpressure.
        </div>
        <div className="body-sm">
          <strong>Cascade:</strong> Triggers sequential traffic bursts across the network, simulating a cascading failure or synchronized event.
        </div>
      </div>

      <div className="feature-card">
        <h2 className="card-title">Visualization Views</h2>
        <div className="body-sm" style={{ marginBottom: 'var(--space-md)' }}>
          <strong>Topology:</strong> The standard view. Displays the physical network layout, nodes, active links, and current node queues via color saturation.
        </div>
        <div className="body-sm" style={{ marginBottom: 'var(--space-md)' }}>
          <strong>Pulse:</strong> An animated overlay that tracks individual packet movements in real-time. Waves propagate across the network as traffic flows.
        </div>
        <div className="body-sm" style={{ marginBottom: 'var(--space-md)' }}>
          <strong>Forecast:</strong> A predictive heat map. The simulation calculates potential future congestion using diffusion math and highlights areas likely to experience packet loss.
        </div>
        <div className="body-sm">
          <strong>Timeline:</strong> A historical graph showing the congestion levels of nodes over time, plotting a sparkline for queue occupancy.
        </div>
      </div>
    </div>
  );
}
