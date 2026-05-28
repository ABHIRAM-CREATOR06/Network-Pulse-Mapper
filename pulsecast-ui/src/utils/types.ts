/* ── Types matching the WebSocket event schema from the Rust backend ── */

export type NodeId = string;

export type NodeRole = 'sender' | 'receiver' | 'router' | 'congestion_source';

export type RoutingStrategy = 'shortest_path' | 'congestion_aware' | 'predictive_reroute' | 'memory_based';

export type ScenarioType = 'burst' | 'storm' | 'link_fail' | 'node_overload' | 'cascade';

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
}

export interface CongestionForecast {
  type: 'congestion_forecast';
  timestamp: number;
  horizon_seconds: number;
  scores: Record<NodeId, number>;
}

export interface PacketEvent {
  type: 'packet_event';
  packet_id: string;
  event: 'created' | 'forwarded' | 'delivered' | 'dropped';
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

export type WSEvent = NodeTelemetry | CongestionForecast | PacketEvent | TopologyUpdate;

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

export type WSCommand = InjectScenarioCommand | SetSpeedCommand | SetRoutingCommand | UpdateLinkCommand;

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
