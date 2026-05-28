use rand::Rng;
use serde::{Deserialize, Serialize};

use crate::packet::NodeId;

/// Configurable conditions for a link between two nodes.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LinkCondition {
    /// Source node of this directed link
    pub from: NodeId,
    /// Destination node of this directed link
    pub to: NodeId,
    /// Base one-way delay in milliseconds
    pub latency_ms: f64,
    /// ± variation on latency in milliseconds
    pub jitter_ms: f64,
    /// Probability of packet drop (0.0 to 1.0)
    pub loss_rate: f64,
    /// Maximum throughput in bits per second
    pub bandwidth_bps: u64,
    /// Queue occupancy fraction that triggers congestion state
    pub congestion_threshold: f64,
    /// Whether this link is currently active
    pub active: bool,
    /// Current utilization (0.0 to 1.0), computed from traffic
    pub utilization: f64,
}

impl LinkCondition {
    /// Create a new link with default parameters from the spec.
    pub fn new(from: NodeId, to: NodeId) -> Self {
        Self {
            from,
            to,
            latency_ms: 10.0,
            jitter_ms: 2.0,
            loss_rate: 0.01,
            bandwidth_bps: 1_000_000, // 1 Mbps
            congestion_threshold: 0.75,
            active: true,
            utilization: 0.0,
        }
    }

    /// Compute the effective latency for this tick (base + random jitter).
    pub fn effective_latency(&self) -> f64 {
        let mut rng = rand::thread_rng();
        let jitter = rng.gen_range(-self.jitter_ms..=self.jitter_ms);
        (self.latency_ms + jitter).max(0.0)
    }

    /// Returns true if a packet should be dropped due to loss on this link.
    pub fn should_drop(&self) -> bool {
        if !self.active {
            return true;
        }
        let mut rng = rand::thread_rng();
        rng.gen::<f64>() < self.loss_rate
    }

    /// Compute the transmission delay for a given packet size (in bytes).
    /// Returns delay in milliseconds.
    pub fn transmission_delay_ms(&self, size_bytes: u32) -> f64 {
        if self.bandwidth_bps == 0 {
            return f64::MAX;
        }
        let bits = size_bytes as f64 * 8.0;
        (bits / self.bandwidth_bps as f64) * 1000.0
    }

    /// Weight used by the forecast engine: inverse of available bandwidth × loss rate.
    pub fn forecast_weight(&self) -> f64 {
        let available = (1.0 - self.utilization).max(0.01);
        let loss_factor = 1.0 + self.loss_rate * 10.0; // amplify loss impact
        loss_factor / available
    }

    /// Fail this link (used by `link_fail` scenario).
    pub fn fail(&mut self) {
        self.active = false;
        self.loss_rate = 1.0;
    }

    /// Restore this link to default conditions.
    pub fn restore(&mut self) {
        self.active = true;
        self.loss_rate = 0.01;
    }
}

/// The full network topology as a collection of directed links.
#[derive(Debug, Clone)]
pub struct Topology {
    /// All links in the network
    pub links: Vec<LinkCondition>,
}

impl Topology {
    /// Create a new empty topology.
    pub fn new() -> Self {
        Self { links: Vec::new() }
    }

    /// Build a fully connected mesh topology for the given node IDs.
    pub fn full_mesh(node_ids: &[NodeId]) -> Self {
        let mut links = Vec::new();
        for i in 0..node_ids.len() {
            for j in 0..node_ids.len() {
                if i != j {
                    links.push(LinkCondition::new(
                        node_ids[i].clone(),
                        node_ids[j].clone(),
                    ));
                }
            }
        }
        Self { links }
    }

    /// Build a ring topology for the given node IDs (bidirectional).
    pub fn ring(node_ids: &[NodeId]) -> Self {
        let mut links = Vec::new();
        let n = node_ids.len();
        for i in 0..n {
            let next = (i + 1) % n;
            links.push(LinkCondition::new(
                node_ids[i].clone(),
                node_ids[next].clone(),
            ));
            links.push(LinkCondition::new(
                node_ids[next].clone(),
                node_ids[i].clone(),
            ));
        }
        Self { links }
    }

    /// Get the link condition between two specific nodes.
    pub fn get_link(&self, from: &NodeId, to: &NodeId) -> Option<&LinkCondition> {
        self.links.iter().find(|l| &l.from == from && &l.to == to)
    }

    /// Get a mutable reference to the link between two specific nodes.
    pub fn get_link_mut(&mut self, from: &NodeId, to: &NodeId) -> Option<&mut LinkCondition> {
        self.links
            .iter_mut()
            .find(|l| &l.from == from && &l.to == to)
    }

    /// Get all neighbors of a node (nodes reachable via active links).
    pub fn neighbors(&self, node_id: &NodeId) -> Vec<NodeId> {
        self.links
            .iter()
            .filter(|l| &l.from == node_id && l.active)
            .map(|l| l.to.clone())
            .collect()
    }

    /// Update utilization for a link based on bytes transferred this tick.
    pub fn update_utilization(
        &mut self,
        from: &NodeId,
        to: &NodeId,
        bytes_this_tick: u64,
        tick_duration_ms: f64,
    ) {
        if let Some(link) = self.get_link_mut(from, to) {
            let bits = bytes_this_tick as f64 * 8.0;
            let capacity_bits = link.bandwidth_bps as f64 * (tick_duration_ms / 1000.0);
            link.utilization = (bits / capacity_bits).min(1.0);
        }
    }
}
