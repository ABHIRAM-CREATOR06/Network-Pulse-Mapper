use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{broadcast, RwLock};
use warp::Filter;
use futures_util::{StreamExt, SinkExt};
use serde::{Deserialize, Serialize};

use crate::packet::NodeId;
use crate::scenario::{Scenario, ScenarioType};
use crate::scheduler::SimulationSpeed;

/// Commands the UI can send to the backend.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "command")]
pub enum UICommand {
    #[serde(rename = "inject_scenario")]
    InjectScenario {
        scenario_type: String,
        source_node: NodeId,
        target_nodes: Vec<NodeId>,
        intensity: u32,
        duration_ticks: u32,
    },
    #[serde(rename = "set_speed")]
    SetSpeed { speed: String },
    #[serde(rename = "set_routing_strategy")]
    SetRoutingStrategy { strategy: String, node_id: Option<NodeId> },
    #[serde(rename = "update_link")]
    UpdateLink {
        from: NodeId,
        to: NodeId,
        latency_ms: Option<f64>,
        jitter_ms: Option<f64>,
        loss_rate: Option<f64>,
        bandwidth_bps: Option<u64>,
    },
    #[serde(rename = "add_node")]
    AddNode { node_id: NodeId, port: u16, role: String },
    #[serde(rename = "remove_node")]
    RemoveNode { node_id: NodeId },
    #[serde(rename = "get_config")]
    GetConfig,
}

/// Shared state between the WS server and the simulation loop.
pub struct SharedState {
    pub command_tx: broadcast::Sender<UICommand>,
    pub telemetry_tx: broadcast::Sender<String>,
}

impl SharedState {
    pub fn new() -> Self {
        let (telemetry_tx, _) = broadcast::channel(256);
        let (command_tx, _) = broadcast::channel(64);
        Self {
            command_tx,
            telemetry_tx,
        }
    }
}

/// Start the WebSocket server on the given port.
pub async fn start_ws_server(state: Arc<RwLock<SharedState>>, port: u16) {
    let state_filter = warp::any().map(move || state.clone());

    // CORS support for the React dev server
    let cors = warp::cors()
        .allow_any_origin()
        .allow_methods(vec!["GET", "POST", "OPTIONS"])
        .allow_headers(vec!["Content-Type"]);

    let ws_route = warp::path("ws")
        .and(warp::ws())
        .and(state_filter)
        .map(|ws: warp::ws::Ws, state: Arc<RwLock<SharedState>>| {
            ws.on_upgrade(move |socket| handle_connection(socket, state))
        })
        .with(cors);

    println!("🌐 WebSocket server listening on ws://127.0.0.1:{}/ws", port);
    warp::serve(ws_route).run(([127, 0, 0, 1], port)).await;
}

async fn handle_connection(ws: warp::ws::WebSocket, state: Arc<RwLock<SharedState>>) {
    let (mut ws_tx, mut ws_rx) = ws.split();

    // Subscribe to telemetry broadcast
    let mut telemetry_rx = {
        let s = state.read().await;
        s.telemetry_tx.subscribe()
    };

    // Get command sender
    let command_tx = {
        let s = state.read().await;
        s.command_tx.clone()
    };

    println!("📡 Client connected");

    // Spawn a task to forward telemetry to this client
    let send_task = tokio::spawn(async move {
        while let Ok(msg) = telemetry_rx.recv().await {
            if ws_tx.send(warp::ws::Message::text(msg)).await.is_err() {
                break;
            }
        }
    });

    // Process incoming commands from this client
    while let Some(result) = ws_rx.next().await {
        match result {
            Ok(msg) => {
                if let Ok(text) = msg.to_str() {
                    match serde_json::from_str::<UICommand>(text) {
                        Ok(cmd) => {
                            let _ = command_tx.send(cmd);
                        }
                        Err(e) => {
                            eprintln!("⚠️  Invalid command: {}", e);
                        }
                    }
                }
            }
            Err(e) => {
                eprintln!("⚠️  WebSocket error: {}", e);
                break;
            }
        }
    }

    println!("📡 Client disconnected");
    send_task.abort();
}
