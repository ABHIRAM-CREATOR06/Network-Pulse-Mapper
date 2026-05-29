import { useEffect, useRef } from 'react';
import { useSimulationStore } from '../store/simulationStore';
import { occupancyToColor } from '../utils/colors';

/**
 * Canvas-based radial wave animation.
 * Emanating rings from congested nodes, 60fps via requestAnimationFrame.
 */
export function PulseView() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number | null>(null);
  const pulsesRef = useRef<PulseRing[]>([]);

  const topologyNodes = useSimulationStore((s) => s.topologyNodes);
  const recentEvents = useSimulationStore((s) => s.recentEvents);

  interface PulseRing {
    x: number;
    y: number;
    radius: number;
    maxRadius: number;
    color: string;
    opacity: number;
    speed: number;
  }

  const positionsRef = useRef<Record<string, {x: number, y: number}>>({});

  useEffect(() => {
    const handler = (e: any) => {
      e.detail.forEach((n: any) => {
        positionsRef.current[n.id] = { x: n.x, y: n.y };
      });
    };
    window.addEventListener('topology-tick', handler);
    return () => window.removeEventListener('topology-tick', handler);
  }, []);

  // Spawn new pulse rings for congested nodes and dropped packets
  useEffect(() => {
    for (const node of topologyNodes) {
      const pos = positionsRef.current[node.id];
      if (node.occupancy > 0.6 && pos) {
        // Probability of spawning based on congestion
        if (Math.random() < node.occupancy * 0.3) {
          pulsesRef.current.push({
            x: pos.x,
            y: pos.y,
            radius: 24,
            maxRadius: 60 + node.occupancy * 120,
            color: occupancyToColor(node.occupancy),
            opacity: 0.4 + node.occupancy * 0.3,
            speed: 0.8 + node.occupancy * 1.5,
          });
        }
      }
    }

    // Spawn pulses for dropped packets
    for (const event of recentEvents.slice(-5)) {
      if (event.event === 'dropped') {
        const node = topologyNodes.find((n) => n.id === event.node_id);
        const pos = node ? positionsRef.current[node.id] : null;
        if (pos && Math.random() < 0.5) {
          pulsesRef.current.push({
            x: pos.x,
            y: pos.y,
            radius: 10,
            maxRadius: 40,
            color: '#ef4444',
            opacity: 0.6,
            speed: 2.0,
          });
        }
      }
    }

    // Cap total pulses
    if (pulsesRef.current.length > 100) {
      pulsesRef.current = pulsesRef.current.slice(-80);
    }
  }, [topologyNodes, recentEvents]);

  // Animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const animate = () => {
      canvas.width = canvas.clientWidth * window.devicePixelRatio;
      canvas.height = canvas.clientHeight * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

      ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);

      // Draw pulse rings
      const pulses = pulsesRef.current;
      for (let i = pulses.length - 1; i >= 0; i--) {
        const p = pulses[i];
        const progress = (p.radius - 24) / (p.maxRadius - 24);
        const alpha = p.opacity * (1 - progress);

        if (alpha <= 0.01 || p.radius >= p.maxRadius) {
          pulses.splice(i, 1);
          continue;
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.strokeStyle = p.color;
        ctx.globalAlpha = alpha;
        ctx.lineWidth = 2 - progress * 1.5;
        ctx.stroke();
        ctx.globalAlpha = 1;

        p.radius += p.speed;
      }

      // Draw particle effects for active congestion
      for (const node of topologyNodes) {
        const pos = positionsRef.current[node.id];
        if (node.occupancy > 0.7 && pos) {
          const particleCount = Math.floor(node.occupancy * 4);
          for (let i = 0; i < particleCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = 20 + Math.random() * 30;
            const px = pos.x + Math.cos(angle) * dist;
            const py = pos.y + Math.sin(angle) * dist;
            const size = 1 + Math.random() * 2;

            ctx.beginPath();
            ctx.arc(px, py, size, 0, Math.PI * 2);
            ctx.fillStyle = occupancyToColor(node.occupancy);
            ctx.globalAlpha = 0.3 + Math.random() * 0.3;
            ctx.fill();
            ctx.globalAlpha = 1;
          }
        }
      }

      animFrameRef.current = requestAnimationFrame(animate);
    };

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, []);

  return <canvas ref={canvasRef} className="pulse-canvas" id="pulse-canvas" />;
}
