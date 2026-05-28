use std::collections::{BinaryHeap, HashMap, HashSet, VecDeque};
use std::cmp::Ordering;
use serde::{Deserialize, Serialize};

use crate::link::Topology;
use crate::node::NodeState;
use crate::packet::NodeId;

/// Available routing strategies (runtime-swappable).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum RoutingStrategyType {
    ShortestPath,
    CongestionAware,
    PredictiveReroute,
    MemoryBased,
}

impl RoutingStrategyType {
    pub fn from_str(s: &str) -> Self {
        match s {
            "congestion_aware" => Self::CongestionAware,
            "predictive_reroute" => Self::PredictiveReroute,
            "memory_based" => Self::MemoryBased,
            _ => Self::ShortestPath,
        }
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            Self::ShortestPath => "shortest_path",
            Self::CongestionAware => "congestion_aware",
            Self::PredictiveReroute => "predictive_reroute",
            Self::MemoryBased => "memory_based",
        }
    }
}

/// Entry for Dijkstra's priority queue.
#[derive(Debug, Clone)]
struct DijkstraEntry {
    node: NodeId,
    cost: f64,
}

impl PartialEq for DijkstraEntry {
    fn eq(&self, other: &Self) -> bool {
        self.cost.eq(&other.cost)
    }
}

impl Eq for DijkstraEntry {}

impl PartialOrd for DijkstraEntry {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

impl Ord for DijkstraEntry {
    fn cmp(&self, other: &Self) -> Ordering {
        // Reverse ordering for min-heap behavior
        other
            .cost
            .partial_cmp(&self.cost)
            .unwrap_or(Ordering::Equal)
    }
}

/// The main router that computes next-hop decisions.
pub struct Router;

impl Router {
    /// Compute the next hop from `source` to `destination` using the given strategy.
    pub fn next_hop(
        source: &NodeId,
        destination: &NodeId,
        strategy: &RoutingStrategyType,
        topology: &Topology,
        nodes: &[NodeState],
        forecast_scores: &HashMap<NodeId, f64>,
        congestion_memory: &HashMap<NodeId, f64>,
    ) -> Option<NodeId> {
        match strategy {
            RoutingStrategyType::ShortestPath => {
                Self::shortest_path(source, destination, topology)
            }
            RoutingStrategyType::CongestionAware => {
                Self::congestion_aware(source, destination, topology, nodes)
            }
            RoutingStrategyType::PredictiveReroute => {
                Self::predictive_reroute(source, destination, topology, nodes, forecast_scores)
            }
            RoutingStrategyType::MemoryBased => {
                Self::memory_based(source, destination, topology, congestion_memory)
            }
        }
    }

    /// ShortestPath: Static hop-count minimization via Dijkstra.
    /// All active links have equal weight (1.0).
    fn shortest_path(
        source: &NodeId,
        destination: &NodeId,
        topology: &Topology,
    ) -> Option<NodeId> {
        Self::dijkstra(source, destination, topology, |_from, _to| 1.0)
    }

    /// CongestionAware: Weights links by the destination node's queue occupancy.
    fn congestion_aware(
        source: &NodeId,
        destination: &NodeId,
        topology: &Topology,
        nodes: &[NodeState],
    ) -> Option<NodeId> {
        let occupancy_map: HashMap<&NodeId, f64> =
            nodes.iter().map(|n| (&n.id, n.occupancy())).collect();

        Self::dijkstra(source, destination, topology, |_from, to| {
            let occ = occupancy_map.get(&to).copied().unwrap_or(0.0);
            1.0 + occ * 10.0 // heavily penalize congested nodes
        })
    }

    /// PredictiveReroute: Uses forecast scores to avoid future bottlenecks.
    fn predictive_reroute(
        source: &NodeId,
        destination: &NodeId,
        topology: &Topology,
        nodes: &[NodeState],
        forecast_scores: &HashMap<NodeId, f64>,
    ) -> Option<NodeId> {
        let occupancy_map: HashMap<&NodeId, f64> =
            nodes.iter().map(|n| (&n.id, n.occupancy())).collect();

        Self::dijkstra(source, destination, topology, |_from, to| {
            let occ = occupancy_map.get(&to).copied().unwrap_or(0.0);
            let forecast = forecast_scores.get(&to).copied().unwrap_or(0.0);
            // Blend current load with predicted future load
            1.0 + (occ * 5.0) + (forecast * 15.0)
        })
    }

    /// MemoryBased: Avoids historically congested links with exponential decay.
    fn memory_based(
        source: &NodeId,
        destination: &NodeId,
        topology: &Topology,
        congestion_memory: &HashMap<NodeId, f64>,
    ) -> Option<NodeId> {
        Self::dijkstra(source, destination, topology, |_from, to| {
            let memory_score = congestion_memory.get(&to).copied().unwrap_or(0.0);
            1.0 + memory_score * 8.0
        })
    }

    /// Generic Dijkstra with a caller-supplied edge weight function.
    /// Returns the first hop on the shortest path from source to destination.
    fn dijkstra<F>(
        source: &NodeId,
        destination: &NodeId,
        topology: &Topology,
        weight_fn: F,
    ) -> Option<NodeId>
    where
        F: Fn(&NodeId, &NodeId) -> f64,
    {
        let mut dist: HashMap<NodeId, f64> = HashMap::new();
        let mut prev: HashMap<NodeId, NodeId> = HashMap::new();
        let mut visited: HashSet<NodeId> = HashSet::new();
        let mut heap = BinaryHeap::new();

        dist.insert(source.clone(), 0.0);
        heap.push(DijkstraEntry {
            node: source.clone(),
            cost: 0.0,
        });

        while let Some(DijkstraEntry { node, cost }) = heap.pop() {
            if &node == destination {
                // Trace back to find the first hop
                let mut current = destination.clone();
                while let Some(p) = prev.get(&current) {
                    if p == source {
                        return Some(current);
                    }
                    current = p.clone();
                }
                return None; // source == destination or no path
            }

            if !visited.insert(node.clone()) {
                continue;
            }

            for neighbor in topology.neighbors(&node) {
                if visited.contains(&neighbor) {
                    continue;
                }
                let edge_weight = weight_fn(&node, &neighbor);
                let new_cost = cost + edge_weight;
                let current_cost = dist.get(&neighbor).copied().unwrap_or(f64::MAX);

                if new_cost < current_cost {
                    dist.insert(neighbor.clone(), new_cost);
                    prev.insert(neighbor.clone(), node.clone());
                    heap.push(DijkstraEntry {
                        node: neighbor,
                        cost: new_cost,
                    });
                }
            }
        }

        None // no path found
    }
}

/// Congestion memory tracker with exponential decay.
/// Stores a "memory score" per node that decays each tick.
#[derive(Debug, Clone)]
pub struct CongestionMemory {
    pub scores: HashMap<NodeId, f64>,
    pub decay_factor: f64,
}

impl CongestionMemory {
    pub fn new(decay_factor: f64) -> Self {
        Self {
            scores: HashMap::new(),
            decay_factor,
        }
    }

    /// Record that a node experienced congestion.
    pub fn record_congestion(&mut self, node_id: &NodeId, severity: f64) {
        let entry = self.scores.entry(node_id.clone()).or_insert(0.0);
        *entry = (*entry + severity).min(1.0);
    }

    /// Apply exponential decay to all memory scores.
    pub fn decay(&mut self) {
        for score in self.scores.values_mut() {
            *score *= self.decay_factor;
            if *score < 0.001 {
                *score = 0.0;
            }
        }
    }
}
