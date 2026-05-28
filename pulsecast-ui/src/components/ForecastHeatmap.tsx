import { useEffect, useRef } from 'react';
import { useSimulationStore } from '../store/simulationStore';
import { forecastToColor } from '../utils/colors';

/**
 * Semi-transparent forecast heatmap overlay rendered on Canvas.
 * Node fill intensity = predicted congestion risk score (0.0–1.0).
 */
export function ForecastHeatmap() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>();

  const topologyNodes = useSimulationStore((s) => s.topologyNodes);
  const forecast = useSimulationStore((s) => s.forecast);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      canvas.width = canvas.clientWidth * window.devicePixelRatio;
      canvas.height = canvas.clientHeight * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
      ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);

      if (!forecast) {
        animFrameRef.current = requestAnimationFrame(draw);
        return;
      }

      for (const node of topologyNodes) {
        if (node.x == null || node.y == null) continue;
        const score = forecast.scores[node.id] ?? 0;
        if (score < 0.05) continue;

        // Radial gradient overlay centered on node
        const radius = 40 + score * 80;
        const gradient = ctx.createRadialGradient(
          node.x, node.y, 10,
          node.x, node.y, radius
        );
        const color = forecastToColor(score);
        gradient.addColorStop(0, color);
        gradient.addColorStop(1, 'rgba(0,0,0,0)');

        ctx.beginPath();
        ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();

        // Score label
        if (score > 0.2) {
          ctx.font = '600 10px "JetBrains Mono", monospace';
          ctx.textAlign = 'center';
          ctx.fillStyle = `rgba(255, 255, 255, ${0.4 + score * 0.4})`;
          ctx.fillText(
            `ƒ${(score * 100).toFixed(0)}%`,
            node.x,
            node.y + 38
          );
        }
      }

      animFrameRef.current = requestAnimationFrame(draw);
    };

    animFrameRef.current = requestAnimationFrame(draw);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [topologyNodes, forecast]);

  return (
    <canvas
      ref={canvasRef}
      className="pulse-canvas"
      id="forecast-canvas"
      style={{ pointerEvents: 'none' }}
    />
  );
}
