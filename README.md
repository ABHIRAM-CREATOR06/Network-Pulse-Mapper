<div align="center">

```
╔══════════════════════════════════════════════════════════════════╗
║                                                                  ║
║        ▄▄▄▄▄  ▄   ▄  ▄▄▄    ▄▄▄   ▄▄▄   ▄▄▄  ▄▄▄▄▄             ║
║        █   █  █   █  █  █  █      █     █   █   █               ║
║        █▄▄▄█  █   █  █  █  ▀▄▄▄   █▄▄▄  █▄▄▄   █               ║
║        █       █ █   █  █      █  █     █   █   █               ║
║        █        █    ▀▀▀   ▀▀▀▀   ▀▀▀▀  █   █   █               ║
║                                                                  ║
║          Network Pulse Mapper & Congestion Forecaster            ║
║                                                                  ║
╚══════════════════════════════════════════════════════════════════╝
```

**A telecom-grade network simulation engine that models congestion as a propagating wave — not a static dashboard.**

[![Rust](https://img.shields.io/badge/rust-1.78%2B-orange?style=flat-square&logo=rust)](https://www.rust-lang.org/)
[![Tokio](https://img.shields.io/badge/async-tokio-blue?style=flat-square)](https://tokio.rs/)
[![React](https://img.shields.io/badge/ui-react%2019-61dafb?style=flat-square&logo=react)](https://react.dev/)
[![D3.js](https://img.shields.io/badge/viz-d3.js%20v7-f9a03c?style=flat-square)](https://d3js.org/)
[![License](https://img.shields.io/badge/status-work%20in%20progress-yellow?style=flat-square)]()

</div>

---

## What Is PulseCast?

Most network monitors show you a table of metrics. PulseCast shows you something different: **congestion as a wave**.

Inspired by seismic propagation and weather diffusion models, PulseCast treats network congestion not as an instantaneous state but as a pressure system — building at overloaded nodes, radiating outward through links, cascading across topology. You see it move. You see it before it arrives.

The platform has three interlocking subsystems:

| Subsystem | Description |
|---|---|
| **Simulation Core** | Rust/Tokio engine running virtual nodes on localhost UDP, with configurable queues, links, and packet routing |
| **Pulse Visualization** | React + D3.js + WebGL frontend rendering topology graphs, radial congestion pulses, and forecasting heatmaps at 60fps |
| **Forecast Engine** | Diffusion-based congestion scoring that propagates predicted load across the node graph seconds before it happens |

All simulation is **localhost-only**. No external network traffic. No ML model required.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     PulseCast UI                        │
│        Heatmap View │ Pulse View │ Forecast View        │
└───────────────────────────┬─────────────────────────────┘
                            │ WebSocket (port 9001)
┌───────────────────────────▼─────────────────────────────┐
│              Forecasting & Analytics Engine             │
│       Congestion Prediction │ Routing Stability Score   │
└───────────────────────────┬─────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────┐
│               Network Simulation Core                   │
│        Packet Engine │ Queue Manager │ Scheduler        │
└───────────────────────────┬─────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────┐
│                  Virtual Node Layer                     │
│     Node A:5001 │ B:5002 │ C:5003 │ D:5004 │ E:5005    │
└───────────────────────────┬─────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────┐
│             Simulated Communication Layer               │
│     Configurable: Latency │ Jitter │ Loss │ Bandwidth   │
└─────────────────────────────────────────────────────────┘
```

The simulation core (`pulsecast-core`) is a Rust binary that boots a configurable number of virtual nodes, connects them in a chosen topology, and runs a tick-based simulation loop. It emits real-time telemetry over WebSocket. The frontend (`pulsecast-ui`) connects to that stream and renders the network state live.

---

## Repository Layout

```
Network-Pulse-Mapper/
├── pulsecast-core/          # Rust simulation engine
│   ├── Cargo.toml
│   └── src/
│       ├── main.rs          # Simulation loop, orchestration
│       ├── node.rs          # NodeState, queue management, telemetry
│       ├── packet.rs        # Packet struct, PacketEvent types
│       ├── link.rs          # LinkCondition, Topology, latency/jitter math
│       ├── router.rs        # Routing strategies (Dijkstra, congestion-aware, predictive)
│       ├── forecast.rs      # Diffusion-based congestion forecasting
│       ├── scenario.rs      # Traffic injection scenarios
│       ├── scheduler.rs     # SimulationConfig, SimulationSpeed
│       ├── metrics.rs       # Global metrics engine and snapshots
│       └── ws_server.rs     # WebSocket server, UICommand parsing
│
├── pulsecast-ui/            # React + TypeScript + Vite frontend
│   ├── package.json
│   ├── index.html
│   ├── vite.config.ts
│   └── src/                 # ⚠️ In progress — not yet implemented
│
├── model.md                 # Full system specification & development plan
├── design.md                # UI design system (IBM Carbon-inspired)
└── README.md                # This file
```

---

## Technology Stack

| Layer | Technology | Notes |
|---|---|---|
| Simulation core | **Rust + Tokio** | Async runtime, non-blocking tick loop |
| Transport simulation | **UDP sockets** | Simulating QUIC/TCP behavior on localhost |
| Frontend framework | **React 19 + TypeScript** | Zustand for state management |
| Graph visualization | **D3.js v7** | Topology graph, timeline sparklines |
| Pulse animation | **WebGL / Canvas** | 60fps radial wave rendering |
| Backend ↔ Frontend | **WebSocket** | Single stream, JSON event protocol |
| Build tooling | **Vite 8** | HMR for UI development |
| Optional shell | **Tauri** | Cross-platform desktop wrapper (planned) |

---

## Core Concepts

### Virtual Nodes

Each node runs as a Tokio task and maintains independent state:

```rust
struct NodeState {
    id: NodeId,
    port: u16,
    queue_depth: usize,
    queue_capacity: usize,
    packets_sent: u64,
    packets_dropped: u64,
    latency_ms: f64,
    routing_table: HashMap<NodeId, LinkWeight>,
    congestion_history: VecDeque<f64>,  // rolling window
}
```

Nodes can be assigned roles — `Sender`, `Receiver`, `Router`, or `CongestionSource` — and each maintains a packet queue with configurable depth and drain rate. Queue occupancy is the primary signal for congestion detection and forecasting.

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

The engine also tracks **prediction accuracy** over time by comparing forecast scores against actual occupancies — giving a live MAE measurement to evaluate forecast quality.

### Routing Strategies

Routing is **runtime-swappable** without restarting the simulation:

| Strategy | Description |
|---|---|
| `ShortestPath` | Static hop-count minimization via Dijkstra |
| `CongestionAware` | Weights paths by current queue occupancy |
| `PredictiveReroute` | Avoids nodes with high forecast risk scores |
| `MemoryBased` | Avoids historically congested links with exponential decay |

### Traffic Injection Scenarios

Test network behavior under adversarial conditions:

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

Each scenario is fully parameterized: source node, target nodes, intensity, and duration in ticks.

---

## WebSocket Event Protocol

The backend emits a single JSON stream on port `9001`. All frontend views subscribe to this stream.

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
  "latency_ms": 18.4
}
```

**Congestion forecast** — emitted every tick, all nodes:
```json
{
  "type": "congestion_forecast",
  "timestamp": 1718000000.123,
  "horizon_seconds": 10,
  "scores": { "A": 0.21, "B": 0.87, "C": 0.63, "D": 0.09, "E": 0.44 }
}
```

**Packet events** — emitted per packet lifecycle event:
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
  "nodes": [{ "id": "A", "occupancy": 0.64, "role": "router" }],
  "links": [{ "from": "A", "to": "B", "utilization": 0.81, "active": true }]
}
```

**Metrics snapshots** — emitted every 10 ticks:
```json
{
  "type": "metrics_snapshot",
  "packet_loss_rate": 0.03,
  "throughput_bps": 824320,
  "avg_latency_ms": 14.2,
  "delivery_success_rate": 0.97,
  "reroute_count": 112
}
```

The frontend can also **send commands** back to the simulation:

```json
{ "command": "inject_scenario", "scenario_type": "burst", "source_node": "B", "intensity": 50, "duration_ticks": 20 }
{ "command": "set_speed", "speed": "fast" }
{ "command": "set_routing_strategy", "strategy": "predictive_reroute", "node_id": null }
{ "command": "update_link", "from": "A", "to": "C", "loss_rate": 0.5 }
{ "command": "reset_simulation" }
```

---

## Getting Started

### Prerequisites

- **Rust** 1.78+ with Cargo ([install](https://rustup.rs/))
- **Node.js** 20+ with npm ([install](https://nodejs.org/))

### Run the Simulation Core

```bash
cd pulsecast-core
cargo build
cargo run
```

The simulation boots with 5 nodes in full-mesh topology at 1x speed. You'll see:

```
╔══════════════════════════════════════════╗
║         PulseCast Simulation Core        ║
║   Network Pulse Mapper & Forecaster      ║
╚══════════════════════════════════════════╝
🔧 Config: 5 nodes, topology=full_mesh, speed=1x
🖧  Nodes: ["A", "B", "C", "D", "E"]
📡 WebSocket server listening on ws://127.0.0.1:9001
📊 Tick 0 | Queued: 0 | Dropped: 0 | Scenarios: 0
```

### Run the UI

```bash
cd pulsecast-ui
npm install
npm run dev
```

Then open `http://localhost:5173`. The UI connects automatically to the simulation WebSocket.

> **Note:** The `pulsecast-ui/src/` directory is currently a stub. The UI is under active development — see [Development Status](#development-status) below.

---

## Simulation Configuration

The default configuration boots 5 nodes in full-mesh topology at 1x speed. This is defined in `src/scheduler.rs`:

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

Simulation speed is runtime-adjustable via WebSocket command. The tick interval scales proportionally: 500ms at 1x, 250ms at 2x, 50ms at 10x.

---

## Development Status

PulseCast is **unfinished, intentionally open work**. The simulation core is substantially complete. The frontend and some advanced features remain to be built.

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
- Diffusion-based congestion forecast engine with accuracy logging
- All 8 traffic injection scenarios (burst, storm, link_fail, node_overload, cascade, bandwidth_collapse, latency_spike, random_drops)
- MetricsEngine: packet loss rate, throughput, latency, delivery success rate, reroute count, congestion duration tracking
- WebSocket server with JSON telemetry stream (per-node, forecast, packet events, topology, metrics)
- Bidirectional WebSocket protocol: UICommand parsing for all scenario/config controls
- Runtime-configurable simulation speed (1x / 2x / 10x)
- Periodic topology and metrics broadcast (every 10 ticks)
- Node addition and removal via WebSocket command

### 🚧 In Progress

- `pulsecast-ui/src/` — React frontend (stub only; no components yet)
- D3.js topology graph with live edge animation
- Pulse wave renderer (Canvas/WebGL radial animation at 60fps)
- Forecast heatmap overlay
- Per-node timeline / sparklines (zoomable)
- UI controls for scenario injection and speed selection
- Link condition editor in the UI

### 📋 Planned

- Tauri desktop shell wrapper
- ratatui TUI mode
- Side-by-side routing strategy comparison view
- Scenario replay and recording
- Telemetry export to JSON/CSV
- Forecast accuracy dashboard
- Dark mode (IBM Carbon Gray-100 theme)

---

## Development Roadmap

The project follows a five-phase plan defined in `model.md`:

```
Phase 1 — Simulation Core          ████████████████████  ✅ Done
Phase 2 — Visualization            ░░░░░░░░░░░░░░░░░░░░  🚧 Starting
Phase 3 — Forecasting Engine       ████████████████░░░░  ✅ Core done / UI pending
Phase 4 — Routing Experiments      ████████████░░░░░░░░  ✅ Backend done / UI pending
Phase 5 — Traffic Injection & CLI  ████████████░░░░░░░░  ✅ Backend done / UI pending
```

---

## Contributing

This is an exploratory project — design documents are in `model.md` (full system spec) and `design.md` (UI design system). Both documents are the ground truth for what PulseCast is supposed to become.

If you're picking up the frontend, the WebSocket event protocol above is the contract. The simulation core is running and emitting live data — the UI just needs to consume it.

The design system in `design.md` is IBM Carbon-inspired: flat geometry, IBM Plex Sans typography, single blue accent, engineering restraint. The visual language for the network views uses a dark-canvas palette (`#1a1a2e` idle → `#e94560` moderate → `#ff0000` congested) with semi-transparent forecast overlays.

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

*Work in progress — contributions welcome*

</div>
