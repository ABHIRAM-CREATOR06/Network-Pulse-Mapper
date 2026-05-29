use serde::{Deserialize, Serialize};
use std::collections::{BinaryHeap, HashMap};

use crate::link::Topology;
use crate::node::NodeState;
use crate::packet::NodeId;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CongestionForecast {
    #[serde(rename = "type")]
    pub event_type: String,
    pub timestamp: f64,
    pub horizon_seconds: f64,
    pub scores: HashMap<NodeId, f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub propagation_etas: Option<HashMap<NodeId, f64>>,
}

pub struct ForecastEngine {
    pub alpha: f64,
    pub propagation_depth: usize,
    pub horizon_seconds: f64,
    pub scores: HashMap<NodeId, f64>,
    pub accuracy_log: Vec<(HashMap<NodeId, f64>, HashMap<NodeId, f64>)>,
    pub queue_growth_rates: HashMap<NodeId, f64>,
}

impl ForecastEngine {
    pub fn new() -> Self {
        Self {
            alpha: 0.3,
            propagation_depth: 3,
            horizon_seconds: 10.0,
            scores: HashMap::new(),
            accuracy_log: Vec::new(),
            queue_growth_rates: HashMap::new(),
        }
    }

    /// Calculate prediction accuracy: 1.0 - mean absolute error between predicted scores and actual occupancies
    pub fn prediction_accuracy(&self) -> f64 {
        if self.accuracy_log.is_empty() {
            return 1.0;
        }
        let mut total_mae = 0.0;
        for (pred, actual) in &self.accuracy_log {
            let mut sum_error = 0.0;
            let mut count = 0;
            for (node_id, p_val) in pred {
                if let Some(a_val) = actual.get(node_id) {
                    sum_error += (p_val - a_val).abs();
                    count += 1;
                }
            }
            if count > 0 {
                total_mae += sum_error / count as f64;
            }
        }
        (1.0 - (total_mae / self.accuracy_log.len() as f64)).clamp(0.0, 1.0)
    }

    pub fn compute(
        &mut self,
        nodes: &[NodeState],
        topology: &Topology,
        timestamp: f64,
    ) -> CongestionForecast {
        // Calculate queue growth rates: (current_occupancy - average occupancy of older entries) / window
        self.queue_growth_rates.clear();
        for node in nodes {
            let current_occupancy = node.occupancy();
            if node.congestion_history.len() >= 5 {
                let len = node.congestion_history.len();
                let prev_avg: f64 = node.congestion_history.iter().take(len - 1).sum::<f64>() / (len - 1) as f64;
                let growth_rate = (current_occupancy - prev_avg) / 0.5; // per second
                self.queue_growth_rates.insert(node.id.clone(), growth_rate);
            } else {
                self.queue_growth_rates.insert(node.id.clone(), 0.0);
            }
        }

        let mut current_scores: HashMap<NodeId, f64> = nodes
            .iter()
            .map(|n| (n.id.clone(), n.occupancy()))
            .collect();

        if !self.scores.is_empty() {
            let actual: HashMap<NodeId, f64> = nodes
                .iter()
                .map(|n| (n.id.clone(), n.occupancy()))
                .collect();
            self.accuracy_log.push((self.scores.clone(), actual));
            if self.accuracy_log.len() > 100 {
                self.accuracy_log.remove(0);
            }
        }

        for _ in 0..self.propagation_depth {
            let mut next_scores = HashMap::new();
            for node in nodes {
                let current_load = current_scores.get(&node.id).copied().unwrap_or(0.0);
                let neighbors = topology.neighbors(&node.id);
                let mut neighbor_sum = 0.0;
                let mut weight_sum = 0.0;
                for neighbor_id in &neighbors {
                    let ns = current_scores.get(neighbor_id).copied().unwrap_or(0.0);
                    let lw = topology
                        .get_link(neighbor_id, &node.id)
                        .map(|l| l.forecast_weight())
                        .unwrap_or(1.0);
                    neighbor_sum += ns * lw;
                    weight_sum += lw;
                }
                let nc = if weight_sum > 0.0 { neighbor_sum / weight_sum } else { 0.0 };
                let forecast = self.alpha * current_load + (1.0 - self.alpha) * nc;
                next_scores.insert(node.id.clone(), forecast.clamp(0.0, 1.0));
            }
            current_scores = next_scores;
        }

        self.scores = current_scores.clone();

        // Calculate propagation ETAs: estimated seconds until congestion reaches node.
        // For each node that is NOT congested (occupancy <= 0.75), find shortest path (in terms of latency)
        // to a node that IS congested (> 0.75), and sum the latencies along that path.
        let mut propagation_etas = HashMap::new();
        let congested_nodes: Vec<&NodeState> = nodes.iter().filter(|n| n.occupancy() > 0.75).collect();

        for node in nodes {
            if node.occupancy() > 0.75 {
                propagation_etas.insert(node.id.clone(), 0.0);
            } else if congested_nodes.is_empty() {
                propagation_etas.insert(node.id.clone(), -1.0); // no congestion in network
            } else {
                // Find shortest distance to any congested node using BFS/Dijkstra on link latencies
                let mut min_eta = f64::MAX;
                for cong in &congested_nodes {
                    // Let's do a simple shortest path calculation based on link latency
                    if let Some(path_latency) = self.find_path_latency(&node.id, &cong.id, topology) {
                        if path_latency < min_eta {
                            min_eta = path_latency;
                        }
                    }
                }
                if min_eta < f64::MAX {
                    propagation_etas.insert(node.id.clone(), min_eta / 1000.0); // convert ms to seconds
                } else {
                    propagation_etas.insert(node.id.clone(), -1.0); // unreachable
                }
            }
        }

        CongestionForecast {
            event_type: "congestion_forecast".to_string(),
            timestamp,
            horizon_seconds: self.horizon_seconds,
            scores: current_scores,
            propagation_etas: Some(propagation_etas),
        }
    }

    fn find_path_latency(&self, start: &NodeId, end: &NodeId, topology: &Topology) -> Option<f64> {
        let mut distances = HashMap::new();

        struct DijkstraState {
            cost: f64,
            node: NodeId,
        }
        impl PartialEq for DijkstraState {
            fn eq(&self, other: &Self) -> bool { self.cost == other.cost }
        }
        impl Eq for DijkstraState {}
        impl Ord for DijkstraState {
            fn cmp(&self, other: &Self) -> std::cmp::Ordering {
                other.cost.partial_cmp(&self.cost).unwrap_or(std::cmp::Ordering::Equal)
            }
        }
        impl PartialOrd for DijkstraState {
            fn partial_cmp(&self, other: &Self) -> Option<std::cmp::Ordering> {
                Some(self.cmp(other))
            }
        }

        distances.insert(start.clone(), 0.0);
        let mut pq = BinaryHeap::new();
        pq.push(DijkstraState { cost: 0.0, node: start.clone() });

        while let Some(DijkstraState { cost, node }) = pq.pop() {
            if &node == end {
                return Some(cost);
            }
            if let Some(&best) = distances.get(&node) {
                if cost > best { continue; }
            }
            for neighbor in topology.neighbors(&node) {
                if let Some(link) = topology.get_link(&node, &neighbor) {
                    let next_cost = cost + link.latency_ms;
                    let current_best = distances.get(&neighbor).copied().unwrap_or(f64::MAX);
                    if next_cost < current_best {
                        distances.insert(neighbor.clone(), next_cost);
                        pq.push(DijkstraState { cost: next_cost, node: neighbor });
                    }
                }
            }
        }
        None
    }
}
