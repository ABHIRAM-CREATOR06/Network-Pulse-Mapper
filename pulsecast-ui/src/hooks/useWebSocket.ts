import { useEffect, useRef, useCallback } from 'react';
import { useSimulationStore } from '../store/simulationStore';
import type { WSCommand, WSEvent } from '../utils/types';

const WS_URL = 'ws://127.0.0.1:9001/ws';
const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 15000;
const BATCH_INTERVAL_MS = 100;

/**
 * Custom hook managing the WebSocket connection to the PulseCast backend.
 * - Auto-reconnects with exponential backoff
 * - Batches incoming messages at 100ms intervals to prevent excessive re-renders
 * - Provides a sendCommand function for UI → Backend communication
 */
export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempt = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const batchBuffer = useRef<WSEvent[]>([]);
  const batchTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const setConnected = useSimulationStore((s) => s.setConnected);
  const updateNode = useSimulationStore((s) => s.updateNode);
  const setForecast = useSimulationStore((s) => s.setForecast);
  const addPacketEvent = useSimulationStore((s) => s.addPacketEvent);
  const updateTopology = useSimulationStore((s) => s.updateTopology);

  // Flush batched events into the store
  const flushBatch = useCallback(() => {
    const events = batchBuffer.current;
    if (events.length === 0) return;
    batchBuffer.current = [];

    for (const event of events) {
      switch (event.type) {
        case 'node_telemetry':
          updateNode(event);
          break;
        case 'congestion_forecast':
          setForecast(event);
          break;
        case 'packet_event':
          addPacketEvent(event);
          break;
        case 'topology_update':
          updateTopology(event);
          break;
      }
    }
  }, [updateNode, setForecast, addPacketEvent, updateTopology]);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('🌐 WebSocket connected');
      setConnected(true);
      reconnectAttempt.current = 0;

      // Start batch flush interval
      batchTimer.current = setInterval(flushBatch, BATCH_INTERVAL_MS);
    };

    ws.onmessage = (e) => {
      try {
        const event: WSEvent = JSON.parse(e.data);
        batchBuffer.current.push(event);
      } catch {
        // Ignore malformed messages
      }
    };

    ws.onclose = () => {
      console.log('📡 WebSocket disconnected');
      setConnected(false);

      if (batchTimer.current !== null) {
        clearInterval(batchTimer.current);
        batchTimer.current = null;
      }
      // Flush remaining events
      flushBatch();

      // Exponential backoff reconnect
      const delay = Math.min(
        RECONNECT_BASE_MS * Math.pow(2, reconnectAttempt.current),
        RECONNECT_MAX_MS
      );
      reconnectAttempt.current++;
      console.log(`🔄 Reconnecting in ${delay}ms (attempt ${reconnectAttempt.current})`);
      reconnectTimer.current = setTimeout(connect, delay);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [setConnected, flushBatch]);

  // Send a command to the backend
  const sendCommand = useCallback((cmd: WSCommand) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(cmd));
    }
  }, []);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimer.current !== null) clearTimeout(reconnectTimer.current);
      if (batchTimer.current !== null) clearInterval(batchTimer.current);
      if (wsRef.current) {
        wsRef.current.onclose = null; // Prevent reconnect on intentional close
        wsRef.current.close();
      }
    };
  }, [connect]);

  return { sendCommand };
}
