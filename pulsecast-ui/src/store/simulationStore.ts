import { create } from 'zustand';
import type {
  NodeId,
  NodeTelemetry,
  CongestionForecast,
  PacketEvent,
  TopologyUpdate,
  GraphNode,
  GraphLink,
  SimulationSpeed,
  RoutingStrategy,
  TimelinePoint,
  NodeTimelines,
} from '../utils/types';

interface SimulationState {
  /* ── Connection ── */
  connected: boolean;
  setConnected: (v: boolean) => void;

  /* ── Node Telemetry ── */
  nodes: Map<NodeId, NodeTelemetry>;
  updateNode: (telemetry: NodeTelemetry) => void;

  /* ── Forecast ── */
  forecast: CongestionForecast | null;
  setForecast: (f: CongestionForecast) => void;

  /* ── Topology ── */
  topologyNodes: GraphNode[];
  topologyLinks: GraphLink[];
  updateTopology: (update: TopologyUpdate) => void;

  /* ── Packet Events ── */
  recentEvents: PacketEvent[];
  addPacketEvent: (event: PacketEvent) => void;

  /* ── Timelines ── */
  timelines: NodeTimelines;
  tickCounter: number;

  /* ── Controls ── */
  speed: SimulationSpeed;
  setSpeed: (s: SimulationSpeed) => void;
  routingStrategy: RoutingStrategy;
  setRoutingStrategy: (s: RoutingStrategy) => void;
  activeView: 'topology' | 'pulse' | 'forecast' | 'timeline' | 'learn';
  setActiveView: (v: 'topology' | 'pulse' | 'forecast' | 'timeline' | 'learn') => void;
  selectedNode: NodeId | null;
  setSelectedNode: (id: NodeId | null) => void;

  /* ── Stats ── */
  totalPacketsSent: number;
  totalPacketsDropped: number;
}

export const useSimulationStore = create<SimulationState>((set, get) => ({
  connected: false,
  setConnected: (v) => set({ connected: v }),

  nodes: new Map(),
  updateNode: (telemetry) =>
    set((state) => {
      const nodes = new Map(state.nodes);
      nodes.set(telemetry.node_id, telemetry);

      // Update timelines
      const timelines = { ...state.timelines };
      const nodeTimeline = timelines[telemetry.node_id] || [];
      const newPoint: TimelinePoint = {
        tick: state.tickCounter + 1,
        timestamp: telemetry.timestamp,
        value: telemetry.occupancy,
      };
      // Keep last 120 points
      const updated = [...nodeTimeline, newPoint].slice(-120);
      timelines[telemetry.node_id] = updated;

      // Update graph nodes with telemetry
      const topologyNodes = state.topologyNodes.map((n) => {
        if (n.id === telemetry.node_id) {
          return {
            ...n,
            occupancy: telemetry.occupancy,
            queueDepth: telemetry.queue_depth,
            queueCapacity: telemetry.queue_capacity,
            packetsSent: telemetry.packets_sent,
            packetsDropped: telemetry.packets_dropped,
            latencyMs: telemetry.latency_ms,
            routingStrategy: telemetry.routing_strategy,
            role: telemetry.role,
          };
        }
        return n;
      });

      // Compute totals
      let totalSent = 0;
      let totalDropped = 0;
      nodes.forEach((n) => {
        totalSent += n.packets_sent;
        totalDropped += n.packets_dropped;
      });

      return {
        nodes,
        timelines,
        topologyNodes,
        tickCounter: state.tickCounter + 1,
        totalPacketsSent: totalSent,
        totalPacketsDropped: totalDropped,
      };
    }),

  forecast: null,
  setForecast: (f) =>
    set((state) => {
      // Update graph nodes with forecast scores
      const topologyNodes = state.topologyNodes.map((n) => ({
        ...n,
        forecastScore: f.scores[n.id] ?? 0,
      }));
      return { forecast: f, topologyNodes };
    }),

  topologyNodes: [],
  topologyLinks: [],
  updateTopology: (update) =>
    set((state) => {
      const existingMap = new Map(state.topologyNodes.map((n) => [n.id, n]));

      const topologyNodes: GraphNode[] = update.nodes.map((n) => {
        const existing = existingMap.get(n.id);
        return {
          ...(existing || {}),
          id: n.id,
          role: n.role,
          occupancy: n.occupancy,
          queueDepth: existing?.queueDepth ?? 0,
          queueCapacity: existing?.queueCapacity ?? 500,
          packetsSent: existing?.packetsSent ?? 0,
          packetsDropped: existing?.packetsDropped ?? 0,
          latencyMs: existing?.latencyMs ?? 0,
          forecastScore: existing?.forecastScore ?? 0,
          routingStrategy: existing?.routingStrategy ?? 'shortest_path',
          // Preserve x/y positions if they exist
          x: existing?.x,
          y: existing?.y,
        };
      });

      // Deduplicate links — keep only one link per A↔B pair
      const seen = new Set<string>();
      const topologyLinks: GraphLink[] = [];
      for (const l of update.links) {
        const key = [l.from, l.to].sort().join('-');
        if (!seen.has(key)) {
          seen.add(key);
          topologyLinks.push({
            source: l.from,
            target: l.to,
            active: l.active,
            utilization: l.utilization,
            latencyMs: l.latency_ms,
            lossRate: l.loss_rate,
          });
        }
      }

      return { topologyNodes, topologyLinks };
    }),

  recentEvents: [],
  addPacketEvent: (event) =>
    set((state) => ({
      recentEvents: [...state.recentEvents, event].slice(-50),
    })),

  timelines: {},
  tickCounter: 0,

  speed: '1x',
  setSpeed: (s) => set({ speed: s }),
  routingStrategy: 'shortest_path',
  setRoutingStrategy: (s) => set({ routingStrategy: s }),
  activeView: 'topology',
  setActiveView: (v) => set({ activeView: v }),
  selectedNode: null,
  setSelectedNode: (id) => set({ selectedNode: id }),

  totalPacketsSent: 0,
  totalPacketsDropped: 0,
}));
