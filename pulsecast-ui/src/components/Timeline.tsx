import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { useSimulationStore } from '../store/simulationStore';
import { occupancyToColor } from '../utils/colors';

/**
 * Per-node queue depth timeline using D3.js line charts.
 * Shows rolling history with zoom/brush support.
 */
export function Timeline() {
  const svgRef = useRef<SVGSVGElement>(null);
  const timelines = useSimulationStore((s) => s.timelines);
  const topologyNodes = useSimulationStore((s) => s.topologyNodes);

  useEffect(() => {
    if (!svgRef.current || Object.keys(timelines).length === 0) return;

    const svg = d3.select(svgRef.current);
    const container = svgRef.current.parentElement;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;
    const margin = { top: 20, right: 20, bottom: 30, left: 45 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    svg.attr('viewBox', `0 0 ${width} ${height}`);
    svg.selectAll('*').remove();

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    // Determine X and Y scales
    let maxTick = 0;
    let minTick = Infinity;
    const allNodeIds = Object.keys(timelines);

    for (const nodeId of allNodeIds) {
      const points = timelines[nodeId];
      if (points.length > 0) {
        minTick = Math.min(minTick, points[0].tick);
        maxTick = Math.max(maxTick, points[points.length - 1].tick);
      }
    }

    if (minTick === Infinity) return;

    const xScale = d3.scaleLinear().domain([minTick, maxTick]).range([0, innerW]);
    const yScale = d3.scaleLinear().domain([0, 1]).range([innerH, 0]);

    // Grid lines
    g.append('g')
      .attr('class', 'grid')
      .selectAll('line')
      .data([0.25, 0.5, 0.75, 1.0])
      .join('line')
      .attr('x1', 0)
      .attr('x2', innerW)
      .attr('y1', (d) => yScale(d))
      .attr('y2', (d) => yScale(d))
      .attr('stroke', 'rgba(100,100,200,0.08)')
      .attr('stroke-dasharray', '4,4');

    // Congestion threshold line
    g.append('line')
      .attr('x1', 0)
      .attr('x2', innerW)
      .attr('y1', yScale(0.75))
      .attr('y2', yScale(0.75))
      .attr('stroke', '#e94560')
      .attr('stroke-opacity', 0.3)
      .attr('stroke-dasharray', '6,3')
      .attr('stroke-width', 1);

    g.append('text')
      .attr('x', innerW - 4)
      .attr('y', yScale(0.75) - 4)
      .attr('text-anchor', 'end')
      .attr('fill', '#e94560')
      .attr('font-size', '9px')
      .attr('font-family', 'var(--font-mono)')
      .attr('opacity', 0.6)
      .text('threshold');

    // Draw line for each node
    const nodeColors = ['#4a7dff', '#8b5cf6', '#22c55e', '#f59e0b', '#ef4444',
      '#00d4ff', '#ec4899', '#14b8a6', '#f97316', '#a855f7'];

    const line = d3.line<{ tick: number; value: number }>()
      .x((d) => xScale(d.tick))
      .y((d) => yScale(d.value))
      .curve(d3.curveCatmullRom.alpha(0.5));

    allNodeIds.forEach((nodeId, i) => {
      const points = timelines[nodeId];
      if (points.length < 2) return;

      const color = nodeColors[i % nodeColors.length];

      // Area fill
      const area = d3.area<{ tick: number; value: number }>()
        .x((d) => xScale(d.tick))
        .y0(innerH)
        .y1((d) => yScale(d.value))
        .curve(d3.curveCatmullRom.alpha(0.5));

      g.append('path')
        .datum(points)
        .attr('d', area)
        .attr('fill', color)
        .attr('fill-opacity', 0.05);

      // Line
      g.append('path')
        .datum(points)
        .attr('d', line)
        .attr('fill', 'none')
        .attr('stroke', color)
        .attr('stroke-width', 1.5)
        .attr('stroke-opacity', 0.8);

      // Current value dot
      const last = points[points.length - 1];
      g.append('circle')
        .attr('cx', xScale(last.tick))
        .attr('cy', yScale(last.value))
        .attr('r', 3)
        .attr('fill', color);

      // Label
      g.append('text')
        .attr('x', xScale(last.tick) + 6)
        .attr('y', yScale(last.value) + 3)
        .attr('fill', color)
        .attr('font-size', '9px')
        .attr('font-family', 'var(--font-mono)')
        .text(nodeId);
    });

    // Axes
    const xAxis = d3.axisBottom(xScale).ticks(6).tickFormat((d) => `t${d}`);
    g.append('g')
      .attr('transform', `translate(0,${innerH})`)
      .call(xAxis)
      .selectAll('text')
      .attr('fill', 'var(--text-muted)')
      .attr('font-size', '9px');
    g.selectAll('.domain, .tick line').attr('stroke', 'rgba(100,100,200,0.15)');

    const yAxis = d3.axisLeft(yScale).ticks(4).tickFormat((d) => `${(+d * 100).toFixed(0)}%`);
    g.append('g')
      .call(yAxis)
      .selectAll('text')
      .attr('fill', 'var(--text-muted)')
      .attr('font-size', '9px');

  }, [timelines, topologyNodes]);

  return (
    <div className="timeline-container">
      <svg ref={svgRef} id="timeline-svg" style={{ width: '100%', height: '100%' }} />
    </div>
  );
}
