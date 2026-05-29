/* ═══════════════════════════════════════════════════════════════
   PulseCast Type System
   Experimental Adaptive Network Behavior Platform
   ═══════════════════════════════════════════════════════════════ */

export type NodeId = string;

export type NodeRole = 'sender' | 'receiver' | 'router' | 'congestion_source';

export type RoutingStrategy =
  | 'shortest_path'
  | 'congestion_aware'
  | 'predictive_reroute'
  | 'memory_based';

export type ScenarioType =
  | 'burst'
  | 'storm'
  | 'link_fail'
  | 'node_overload'
  | 'cascade'
  | 'bandwidth_collapse'
  | 'latency_spike'
  | 'random_drops';

export type SimulationSpeed = '1x' | '2x' | '10x';

/* ── WebSocket Events (Backend → Frontend) ── */

export interface NodeTelemetry {
  type: 'node_telemetry';
  timestamp: number;
  node_id: NodeId;
  queue_depth: number;
  queue_capacity: number;
  packets_sent: number;
  packets_dropped: number;
  latency_ms: number;
  occupancy: number;
  role: NodeRole;
  routing_strategy: string;
  retransmit_count?: number;
  throughput_bps?: number;
  congestion_level?: number;
}

export interface CongestionForecast {
  type: 'congestion_forecast';
  timestamp: number;
  horizon_seconds: number;
  scores: Record<NodeId, number>;
  propagation_etas?: Record<NodeId, number>;
}

export interface PacketEvent {
  type: 'packet_event';
  packet_id: string;
  event: 'created' | 'forwarded' | 'delivered' | 'dropped' | 'retransmitted';
  node_id: NodeId;
  timestamp: number;
}

export interface TopologyNode {
  id: NodeId;
  port: number;
  role: NodeRole;
  occupancy: number;
}

export interface TopologyLink {
  from: NodeId;
  to: NodeId;
  active: boolean;
  utilization: number;
  latency_ms: number;
  loss_rate: number;
}

export interface TopologyUpdate {
  type: 'topology_update';
  timestamp: number;
  nodes: TopologyNode[];
  links: TopologyLink[];
}

export interface MetricsSnapshot {
  type: 'metrics_snapshot';
  timestamp: number;
  packet_loss_rate: number;
  throughput_bps: number;
  avg_latency_ms: number;
  avg_queue_occupancy: number;
  congestion_duration_avg: number;
  total_packets_created: number;
  total_packets_delivered: number;
  total_packets_dropped: number;
  delivery_success_rate: number;
  reroute_count: number;
}

export type WSEvent =
  | NodeTelemetry
  | CongestionForecast
  | PacketEvent
  | TopologyUpdate
  | MetricsSnapshot;

/* ── WebSocket Commands (Frontend → Backend) ── */

export interface InjectScenarioCommand {
  command: 'inject_scenario';
  scenario_type: ScenarioType;
  source_node: NodeId;
  target_nodes: NodeId[];
  intensity: number;
  duration_ticks: number;
}

export interface SetSpeedCommand {
  command: 'set_speed';
  speed: string;
}

export interface SetTrafficEnabledCommand {
  command: 'set_traffic_enabled';
  enabled: boolean;
}

export interface SetRoutingCommand {
  command: 'set_routing_strategy';
  strategy: RoutingStrategy;
  node_id: NodeId | null;
}

export interface UpdateLinkCommand {
  command: 'update_link';
  from: NodeId;
  to: NodeId;
  latency_ms?: number;
  jitter_ms?: number;
  loss_rate?: number;
  bandwidth_bps?: number;
}

export interface ResetCommand {
  command: 'reset_simulation';
}

export interface AddNodeCommand {
  command: 'add_node';
  node_id: NodeId;
  port: number;
  role: NodeRole;
}

export interface RemoveNodeCommand {
  command: 'remove_node';
  node_id: NodeId;
}

export type WSCommand =
  | InjectScenarioCommand
  | SetSpeedCommand
  | SetTrafficEnabledCommand
  | SetRoutingCommand
  | UpdateLinkCommand
  | ResetCommand
  | AddNodeCommand
  | RemoveNodeCommand;

/* ── D3 Visualization Types ── */

export interface GraphNode extends d3.SimulationNodeDatum {
  id: NodeId;
  role: NodeRole;
  occupancy: number;
  queueDepth: number;
  queueCapacity: number;
  packetsSent: number;
  packetsDropped: number;
  latencyMs: number;
  forecastScore: number;
  routingStrategy: string;
  congestionLevel: number;
  retransmitCount: number;
  throughputBps: number;
}

export interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
  source: string | GraphNode;
  target: string | GraphNode;
  active: boolean;
  utilization: number;
  latencyMs: number;
  lossRate: number;
}

/* ── Timeline Data ── */

export interface TimelinePoint {
  tick: number;
  timestamp: number;
  value: number;
}

export type NodeTimelines = Record<NodeId, TimelinePoint[]>;

/* ── Propagation ETA ── */

export interface PropagationETA {
  nodeId: NodeId;
  etaSeconds: number;
}
