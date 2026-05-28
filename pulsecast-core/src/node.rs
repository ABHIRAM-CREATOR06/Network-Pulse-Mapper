use serde::{Deserialize, Serialize};
use std::collections::{HashMap, VecDeque};

use crate::packet::{NodeId, Packet, PacketEvent};

/// The role a node plays in the simulation.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum NodeRole {
    Sender,
    Receiver,
    Router,
    CongestionSource,
}

/// Per-node state matching the spec's NodeState struct.
/// Designed as a Vec<NodeState> from day one — no hardcoded count.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NodeState {
    /// Unique node identifier (e.g., "A", "B", "Node-1")
    pub id: NodeId,
    /// Localhost port this node is bound to
    pub port: u16,
    /// Current number of packets in the queue
    pub queue_depth: usize,
    /// Maximum queue capacity
    pub queue_capacity: usize,
    /// Total packets sent by this node
    pub packets_sent: u64,
    /// Total packets dropped by this node
    pub packets_dropped: u64,
    /// Current measured latency in milliseconds
    pub latency_ms: f64,
    /// Routing table: neighbor node ID → link weight
    pub routing_table: HashMap<NodeId, f64>,
    /// Rolling window of queue occupancy ratios for forecasting
    pub congestion_history: VecDeque<f64>,
    /// The node's current role
    pub role: NodeRole,
    /// Packets currently in the queue (not serialized in telemetry)
    #[serde(skip)]
    pub packet_queue: VecDeque<Packet>,
    /// How many packets this node drains per tick
    pub drain_rate: usize,
    /// Active routing strategy for this node
    pub routing_strategy: String,
    /// Total bytes forwarded this tick (for utilization calc)
    #[serde(skip)]
    pub bytes_forwarded_this_tick: u64,
}

impl NodeState {
    /// Create a new node with the given ID and port.
    pub fn new(id: NodeId, port: u16, role: NodeRole) -> Self {
        Self {
            id,
            port,
            queue_depth: 0,
            queue_capacity: 500,
            packets_sent: 0,
            packets_dropped: 0,
            latency_ms: 0.0,
            routing_table: HashMap::new(),
            congestion_history: VecDeque::with_capacity(120), // ~60s at 2Hz
            role,
            packet_queue: VecDeque::with_capacity(500),
            drain_rate: 10, // packets per tick
            routing_strategy: "shortest_path".to_string(),
            bytes_forwarded_this_tick: 0,
        }
    }

    /// Queue occupancy as a fraction (0.0 to 1.0).
    pub fn occupancy(&self) -> f64 {
        if self.queue_capacity == 0 {
            return 1.0;
        }
        self.queue_depth as f64 / self.queue_capacity as f64
    }

    /// Enqueue a packet. Returns a drop event if the queue is full.
    pub fn enqueue(&mut self, packet: Packet, timestamp: f64) -> Option<PacketEvent> {
        if self.queue_depth >= self.queue_capacity {
            self.packets_dropped += 1;
            return Some(PacketEvent::Dropped {
                packet_id: packet.id.clone(),
                node_id: self.id.clone(),
                reason: "queue_full".to_string(),
                timestamp,
            });
        }
        self.queue_depth += 1;
        self.packet_queue.push_back(packet);
        None
    }

    /// Drain packets from the queue (up to drain_rate).
    /// Returns the packets ready to be forwarded.
    pub fn drain(&mut self) -> Vec<Packet> {
        let count = self.drain_rate.min(self.packet_queue.len());
        let mut drained = Vec::with_capacity(count);
        for _ in 0..count {
            if let Some(pkt) = self.packet_queue.pop_front() {
                self.queue_depth = self.queue_depth.saturating_sub(1);
                drained.push(pkt);
            }
        }
        drained
    }

    /// Record queue occupancy in the rolling history window.
    pub fn record_occupancy(&mut self) {
        let occ = self.occupancy();
        self.congestion_history.push_back(occ);
        // Keep the rolling window bounded
        if self.congestion_history.len() > 120 {
            self.congestion_history.pop_front();
        }
    }

    /// Generate a telemetry event for WebSocket emission.
    pub fn telemetry(&self, timestamp: f64) -> NodeTelemetry {
        NodeTelemetry {
            event_type: "node_telemetry".to_string(),
            timestamp,
            node_id: self.id.clone(),
            queue_depth: self.queue_depth,
            queue_capacity: self.queue_capacity,
            packets_sent: self.packets_sent,
            packets_dropped: self.packets_dropped,
            latency_ms: self.latency_ms,
            occupancy: self.occupancy(),
            role: self.role.clone(),
            routing_strategy: self.routing_strategy.clone(),
        }
    }

    /// Reset per-tick counters.
    pub fn reset_tick(&mut self) {
        self.bytes_forwarded_this_tick = 0;
    }
}

/// Telemetry payload sent over WebSocket.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NodeTelemetry {
    #[serde(rename = "type")]
    pub event_type: String,
    pub timestamp: f64,
    pub node_id: NodeId,
    pub queue_depth: usize,
    pub queue_capacity: usize,
    pub packets_sent: u64,
    pub packets_dropped: u64,
    pub latency_ms: f64,
    pub occupancy: f64,
    pub role: NodeRole,
    pub routing_strategy: String,
}

/// Configuration for dynamically creating nodes.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NodeConfig {
    pub id: NodeId,
    pub port: u16,
    pub role: NodeRole,
    pub queue_capacity: usize,
    pub drain_rate: usize,
}

impl NodeConfig {
    pub fn to_node_state(&self) -> NodeState {
        let mut node = NodeState::new(self.id.clone(), self.port, self.role.clone());
        node.queue_capacity = self.queue_capacity;
        node.drain_rate = self.drain_rate;
        node
    }
}

/// Generate default node configurations for N nodes.
/// Node IDs are alphabetical: A, B, C, ... or Node-1, Node-2, ... for N > 26.
pub fn default_node_configs(count: usize, base_port: u16) -> Vec<NodeConfig> {
    let mut configs = Vec::with_capacity(count);
    for i in 0..count {
        let id = if count <= 26 {
            String::from((b'A' + i as u8) as char)
        } else {
            format!("Node-{}", i + 1)
        };
        let role = match i {
            0 => NodeRole::Sender,
            i if i == count - 1 => NodeRole::Receiver,
            _ => NodeRole::Router,
        };
        let drain_rate = match role {
            NodeRole::Receiver => 50,
            NodeRole::Router => 30,
            NodeRole::CongestionSource => 20,
            NodeRole::Sender => 10,
        };

        configs.push(NodeConfig {
            id,
            port: base_port + i as u16,
            role,
            queue_capacity: 500,
            drain_rate,
        });
    }
    configs
}
