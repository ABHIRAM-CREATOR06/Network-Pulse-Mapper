# PulseCast — System Prompt for Claude-Assisted Development

## Project Identity

**PulseCast** is a telecom-oriented network simulation and congestion forecasting platform. It models network behavior as a dynamic propagating system — analogous to weather diffusion or seismic wave propagation — rather than as a static metric dashboard.

The platform has three primary subsystems:

1. **Network Simulation Core** — localhost-based virtual nodes communicating over simulated links
2. **Pulse Visualization Engine** — real-time rendering of traffic propagation, congestion waves, and instability ripples
3. **Congestion Forecast Engine** — predictive modeling of future bottlenecks and routing collapse zones

---

## Technology Stack

| Layer | Technology |
|---|---|
| Backend / Simulation | Rust + Tokio (async runtime) |
| Transport Simulation | UDP sockets (simulating QUIC/TCP behavior) |
| Frontend | React + D3.js + WebGL/Canvas |
| Backend ↔ Frontend | WebSockets (real-time event streaming) |
| Optional Desktop Shell | Tauri |
| Optional TUI | ratatui |

All virtual nodes run on **localhost**, differentiated by port (e.g., `:5001`–`:5005`).

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           PULSECAST ARCHITECTURE                          │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                           ┌──────────────┐                                │
│                           │    CLIENT    │                                │
│                           │   (React)    │                                │
│                           └──────┬───────┘                                │
│                                  │ WebSocket                                │
│               ┌──────────────────┼──────────────────┐                     │
│               │   ┌──────────────▼──────────────┐   │                     │
│               │   │    FORECAST ENGINE           │   │                     │
│               │   │  ┌──────────────────────┐    │   │                     │
│               │   │  │ Diffusion Math       │    │   │                     │
│               │   │  │ Congestion Risk Scori-│    │   │                     │
│               │   │  │ ng                   │    │   │                     │
│               │   │  └──────────────┬─────────┘    │   │                     │
│               │   └──────────────────┼──────────────┘   │                     │
│               │                      │                  │                     │
│               │   ┌──────────────────▼──────────────┐   │                     │
│               │   │    SIMULATION CORE             │   │                     │
│               │   │  ┌────────────────────────────┐  │   │                     │
│               │   │  │ Packet Queue ◄─────────────┼───┼───┼── Queue Telemetry   │
│               │   │  ├────────────────────────────┤  │   │                     │
│               │   │  │ Router ◄───────────────────┼───┼───┼── Node Events       │
│               │   │  ├────────────────────────────┤  │   │                     │
│               │   │  │ Packet Engine              │  │   │                     │
│               │   │  └────────────────────────────┘  │   │                     │
│               │   └──────────────────┬──────────────┘   │                     │
│               └──────────────────────┼─────────────────┼── UDP/TCP           │
│                                    │                   │                     │
└────────────────────────────────────▼───────────────────▼───────────────────┘
                                     │
┌────────────────────────────────────▼─────────────────────────────────────────┐
│                        VIRTUAL NODE NETWORK (localhost)                        │
│                                                                          │
│    ┌────────┐    ┌────────┐    ┌────────┐    ┌────────┐    ┌────────┐    │
│    │ Node A │◄──►│ Node B │◄──►│ Node C │◄──►│ Node D │◄──►│ Node E │    │
│    │ :5001  │    │ :5002  │    │ :5003  │    │ :5004  │    │ :5005  │    │
│    └────────┘    └────────┘    └────────┘    └────────┘    └────────┘    │
│        │               │             │             │             │         │
│    Queue/Ack       Queue/Ack     Queue/Ack     Queue/Ack     Queue/Ack      │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                      SIMULATED LINK CONDITIONS (Tunable)                     │
│                                                                              │
│   Latency:     10ms ± 2ms jitter    │    Loss:         1%                 │
│   Bandwidth:   1 Mbps               │    Congestion:   75% threshold       │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Virtual Node Specification

Each node is an independent Rust process (or Tokio task) that:

- Binds to a localhost UDP/TCP port
- Maintains a **packet queue** with configurable depth and drain rate
- Tracks **queue occupancy** over time (used for forecasting)
- Supports roles: `Sender`, `Receiver`, `Router`, or `Congestion Source`
- Emits real-time telemetry over WebSocket to the UI

### Per-Node State

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

---

## Simulated Link Conditions

Links between nodes are defined by tunable parameters:

| Parameter | Description | Default |
|---|---|---|
| `latency_ms` | Base one-way delay | 10ms |
| `jitter_ms` | ±variation on latency | 2ms |
| `loss_rate` | Probability of packet drop | 0.01 |
| `bandwidth_bps` | Max throughput per link | 1 Mbps |
| `congestion_threshold` | Queue occupancy % that triggers congestion | 0.75 |

---

## Packet Engine

Packets are discrete simulation units with:

```rust
struct Packet {
    id: PacketId,
    source: NodeId,
    destination: NodeId,
    size_bytes: u32,
    priority: u8,
    timestamp_created: Instant,
    ttl: u8,
    route_history: Vec<NodeId>,
}
```

Forwarding decisions use the node's active **routing strategy** (see below).

---

## Routing Strategies

PulseCast supports swappable routing strategies per node:

| Strategy | Description |
|---|---|
| `ShortestPath` | Static hop-count minimization (Dijkstra) |
| `CongestionAware` | Weights links by current queue occupancy |
| `PredictiveReroute` | Uses forecast scores to avoid future bottlenecks |
| `MemoryBased` | Avoids historically congested links with decay factor |

Strategies are runtime-configurable without restarting simulation.

---

## Congestion Forecast Engine

The forecasting model treats congestion as a **diffusion process** across the node graph.

### Inputs

- Rolling queue occupancy history per node (sliding window: configurable, default 60s)
- Link utilization rates
- Packet drop rates
- Retransmission event counts

### Output

A **Congestion Risk Score** (0.0–1.0) per node, projected `T` seconds forward.

### Model

Use an **exponential smoothing + propagation diffusion** approach:

```
forecast[node][t+1] = α × current_load[node] 
                    + (1 - α) × Σ (neighbor_forecast[n][t] × link_weight[n→node])
```

Where:
- `α` = smoothing factor (default `0.3`)
- `link_weight` = inverse of available bandwidth × current loss rate
- Propagation iterates for `N` hops (default `3`)

This produces a **forward-propagating congestion heatmap** updated every simulation tick.

---

## Visualization Spec

### Views

| View | Description |
|---|---|
| **Topology View** | Node graph with animated edge traffic, color-coded by load |
| **Pulse View** | Radial wave rings emanating from congested nodes |
| **Forecast Heatmap** | Node fill intensity = predicted congestion risk (T+Δ) |
| **Temporal Timeline** | Per-node queue depth over time (scrollable, zoomable) |

### Rendering

- Use **D3.js** for topology graph and timeline
- Use **WebGL / Canvas** for pulse wave animation (particle systems or radial wave shaders)
- All views subscribe to a shared **WebSocket event stream** from the backend
- Target: **60fps** for pulse animation; 1Hz telemetry updates for heatmap/timeline

### Color Encoding

| State | Color |
|---|---|
| Idle | `#1a1a2e` (dark blue) |
| Low load | `#16213e` → `#0f3460` |
| Moderate load | `#e94560` (amber-red) |
| Congested | `#ff0000` (saturated red) |
| Forecast risk | Semi-transparent overlay, same scale |

---

## Traffic Injection System

The UI and/or CLI must support injecting test scenarios:

| Scenario | Description |
|---|---|
| `burst` | Sudden spike of N packets from one node |
| `storm` | Synchronized multi-node packet flood |
| `link_fail` | Drop a link (loss_rate → 1.0) |
| `node_overload` | Fill a node's queue to capacity |
| `cascade` | Chain congestion from one node outward |

Each scenario is parameterizable: source node, duration, intensity, target node(s).

---

## WebSocket Event Schema

Backend emits JSON events on a single stream:

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

```json
{
  "type": "congestion_forecast",
  "timestamp": 1718000000.123,
  "horizon_seconds": 10,
  "scores": {
    "A": 0.21,
    "B": 0.87,
    "C": 0.63,
    "D": 0.09,
    "E": 0.44
  }
}
```

```json
{
  "type": "packet_event",
  "packet_id": "pkt-00421",
  "event": "dropped",
  "node_id": "B",
  "timestamp": 1718000000.456
}
```

---

## Development Phases

### Phase 1 — Simulation Core
- [ ] Implement `NodeState` and packet queue in Rust/Tokio
- [ ] Localhost UDP communication between 3–5 nodes
- [ ] Configurable link condition injection
- [ ] WebSocket telemetry emitter

### Phase 2 — Visualization
- [ ] React app with WebSocket consumer
- [ ] D3.js topology graph with live edge animation
- [ ] Pulse wave renderer (Canvas/WebGL)
- [ ] Timeline / sparkline per node

### Phase 3 — Forecasting Engine
- [ ] Rolling history buffer per node
- [ ] Diffusion-based congestion score computation
- [ ] Forecast heatmap overlay in UI
- [ ] Accuracy logging (compare forecast vs actual)

### Phase 4 — Routing Experiments
- [ ] Swap routing strategies at runtime
- [ ] Side-by-side comparison mode
- [ ] Congestion outcome metrics per strategy

### Phase 5 — Traffic Injection & Scenarios
- [ ] CLI and UI controls for scenario injection
- [ ] Scenario replay / recording
- [ ] Export telemetry to JSON/CSV

---

## Key Constraints & Decisions

- **No external network traffic.** All simulation is localhost-only.
- **No ML model required.** The forecast engine uses deterministic diffusion math, not neural networks (unless explicitly extended later).
- **Simulation tick rate** is decoupled from real time — configurable 1x, 2x, 10x speed.
- **Rust is non-negotiable** for the simulation core. Frontend may use any React-compatible approach.
- Prefer **composition over inheritance** in both Rust (traits) and React (hooks/components).