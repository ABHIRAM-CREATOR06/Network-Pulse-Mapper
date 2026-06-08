<div align="center">

```
                                                                                      
▄▄▄▄▄▄▄   ▄▄▄  ▄▄▄ ▄▄▄       ▄▄▄▄▄▄▄  ▄▄▄▄▄▄▄    ▄▄▄▄▄▄▄ ▄▄▄   ▄▄▄   ▄▄▄▄   ▄▄▄▄▄▄▄▄▄ 
███▀▀███▄ ███  ███ ███      █████▀▀▀ ███▀▀▀▀▀   ███▀▀▀▀▀ ███   ███ ▄██▀▀██▄ ▀▀▀███▀▀▀ 
███▄▄███▀ ███  ███ ███       ▀████▄  ███▄▄      ███      █████████ ███  ███    ███    
███▀▀▀▀   ███▄▄███ ███         ▀████ ███        ███      ███▀▀▀███ ███▀▀███    ███    
███       ▀██████▀ ████████ ███████▀ ▀███████   ▀███████ ███   ███ ███  ███    ███    

                                           THE NETWORK MAPPER AND CONGESTION FORECASTING TOOL                                                                                    
                                                                                      
```

**A telecom-grade network simulation engine that models congestion as a propagating wave — not a static dashboard.**

[![Rust](https://img.shields.io/badge/rust-1.78%2B-orange?style=flat-square&logo=rust)](https://www.rust-lang.org/)
[![Tokio](https://img.shields.io/badge/async-tokio-blue?style=flat-square)](https://tokio.rs/)
[![React](https://img.shields.io/badge/ui-react%2019-61dafb?style=flat-square&logo=react)](https://react.dev/)
[![D3.js](https://img.shields.io/badge/viz-d3.js%20v7-f9a03c?style=flat-square)](https://d3js.org/)
[![License](https://img.shields.io/badge/status-active-blue?style=flat-square)]()

</div>

---

## What Is PulseCast?

Most network monitors show you a table of metrics. PulseCast shows you something different: **congestion as a wave**.

Inspired by seismic propagation and weather diffusion models, PulseCast treats network congestion not as an instantaneous state but as a pressure system — building at overloaded nodes, radiating outward through links, cascading across topology. You see it move. You see it before it arrives.

The platform has three interlocking subsystems:

| Subsystem | Description |
|---|---|
| **Simulation Core** | Rust/Tokio engine running virtual nodes on simulated localhost links, with configurable queues, link conditions, and packet routing |
| **Pulse Visualization** | React + D3.js + Canvas frontend rendering topology graphs, radial congestion pulses, and forecasting heatmaps |
| **Forecast Engine** | Diffusion-based congestion scoring that propagates predicted load across the node graph seconds before it happens |

All simulation is **localhost-only**. No external network traffic. No ML model required.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     PulseCast UI                        │
│   Topology │ Pulse │ Forecast │ Timeline │ Learn        │
│   (D3 force graph · Canvas pulse rings · D3 timeline)  │
└───────────────────────────┬─────────────────────────────┘
                            │ WebSocket (ws://127.0.0.1:9001/ws)
┌───────────────────────────▼─────────────────────────────┐
│        Forecasting & Routing Engines (Rust)            │
│   ForecastEngine (diffusion) · CongestionMemory ·      │
│   MetricsEngine (sliding windows, congestion duration) │
└───────────────────────────┬─────────────────────────────┘
                            │ Tokio mpsc / broadcast channels
┌───────────────────────────▼─────────────────────────────┐
│               Network Simulation Core                   │
│   Scenario Engine · Node Drain/Fwd · Router · Packets  │
└───────────────────────────┬─────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────┐
│                  Virtual Node Layer                     │
│       Default 5 nodes (A–E), full-mesh topology         │
└───────────────────────────┬─────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────┐
│             Simulated Communication Layer               │
│     Configurable: Latency │ Jitter │ Loss │ Bandwidth   │
└─────────────────────────────────────────────────────────┘
```

The simulation core (`pulsecast-core`) is a Rust binary that boots a configurable number of virtual nodes, connects them in a chosen topology, and runs a tick-based simulation loop (500ms / tick at 1× speed). It emits real-time telemetry over WebSocket. The frontend (`pulsecast-ui`) connects to that stream and renders the network state live.

---

## Repository Layout

```
Network-Pulse-Mapper/
├── pulsecast-core/              # Rust simulation engine
│   ├── Cargo.toml
│   └── src/
│       ├── main.rs              # Simulation loop, orchestration
│       ├── node.rs              # NodeState, queue management, telemetry
│       ├── packet.rs            # Packet struct, NodeId
│       ├── link.rs              # LinkCondition, Topology, latency/jitter math
│       ├── router.rs            # Routing strategies (Dijkstra variants)
│       ├── forecast.rs          # Diffusion-based congestion forecasting
│       ├── scenario.rs          # Traffic injection scenarios
│       ├── scheduler.rs         # SimulationConfig, SimulationSpeed
│       ├── metrics.rs           # MetricsEngine and MetricsSnapshot
│       └── ws_server.rs         # WebSocket server (warp), UICommand parsing
│
├── pulsecast-ui/                # React + TypeScript + Vite frontend
│   ├── package.json
│   ├── vite.config.ts
│   └── src/
│       ├── App.tsx              # View tabs, layout
│       ├── main.tsx             # React entry
│       ├── index.css            # IBM Carbon design tokens
│       ├── components/
│       │   ├── Header.tsx       # Live status bar
│       │   ├── ControlPanel.tsx # Speed, routing, scenarios, add/remove
│       │   ├── TopologyView.tsx # D3 force-directed graph
│       │   ├── PulseView.tsx    # Canvas radial pulse rings (60fps)
│       │   ├── ForecastHeatmap.tsx
│       │   ├── Timeline.tsx     # D3 multi-node line chart
│       │   ├── NodeList.tsx     # Mini node cards (live)
│       │   ├── NodeCard.tsx     # Full per-node card
│       │   └── LearnView.tsx    # Scenario / view explainer
│       ├── hooks/
│       │   └── useWebSocket.ts  # Auto-reconnect + 100ms event batching
│       ├── store/
│       │   └── simulationStore.ts  # Zustand store
│       └── utils/
│           ├── types.ts         # WS protocol types
│           └── colors.ts        # Carbon-mapped congestion palette
│
├── architecture.md              # Full system specification
├── design.md                    # IBM Carbon-inspired design system
├── setup-dev.bat                # Windows helper: build + run both services
└── README.md                    # This file
```

---

## Technology Stack

| Layer | Technology | Notes |
|---|---|---|
| Simulation core | **Rust + Tokio** | Async runtime, non-blocking tick loop |
| Web transport | **warp 0.3** | WebSocket server with permissive CORS |
| Frontend framework | **React 19 + TypeScript 6** | Vite 8, HMR for dev |
| State management | **Zustand 5** | Single store, no Redux |
| Graph / timeline | **D3.js v7** | Force simulation, line charts, axes |
| Pulse animation | **Canvas 2D** | 60fps `requestAnimationFrame` radial rings |
| Backend ↔ Frontend | **WebSocket** | Single JSON stream + command channel |
| Build tooling | **Vite 8** | Dev server, production builds |
| Optional shell | **Tauri** | Cross-platform desktop wrapper (planned) |

---

## Core Concepts

### Virtual Nodes

Each node runs as a Tokio task and maintains independent state with a packet queue, drain rate, routing strategy, and a rolling congestion history. Nodes can be assigned roles — `Sender`, `Receiver`, `Router`, or `CongestionSource` — and each maintains a packet queue with configurable depth and drain rate. Queue occupancy is the primary signal for congestion detection and forecasting.

### Simulated Link Conditions

Every link between nodes is independently configurable:

| Parameter | Default | Description |
|---|---|---|
| `latency_ms` | 10ms | Base one-way propagation delay |
| `jitter_ms` | ±2ms | Random variation on latency per packet |
| `loss_rate` | 0.01 | Probability of silent packet drop |
| `bandwidth_bps` | 1 Mbps | Maximum throughput cap |
| `congestion_threshold` | 0.75 | Queue occupancy fraction that triggers congestion state |

Links compute **effective loss rate** dynamically: `loss_rate + congestion_factor × 0.3`, where congestion factor is derived from endpoint occupancies. Under load, links degrade — just like real ones.

### Congestion Forecast Engine

The forecast engine models congestion propagation as a **diffusion process across the node graph**:

```
forecast[node][t+1] = α × current_load[node]
                    + (1 - α) × Σ (neighbor_forecast[n][t] × link_weight[n→node])
```

Where `α = 0.3` (smoothing factor) and propagation iterates for `N = 3` hops per tick. This produces a **Congestion Risk Score** (0.0–1.0) per node, projected 10 seconds forward, updated every simulation tick.

The engine also tracks **prediction accuracy** over time by comparing forecast scores against actual occupancies — a live MAE measurement is available to evaluate forecast quality.

### Routing Strategies

Routing is **runtime-swappable** for all nodes or a single node without restarting the simulation:

| Strategy (UI label) | Identifier | Description |
|---|---|---|
| Shortest Path | `shortest_path` | Static hop-count minimization via Dijkstra |
| Congestion Aware | `congestion_aware` | Weights paths by current queue occupancy |
| Predictive Reroute | `predictive_reroute` | Avoids nodes with high forecast risk scores |
| Memory Based | `memory_based` | Avoids historically congested nodes with exponential decay |

### Traffic Injection Scenarios

Test network behavior under adversarial conditions — each scenario is parameterized with source node, target nodes, intensity, and duration in ticks:

| Scenario | Description |
|---|---|
| `burst` | Sudden packet spike from a single source node |
| `storm` | Synchronized flood from multiple nodes simultaneously |
| `link_fail` | Drop a link to `loss_rate = 1.0` |
| `node_overload` | Fill a node's queue to capacity |
| `cascade` | Chain congestion propagation outward from one node |
| `bandwidth_collapse` | Sudden bandwidth reduction on a link |
| `latency_spike` | Inject a latency surge on targeted links |
| `random_drops` | Stochastic packet loss injection across the network |

---

## WebSocket Event Protocol

The backend emits a single JSON stream on `ws://127.0.0.1:9001/ws`. All frontend views subscribe to this stream; the frontend re-batches messages every 100ms to keep render cost low.

**Node telemetry** — emitted every tick per node:
```json
{
  "type": "node_telemetry",
  "timestamp": 1718000000.123,
  "node_id": "A",
  "queue_depth": 320,
  "queue_capacity": 500,
  "packets_sent": 10420,
  "packets_dropped": 34,
  "latency_ms": 18.4,
  "occupancy": 0.64,
  "role": "router",
  "routing_strategy": "shortest_path",
  "retransmit_count": 2,
  "throughput_bps": 184320,
  "congestion_level": 0.64
}
```

**Congestion forecast** — emitted every tick, all nodes:
```json
{
  "type": "congestion_forecast",
  "timestamp": 1718000000.123,
  "horizon_seconds": 10,
  "scores": { "A": 0.21, "B": 0.87, "C": 0.63, "D": 0.09, "E": 0.44 },
  "propagation_etas": { "B": 1.5, "C": 3.0 }
}
```

**Packet events** — emitted per packet lifecycle event (`created`, `forwarded`, `delivered`, `dropped`, `retransmitted`):
```json
{
  "type": "packet_event",
  "packet_id": "pkt-00421",
  "event": "dropped",
  "node_id": "B",
  "timestamp": 1718000000.456
}
```

**Topology updates** — emitted every 10 ticks with link utilization:
```json
{
  "type": "topology_update",
  "nodes": [{ "id": "A", "port": 5001, "role": "router", "occupancy": 0.64 }],
  "links": [{ "from": "A", "to": "B", "active": true, "utilization": 0.81, "latency_ms": 10.0, "loss_rate": 0.012 }]
}
```

**Metrics snapshots** — emitted every 10 ticks:
```json
{
  "type": "metrics_snapshot",
  "timestamp": 1718000000.123,
  "packet_loss_rate": 0.03,
  "throughput_bps": 824320,
  "avg_latency_ms": 14.2,
  "avg_queue_occupancy": 0.42,
  "congestion_duration_avg": 3.5,
  "total_packets_created": 50000,
  "total_packets_delivered": 48500,
  "total_packets_dropped": 1500,
  "delivery_success_rate": 0.97,
  "reroute_count": 112
}
```

The frontend can also **send commands** back to the simulation:

```json
{ "command": "inject_scenario", "scenario_type": "burst", "source_node": "B", "target_nodes": [], "intensity": 50, "duration_ticks": 20 }
{ "command": "set_speed", "speed": "fast" }
{ "command": "set_traffic_enabled", "enabled": false }
{ "command": "set_routing_strategy", "strategy": "predictive_reroute", "node_id": null }
{ "command": "update_link", "from": "A", "to": "C", "loss_rate": 0.5 }
{ "command": "add_node", "node_id": "F", "port": 5006, "role": "sender" }
{ "command": "remove_node", "node_id": "F" }
{ "command": "reset_simulation" }
```

---

## Getting Started

### Prerequisites

- **Rust** 1.78+ with Cargo ([install](https://rustup.rs/))
- **Node.js** 20+ with npm ([install](https://nodejs.org/))

### Option A — One-shot launcher (Windows)

```bash
setup-dev.bat
```

This installs frontend deps if needed, then opens the backend in a new window and runs the Vite dev server in the current terminal. Frontend URL is shown when Vite starts (usually `http://localhost:5173`); backend is at `ws://127.0.0.1:9001/ws`.

### Option B — Manual launch

**Terminal 1 — simulation core:**
```bash
cd pulsecast-core
cargo run
```

The simulation boots with 5 nodes in full-mesh topology at 1× speed. You'll see:
```
╔══════════════════════════════════════════╗
║         PulseCast Simulation Core        ║
║   Network Pulse Mapper & Forecaster      ║
╚══════════════════════════════════════════╝
🔧 Config: 5 nodes, topology=full_mesh, speed=1x
🖧  Nodes: ["A", "B", "C", "D", "E"]
🌐 WebSocket server listening on ws://127.0.0.1:9001/ws
📊 Tick 0 | Queued: 0 | Dropped: 0 | Scenarios: 0
```

**Terminal 2 — UI:**
```bash
cd pulsecast-ui
npm install
npm run dev
```

Then open `http://localhost:5173`. The UI connects automatically to the simulation WebSocket and reconnects with exponential backoff (1s → 15s cap) if the backend drops.

---

## Simulation Configuration

The default configuration boots 5 nodes in full-mesh topology at 1× speed. This is defined in `pulsecast-core/src/scheduler.rs`:

```rust
SimulationConfig {
    node_count: 5,
    base_port: 5001,
    topology_type: "full_mesh",  // also: "ring", "star", "tree"
    ws_port: 9001,
    speed: SimulationSpeed::Normal,  // Normal (1x), Fast (2x), VeryFast (10x)
    base_traffic_rate: 3,            // packets generated per tick per sender
}
```

Simulation speed, traffic on/off, routing strategy, link conditions, and the node set are all runtime-adjustable from the UI's Control Panel — no restart required. The tick interval scales proportionally: 500ms at 1×, 250ms at 2×, 50ms at 10×.

---

## UI Views

The frontend exposes five views, switched via the top tab bar:

| View | Implementation | What it shows |
|---|---|---|
| **Topology** | D3 force simulation | Draggable nodes, active links, occupancy color, mini-cards below |
| **Pulse** | Canvas 2D, `requestAnimationFrame` | Radial pulse rings emitted from congested nodes and dropped packets |
| **Forecast** | SVG overlay | Per-node fill intensity = predicted congestion risk (T+10s) |
| **Timeline** | D3 line chart | Rolling 120-tick queue occupancy per node, congestion threshold line |
| **Learn** | Static page | Plain-language reference for scenarios and views |

The Header shows live status: connection dot, node count, packets sent, packets dropped, current speed.

---

## Development Status

PulseCast is a **functional MVP**. The simulation core, the full WebSocket protocol, the forecast engine, all four routing strategies, all eight scenarios, and all five UI views are working end-to-end. Some advanced features and packaging remain.

### ✅ Complete

**Simulation Core (`pulsecast-core`)**
- Virtual node state management with packet queues and drain mechanics
- Full-mesh, ring, star, and tree topology initialization
- Per-link configurable conditions: latency, jitter, loss rate, bandwidth
- Dynamic effective loss rate under congestion
- Packet lifecycle: creation, routing, in-flight with latency, delivery, drop
- Retransmission queue with configurable delay and max attempts
- Four routing strategies: ShortestPath, CongestionAware, PredictiveReroute, MemoryBased
- Exponential-decay congestion memory for MemoryBased routing
- Diffusion-based congestion forecast engine with accuracy logging and propagation ETAs
- All 8 traffic injection scenarios (burst, storm, link_fail, node_overload, cascade, bandwidth_collapse, latency_spike, random_drops)
- MetricsEngine: packet loss rate, throughput, latency, delivery success rate, reroute count, congestion duration tracking, queue occupancy average
- WebSocket server (warp) with JSON telemetry stream and full command channel
- Bidirectional protocol: scenario injection, speed control, traffic enable/disable, routing strategy (per-node or global), link mutation, node add/remove, reset
- Runtime-configurable simulation speed (1× / 2× / 10×)
- Periodic topology and metrics broadcast (every 10 ticks)

**Frontend (`pulsecast-ui`)**
- IBM Carbon design system (Plex Sans, Plex Mono, square geometry, single blue accent)
- Zustand store with node telemetry, forecast, topology, packet events, rolling timelines
- WebSocket client with auto-reconnect (exponential backoff) and 100ms event batching
- Header with live status (connection, node count, sent/dropped totals, speed)
- D3 force-directed topology graph with drag, manual/auto layout, fit-to-viewport
- Canvas-based 60fps pulse wave animation tied to live congestion
- Forecast heatmap overlay (semi-transparent Carbon-mapped colors)
- Multi-node D3 timeline with rolling 120-tick window and congestion threshold line
- Control panel: speed toggle, traffic start/stop, routing strategy dropdown, scenario buttons, node add/remove with role and port
- Node list with live mini-cards (occupancy bar, queue depth, role)
- Learn view with plain-language scenario and view reference

### 🚧 In Progress

- Forecast accuracy dashboard view (the engine already logs MAE; surfacing it in the UI is next)
- Link condition editor in the UI (backend `update_link` command already exists)

### 📋 Planned

- Tauri desktop shell wrapper
- ratatui TUI mode
- Side-by-side routing strategy comparison view
- Scenario replay and recording
- Telemetry export to JSON/CSV
- Forecast MAE dashboard visualization

---

## Development Roadmap

```
Phase 1 — Simulation Core          ████████████████████  ✅ Done
Phase 2 — Visualization            ██████████████████░░  ✅ Core views done
Phase 3 — Forecasting Engine       ██████████████████░░  ✅ Engine done / accuracy view pending
Phase 4 — Routing Experiments      ████████████████░░░░  ✅ Strategies done / comparison view pending
Phase 5 — Traffic Injection & CLI  ██████████████████░░  ✅ Backend & UI done / export pending
```

The detailed phase definitions and progression live in `architecture.md`.

---

## Contributing

This is an exploratory project. The ground-truth documents are `architecture.md` (full system spec) and `design.md` (UI design system). Both are kept in sync with the current implementation.

If you're picking up a new feature, the WebSocket event protocol above is the contract. The simulation core is running and emitting live data — most new work is either (a) a new view that consumes existing events, or (b) a new backend module exposed through a new `UICommand` variant.

The design system in `design.md` is IBM Carbon-inspired: flat geometry, IBM Plex Sans typography, single blue accent, engineering restraint. The congestion palette is Carbon-mapped: `#e0e0e0` idle → `#8a3ffc` purple → `#0f62fe` blue → `#ff832b` orange → `#da1e28` red, with semi-transparent overlays for forecast risk.

---

## Design Philosophy

> *"Network congestion is not a number. It's a pressure front."*

The insight behind PulseCast is that congestion behaves more like a physical phenomenon than a metric. It builds gradually, propagates through connected systems, and collapses under its own weight. A table of queue depths doesn't show you this. A wave does.

The forecast model treats the node graph as a medium through which congestion diffuses — weighted by link bandwidth and loss rate, smoothed by exponential averaging, projected forward in time. The result isn't a prediction in the neural-network sense. It's a physics-inspired extrapolation: where is the pressure going?

The routing strategies exist to test whether network intelligence can stay ahead of that wave. Shortest-path routing is blind to it. Congestion-aware routing reacts to it. Predictive rerouting tries to dodge it before it arrives.

That's the experiment PulseCast is designed to run.

---

<div align="center">

**Built with Rust, Tokio, React, D3.js · Localhost-only · No ML required**

*MVP — contributions welcome*

</div>
