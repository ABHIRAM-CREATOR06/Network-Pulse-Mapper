use serde::{Deserialize, Serialize};

/// Simulation speed multiplier.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub enum SimulationSpeed {
    Normal,   // 1x
    Fast,     // 2x
    VeryFast, // 10x
}

impl SimulationSpeed {
    pub fn multiplier(&self) -> f64 {
        match self {
            Self::Normal => 1.0,
            Self::Fast => 2.0,
            Self::VeryFast => 10.0,
        }
    }

    /// Tick interval in milliseconds (base = 500ms per tick at 1x).
    pub fn tick_interval_ms(&self) -> u64 {
        (500.0 / self.multiplier()) as u64
    }

    pub fn from_str(s: &str) -> Self {
        match s {
            "fast" | "2x" => Self::Fast,
            "very_fast" | "10x" => Self::VeryFast,
            _ => Self::Normal,
        }
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Normal => "1x",
            Self::Fast => "2x",
            Self::VeryFast => "10x",
        }
    }
}

/// Simulation configuration — fully dynamic, no hardcoded node count.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SimulationConfig {
    /// Number of nodes to create
    pub node_count: usize,
    /// Base port for node binding
    pub base_port: u16,
    /// Topology type
    pub topology_type: String,
    /// WebSocket server port
    pub ws_port: u16,
    /// Initial simulation speed
    pub speed: SimulationSpeed,
    /// Base traffic rate: packets generated per tick per sender node
    pub base_traffic_rate: u32,
}

impl Default for SimulationConfig {
    fn default() -> Self {
        Self {
            node_count: 5,
            base_port: 5001,
            topology_type: "full_mesh".to_string(),
            ws_port: 9001,
            speed: SimulationSpeed::Normal,
            base_traffic_rate: 3,
        }
    }
}
