use serde::{Deserialize, Serialize};
use std::time::Instant;
use uuid::Uuid;

/// Unique identifier for a packet.
pub type PacketId = String;

/// Unique identifier for a node.
pub type NodeId = String;

/// A discrete simulation unit representing a network packet.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Packet {
    /// Unique packet identifier (e.g., "pkt-00421")
    pub id: PacketId,
    /// Source node ID
    pub source: NodeId,
    /// Final destination node ID
    pub destination: NodeId,
    /// Packet size in bytes
    pub size_bytes: u32,
    /// Priority level (0 = lowest, 255 = highest)
    pub priority: u8,
    /// Simulation tick when the packet was created
    pub tick_created: u64,
    /// Time-to-live: decremented at each hop, packet dropped when 0
    pub ttl: u8,
    /// Ordered list of node IDs this packet has traversed
    pub route_history: Vec<NodeId>,
}

impl Packet {
    /// Create a new packet with a unique ID.
    pub fn new(
        source: NodeId,
        destination: NodeId,
        size_bytes: u32,
        priority: u8,
        tick_created: u64,
    ) -> Self {
        let id = format!("pkt-{}", &Uuid::new_v4().to_string()[..8]);
        Self {
            id,
            source: source.clone(),
            destination,
            size_bytes,
            priority,
            tick_created,
            ttl: 16, // default max hops
            route_history: vec![source],
        }
    }

    /// Record a hop through a node. Returns false if TTL expired.
    pub fn record_hop(&mut self, node_id: &NodeId) -> bool {
        if self.ttl == 0 {
            return false;
        }
        self.ttl -= 1;
        self.route_history.push(node_id.clone());
        true
    }

    /// Check if this packet has reached its destination.
    pub fn has_arrived(&self) -> bool {
        self.route_history
            .last()
            .map_or(false, |last| last == &self.destination)
    }
}

/// Events emitted when something happens to a packet.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "event")]
pub enum PacketEvent {
    #[serde(rename = "created")]
    Created {
        packet_id: PacketId,
        node_id: NodeId,
        timestamp: f64,
    },
    #[serde(rename = "forwarded")]
    Forwarded {
        packet_id: PacketId,
        from_node: NodeId,
        to_node: NodeId,
        timestamp: f64,
    },
    #[serde(rename = "delivered")]
    Delivered {
        packet_id: PacketId,
        node_id: NodeId,
        timestamp: f64,
    },
    #[serde(rename = "dropped")]
    Dropped {
        packet_id: PacketId,
        node_id: NodeId,
        reason: String,
        timestamp: f64,
    },
}
