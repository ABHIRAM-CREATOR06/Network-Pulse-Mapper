mod packet;
mod link;
mod node;
mod router;
mod forecast;
mod scenario;
mod scheduler;
mod ws_server;


use std::sync::Arc;
use tokio::sync::RwLock;
use tokio::time::{self, Duration};
use rand::Rng;

use crate::forecast::ForecastEngine;
use crate::link::Topology;
use crate::node::{default_node_configs, NodeRole, NodeState};
use crate::packet::{Packet, PacketEvent, NodeId};
use crate::router::{CongestionMemory, Router, RoutingStrategyType};
use crate::scenario::{Scenario, ScenarioEngine};
use crate::scheduler::{SimulationConfig, SimulationSpeed};
use crate::ws_server::{SharedState, UICommand, start_ws_server};

#[tokio::main]
async fn main() {
    println!("╔══════════════════════════════════════════╗");
    println!("║         PulseCast Simulation Core        ║");
    println!("║   Network Pulse Mapper & Forecaster      ║");
    println!("╚══════════════════════════════════════════╝");

    let config = SimulationConfig::default();
    println!("🔧 Config: {} nodes, topology={}, speed={}",
        config.node_count, config.topology_type, config.speed.as_str());

    // Initialize shared state for WebSocket communication
    let shared_state = Arc::new(RwLock::new(SharedState::new()));

    // Start WebSocket server in background
    let ws_state = shared_state.clone();
    let ws_port = config.ws_port;
    tokio::spawn(async move {
        start_ws_server(ws_state, ws_port).await;
    });

    // Give the WS server a moment to bind
    time::sleep(Duration::from_millis(100)).await;

    // Initialize nodes dynamically
    let node_configs = default_node_configs(config.node_count, config.base_port);
    let mut nodes: Vec<NodeState> = node_configs.iter().map(|c| c.to_node_state()).collect();
    let node_ids: Vec<NodeId> = nodes.iter().map(|n| n.id.clone()).collect();

    println!("🖧  Nodes: {:?}", node_ids);

    // Initialize topology
    let mut topology = match config.topology_type.as_str() {
        "ring" => Topology::ring(&node_ids),
        _ => Topology::full_mesh(&node_ids),
    };

    // Initialize engines
    let mut forecast_engine = ForecastEngine::new();
    let mut scenario_engine = ScenarioEngine::new();
    let mut congestion_memory = CongestionMemory::new(0.95);

    // Subscribe to UI commands
    let mut command_rx = {
        let s = shared_state.read().await;
        s.command_tx.subscribe()
    };

    let mut speed = config.speed;
    let mut tick: u64 = 0;
    let base_traffic_rate = config.base_traffic_rate;

    println!("🚀 Simulation started (tick interval: {}ms)", speed.tick_interval_ms());

    loop {
        let tick_start = std::time::Instant::now();
        tick += 1;
        let timestamp = tick as f64 * 0.5; // each tick = 0.5s of sim time

        // --- Process UI Commands ---
        while let Ok(cmd) = command_rx.try_recv() {
            match cmd {
                UICommand::InjectScenario {
                    scenario_type, source_node, target_nodes, intensity, duration_ticks,
                } => {
                    let scenario = match scenario_type.as_str() {
                        "burst" => Scenario::burst(source_node, intensity, duration_ticks),
                        "storm" => Scenario::storm(
                            if target_nodes.is_empty() { node_ids.clone() } else { target_nodes },
                            intensity, duration_ticks,
                        ),
                        "link_fail" => Scenario::link_fail(
                            source_node,
                            target_nodes.first().cloned().unwrap_or_default(),
                            duration_ticks,
                        ),
                        "node_overload" => Scenario::node_overload(source_node),
                        "cascade" => Scenario::cascade(source_node, intensity, duration_ticks),
                        _ => continue,
                    };
                    println!("⚡ Injected scenario: {:?}", scenario.scenario_type);
                    scenario_engine.inject(scenario);
                }
                UICommand::SetSpeed { speed: s } => {
                    speed = SimulationSpeed::from_str(&s);
                    println!("⏱️  Speed set to {}", speed.as_str());
                }
                UICommand::SetRoutingStrategy { strategy, node_id } => {
                    let strat = strategy.clone();
                    if let Some(nid) = node_id {
                        if let Some(node) = nodes.iter_mut().find(|n| n.id == nid) {
                            node.routing_strategy = strat;
                        }
                    } else {
                        for node in &mut nodes {
                            node.routing_strategy = strat.clone();
                        }
                    }
                    println!("🔀 Routing strategy set to {}", strategy);
                }
                UICommand::UpdateLink { from, to, latency_ms, jitter_ms, loss_rate, bandwidth_bps } => {
                    if let Some(link) = topology.get_link_mut(&from, &to) {
                        if let Some(v) = latency_ms { link.latency_ms = v; }
                        if let Some(v) = jitter_ms { link.jitter_ms = v; }
                        if let Some(v) = loss_rate { link.loss_rate = v; }
                        if let Some(v) = bandwidth_bps { link.bandwidth_bps = v; }
                    }
                }
                UICommand::AddNode { node_id, port, role } => {
                    let role_enum = match role.as_str() {
                        "sender" => NodeRole::Sender,
                        "receiver" => NodeRole::Receiver,
                        "congestion_source" => NodeRole::CongestionSource,
                        _ => NodeRole::Router,
                    };
                    let new_node = NodeState::new(node_id.clone(), port, role_enum);
                    // Add links to/from all existing nodes
                    for existing in &nodes {
                        topology.links.push(crate::link::LinkCondition::new(
                            node_id.clone(), existing.id.clone(),
                        ));
                        topology.links.push(crate::link::LinkCondition::new(
                            existing.id.clone(), node_id.clone(),
                        ));
                    }
                    nodes.push(new_node);
                    println!("➕ Added node {}", node_id);
                }
                UICommand::RemoveNode { node_id } => {
                    nodes.retain(|n| n.id != node_id);
                    topology.links.retain(|l| l.from != node_id && l.to != node_id);
                    println!("➖ Removed node {}", node_id);
                }
                UICommand::GetConfig => {}
            }
        }

        // --- Apply Scenarios ---
        let scenario_packets = scenario_engine.apply_tick(&mut nodes, &mut topology, tick);

        // --- Generate Base Traffic ---
        let mut rng = rand::thread_rng();
        let mut all_new_packets: Vec<Packet> = scenario_packets;
        let current_node_ids: Vec<NodeId> = nodes.iter().map(|n| n.id.clone()).collect();

        for node in &nodes {
            if matches!(node.role, NodeRole::Sender | NodeRole::CongestionSource) {
                let rate = if matches!(node.role, NodeRole::CongestionSource) {
                    base_traffic_rate * 5
                } else {
                    base_traffic_rate
                };
                for _ in 0..rate {
                    let dest_idx = rng.gen_range(0..current_node_ids.len());
                    if current_node_ids[dest_idx] != node.id {
                        all_new_packets.push(Packet::new(
                            node.id.clone(),
                            current_node_ids[dest_idx].clone(),
                            rng.gen_range(64..1500),
                            rng.gen_range(0..4),
                            tick,
                        ));
                    }
                }
            }
        }

        // --- Enqueue New Packets at Source Nodes ---
        let mut packet_events: Vec<serde_json::Value> = Vec::new();
        for pkt in all_new_packets {
            let source_id = pkt.source.clone();
            if let Some(node) = nodes.iter_mut().find(|n| n.id == source_id) {
                if let Some(drop_event) = node.enqueue(pkt, timestamp) {
                    packet_events.push(serde_json::json!({
                        "type": "packet_event",
                        "packet_id": match &drop_event { PacketEvent::Dropped { packet_id, .. } => packet_id.clone(), _ => String::new() },
                        "event": "dropped",
                        "node_id": source_id,
                        "timestamp": timestamp
                    }));
                }
            }
        }

        // --- Process Nodes: Drain & Forward ---
        // Collect forwarding decisions first to avoid borrow issues
        let mut forward_queue: Vec<(NodeId, Packet)> = Vec::new();

        for node in &mut nodes {
            node.reset_tick();
            let drained = node.drain();
            for mut pkt in drained {
                if pkt.has_arrived() || pkt.destination == node.id {
                    node.packets_sent += 1;
                    packet_events.push(serde_json::json!({
                        "type": "packet_event",
                        "packet_id": pkt.id,
                        "event": "delivered",
                        "node_id": node.id,
                        "timestamp": timestamp
                    }));
                    continue;
                }

                if !pkt.record_hop(&node.id) {
                    node.packets_dropped += 1;
                    packet_events.push(serde_json::json!({
                        "type": "packet_event",
                        "packet_id": pkt.id,
                        "event": "dropped",
                        "node_id": node.id,
                        "timestamp": timestamp
                    }));
                    continue;
                }

                let _strategy = RoutingStrategyType::from_str(&node.routing_strategy);
                // We'll resolve routing after this loop
                node.packets_sent += 1;
                node.bytes_forwarded_this_tick += pkt.size_bytes as u64;
                forward_queue.push((node.id.clone(), pkt));
            }
            node.record_occupancy();
        }

        // Resolve routing and enqueue at next-hop nodes
        for (from_id, pkt) in forward_queue {
            let strategy_str = nodes.iter()
                .find(|n| n.id == from_id)
                .map(|n| n.routing_strategy.clone())
                .unwrap_or_else(|| "shortest_path".to_string());
            let strategy = RoutingStrategyType::from_str(&strategy_str);

            let next = Router::next_hop(
                &from_id,
                &pkt.destination,
                &strategy,
                &topology,
                &nodes,
                &forecast_engine.scores,
                &congestion_memory.scores,
            );

            if let Some(next_node_id) = next {
                // Check link conditions
                let should_drop = topology
                    .get_link(&from_id, &next_node_id)
                    .map(|l| l.should_drop())
                    .unwrap_or(false);

                if should_drop {
                    packet_events.push(serde_json::json!({
                        "type": "packet_event",
                        "packet_id": pkt.id,
                        "event": "dropped",
                        "node_id": from_id,
                        "timestamp": timestamp
                    }));
                } else {
                    // Simulate latency (simplified: just enqueue at destination)
                    if let Some(dest_node) = nodes.iter_mut().find(|n| n.id == next_node_id) {
                        if let Some(drop_event) = dest_node.enqueue(pkt, timestamp) {
                            packet_events.push(serde_json::json!({
                                "type": "packet_event",
                                "packet_id": match &drop_event {
                                    PacketEvent::Dropped { packet_id, .. } => packet_id.clone(),
                                    _ => String::new()
                                },
                                "event": "dropped",
                                "node_id": next_node_id,
                                "timestamp": timestamp
                            }));
                        }
                    }
                }
            } else {
                // No route found — drop
                packet_events.push(serde_json::json!({
                    "type": "packet_event",
                    "packet_id": pkt.id,
                    "event": "dropped",
                    "node_id": from_id,
                    "timestamp": timestamp
                }));
            }
        }

        // --- Update Congestion Memory ---
        for node in &nodes {
            if node.occupancy() > 0.75 {
                congestion_memory.record_congestion(&node.id, node.occupancy());
            }
        }
        congestion_memory.decay();

        // --- Compute Forecast ---
        let forecast = forecast_engine.compute(&nodes, &topology, timestamp);

        // --- Emit Telemetry ---
        {
            let state = shared_state.read().await;

            // Emit per-node telemetry
            for node in &nodes {
                let telemetry = node.telemetry(timestamp);
                if let Ok(json) = serde_json::to_string(&telemetry) {
                    let _ = state.telemetry_tx.send(json);
                }
            }

            // Emit forecast
            if let Ok(json) = serde_json::to_string(&forecast) {
                let _ = state.telemetry_tx.send(json);
            }

            // Emit packet events (batch)
            for event in &packet_events {
                if let Ok(json) = serde_json::to_string(event) {
                    let _ = state.telemetry_tx.send(json);
                }
            }

            // Emit topology info periodically (every 10 ticks)
            if tick % 10 == 0 {
                let topo_info = serde_json::json!({
                    "type": "topology_update",
                    "timestamp": timestamp,
                    "nodes": nodes.iter().map(|n| serde_json::json!({
                        "id": n.id,
                        "port": n.port,
                        "role": n.role,
                        "occupancy": n.occupancy(),
                    })).collect::<Vec<_>>(),
                    "links": topology.links.iter().map(|l| serde_json::json!({
                        "from": l.from,
                        "to": l.to,
                        "active": l.active,
                        "utilization": l.utilization,
                        "latency_ms": l.latency_ms,
                        "loss_rate": l.loss_rate,
                    })).collect::<Vec<_>>(),
                });
                if let Ok(json) = serde_json::to_string(&topo_info) {
                    let _ = state.telemetry_tx.send(json);
                }
            }
        }

        // --- Update Link Utilizations ---
        for node in &nodes {
            let neighbors = topology.neighbors(&node.id);
            let bytes_per_neighbor = if neighbors.is_empty() {
                0
            } else {
                node.bytes_forwarded_this_tick / neighbors.len() as u64
            };
            for neighbor in neighbors {
                topology.update_utilization(
                    &node.id,
                    &neighbor,
                    bytes_per_neighbor,
                    speed.tick_interval_ms() as f64,
                );
            }
        }

        // --- Tick Timing ---
        let elapsed = tick_start.elapsed();
        let target = Duration::from_millis(speed.tick_interval_ms());
        if elapsed < target {
            time::sleep(target - elapsed).await;
        }

        // Print status every 20 ticks
        if tick % 20 == 0 {
            let total_queued: usize = nodes.iter().map(|n| n.queue_depth).sum();
            let total_dropped: u64 = nodes.iter().map(|n| n.packets_dropped).sum();
            println!(
                "📊 Tick {} | Queued: {} | Dropped: {} | Scenarios: {}",
                tick, total_queued, total_dropped, scenario_engine.active_scenarios.len()
            );
        }
    }
}
