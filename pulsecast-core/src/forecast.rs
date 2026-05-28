use serde::{Deserialize, Serialize};
use std::collections::HashMap;

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
}

pub struct ForecastEngine {
    pub alpha: f64,
    pub propagation_depth: usize,
    pub horizon_seconds: f64,
    pub scores: HashMap<NodeId, f64>,
    pub accuracy_log: Vec<(HashMap<NodeId, f64>, HashMap<NodeId, f64>)>,
}

impl ForecastEngine {
    pub fn new() -> Self {
        Self {
            alpha: 0.3,
            propagation_depth: 3,
            horizon_seconds: 10.0,
            scores: HashMap::new(),
            accuracy_log: Vec::new(),
        }
    }

    pub fn compute(
        &mut self,
        nodes: &[NodeState],
        topology: &Topology,
        timestamp: f64,
    ) -> CongestionForecast {
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
        CongestionForecast {
            event_type: "congestion_forecast".to_string(),
            timestamp,
            horizon_seconds: self.horizon_seconds,
            scores: current_scores,
        }
    }
}
