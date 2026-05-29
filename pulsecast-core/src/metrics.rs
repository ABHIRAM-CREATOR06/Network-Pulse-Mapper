use serde::{Deserialize, Serialize};
use std::collections::{HashMap, VecDeque};
use crate::node::NodeState;

pub struct MetricsEngine {
    window_size: usize,
    packet_loss_history: VecDeque<f64>,
    throughput_history: VecDeque<f64>,
    latency_history: VecDeque<f64>,
    total_packets_created: u64,
    total_packets_delivered: u64,
    total_packets_dropped: u64,
    total_reroutes: u64,
    congestion_start_ticks: HashMap<String, u64>,
    congestion_durations: Vec<f64>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct MetricsSnapshot {
    #[serde(rename = "type")]
    pub event_type: String,
    pub timestamp: f64,
    pub packet_loss_rate: f64,
    pub throughput_bps: f64,
    pub avg_latency_ms: f64,
    pub avg_queue_occupancy: f64,
    pub congestion_duration_avg: f64,
    pub total_packets_created: u64,
    pub total_packets_delivered: u64,
    pub total_packets_dropped: u64,
    pub delivery_success_rate: f64,
    pub reroute_count: u64,
}

impl MetricsEngine {
    pub fn new(window_size: usize) -> Self {
        Self {
            window_size,
            packet_loss_history: VecDeque::with_capacity(window_size),
            throughput_history: VecDeque::with_capacity(window_size),
            latency_history: VecDeque::with_capacity(window_size),
            total_packets_created: 0,
            total_packets_delivered: 0,
            total_packets_dropped: 0,
            total_reroutes: 0,
            congestion_start_ticks: HashMap::new(),
            congestion_durations: Vec::new(),
        }
    }

    pub fn record_created(&mut self, _count: u64) {
        self.total_packets_created += _count;
    }

    pub fn record_delivered(&mut self, _count: u64, latency_ms: f64) {
        self.total_packets_delivered += _count;
        self.latency_history.push_back(latency_ms);
        if self.latency_history.len() > self.window_size {
            self.latency_history.pop_front();
        }
    }

    pub fn record_dropped(&mut self, _count: u64) {
        self.total_packets_dropped += _count;
    }

    pub fn record_reroute(&mut self) {
        self.total_reroutes += 1;
    }

    pub fn record_tick(&mut self, nodes: &[NodeState], tick: u64) {
        // Compute loss rate of this tick
        let total_sent: u64 = nodes.iter().map(|n| n.packets_sent).sum();
        let total_dropped: u64 = nodes.iter().map(|n| n.packets_dropped).sum();
        
        let loss_rate = if total_sent > 0 {
            total_dropped as f64 / (total_sent + total_dropped) as f64
        } else {
            0.0
        };
        self.packet_loss_history.push_back(loss_rate);
        if self.packet_loss_history.len() > self.window_size {
            self.packet_loss_history.pop_front();
        }

        // Calculate throughput bps for this tick
        let total_bytes: u64 = nodes.iter().map(|n| n.bytes_forwarded_this_tick).sum();
        let bits = total_bytes as f64 * 8.0;
        let bps = bits / 0.5; // 0.5s per tick
        self.throughput_history.push_back(bps);
        if self.throughput_history.len() > self.window_size {
            self.throughput_history.pop_front();
        }

        // Track congestion durations
        for node in nodes {
            let is_congested = node.occupancy() > 0.75;
            match (is_congested, self.congestion_start_ticks.get(&node.id)) {
                (true, None) => {
                    self.congestion_start_ticks.insert(node.id.clone(), tick);
                }
                (false, Some(start_tick)) => {
                    let duration_ticks = tick.saturating_sub(*start_tick);
                    let duration_seconds = duration_ticks as f64 * 0.5;
                    self.congestion_durations.push(duration_seconds);
                    self.congestion_start_ticks.remove(&node.id);
                }
                _ => {}
            }
        }
    }

    pub fn snapshot(&self, timestamp: f64, nodes: &[NodeState]) -> MetricsSnapshot {
        let avg_loss = if self.packet_loss_history.is_empty() {
            0.0
        } else {
            self.packet_loss_history.iter().sum::<f64>() / self.packet_loss_history.len() as f64
        };

        let avg_throughput = if self.throughput_history.is_empty() {
            0.0
        } else {
            self.throughput_history.iter().sum::<f64>() / self.throughput_history.len() as f64
        };

        let avg_latency = if self.latency_history.is_empty() {
            10.0 // baseline latency
        } else {
            self.latency_history.iter().sum::<f64>() / self.latency_history.len() as f64
        };

        let avg_queue_occ = if nodes.is_empty() {
            0.0
        } else {
            nodes.iter().map(|n| n.occupancy()).sum::<f64>() / nodes.len() as f64
        };

        let avg_congestion_dur = if self.congestion_durations.is_empty() {
            0.0
        } else {
            self.congestion_durations.iter().sum::<f64>() / self.congestion_durations.len() as f64
        };

        let success_rate = if self.total_packets_created > 0 {
            self.total_packets_delivered as f64 / self.total_packets_created as f64
        } else {
            1.0
        };

        MetricsSnapshot {
            event_type: "metrics_snapshot".to_string(),
            timestamp,
            packet_loss_rate: avg_loss,
            throughput_bps: avg_throughput,
            avg_latency_ms: avg_latency,
            avg_queue_occupancy: avg_queue_occ,
            congestion_duration_avg: avg_congestion_dur,
            total_packets_created: self.total_packets_created,
            total_packets_delivered: self.total_packets_delivered,
            total_packets_dropped: self.total_packets_dropped,
            delivery_success_rate: success_rate,
            reroute_count: self.total_reroutes,
        }
    }
}
