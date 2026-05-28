import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { useSimulationStore } from '../store/simulationStore';
import { occupancyToColor, occupancyToGlow, forecastToColor } from '../utils/colors';
import type { GraphNode, GraphLink } from '../utils/types';

export function TopologyView() {
  const svgRef = useRef<SVGSVGElement>(null);
  const simulationRef = useRef<d3.Simulation<GraphNode, GraphLink>>();
  const nodesRef = useRef<GraphNode[]>([]);
  const linksRef = useRef<GraphLink[]>([]);
  const initializedRef = useRef(false);

  const topologyNodes = useSimulationStore((s) => s.topologyNodes);
  const topologyLinks = useSimulationStore((s) => s.topologyLinks);
  const activeView = useSimulationStore((s) => s.activeView);
  const setSelectedNode = useSimulationStore((s) => s.setSelectedNode);
  const forecast = useSimulationStore((s) => s.forecast);

  // Initialize the D3 force simulation
  useEffect(() => {
    if (!svgRef.current || topologyNodes.length === 0) return;
    if (initializedRef.current && nodesRef.current.length === topologyNodes.length) {
      // Just update data, don't re-init simulation
      updateVisualization();
      return;
    }

    const svg = d3.select(svgRef.current);
    const width = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight;

    svg.selectAll('*').remove();

    // Defs for glow filter
    const defs = svg.append('defs');

    const glowFilter = defs.append('filter').attr('id', 'glow');
    glowFilter.append('feGaussianBlur').attr('stdDeviation', '4').attr('result', 'blur');
    const feMerge = glowFilter.append('feMerge');
    feMerge.append('feMergeNode').attr('in', 'blur');
    feMerge.append('feMergeNode').attr('in', 'SourceGraphic');

    // Gradient for links
    const gradient = defs.append('linearGradient')
      .attr('id', 'link-gradient')
      .attr('gradientUnits', 'userSpaceOnUse');
    gradient.append('stop').attr('offset', '0%').attr('stop-color', '#4a7dff').attr('stop-opacity', 0.4);
    gradient.append('stop').attr('offset', '100%').attr('stop-color', '#8b5cf6').attr('stop-opacity', 0.4);

    // Container groups
    const container = svg.append('g').attr('class', 'topology-graph');

    // Zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 4])
      .on('zoom', (event) => {
        container.attr('transform', event.transform);
      });
    svg.call(zoom);

    const linkGroup = container.append('g').attr('class', 'links');
    const nodeGroup = container.append('g').attr('class', 'nodes');
    const labelGroup = container.append('g').attr('class', 'labels');

    // Forecast overlay group
    if (activeView === 'forecast') {
      container.append('g').attr('class', 'forecast-overlays');
    }

    // Preserve positions from previous nodes
    const nodes: GraphNode[] = topologyNodes.map((n) => ({
      ...n,
      x: n.x ?? width / 2 + (Math.random() - 0.5) * 200,
      y: n.y ?? height / 2 + (Math.random() - 0.5) * 200,
    }));

    const links: GraphLink[] = topologyLinks.map((l) => ({ ...l }));

    nodesRef.current = nodes;
    linksRef.current = links;

    // Force simulation
    const simulation = d3.forceSimulation<GraphNode>(nodes)
      .force('link', d3.forceLink<GraphNode, GraphLink>(links)
        .id((d) => d.id)
        .distance(140)
        .strength(0.4))
      .force('charge', d3.forceManyBody().strength(-400))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(50))
      .alphaDecay(0.02);

    simulationRef.current = simulation;

    // Draw links
    const linkElements = linkGroup.selectAll<SVGLineElement, GraphLink>('line')
      .data(links)
      .join('line')
      .attr('class', 'link-line')
      .attr('stroke', 'url(#link-gradient)')
      .attr('stroke-width', 1.5)
      .attr('stroke-opacity', 0.6);

    // Animated traffic dots on links
    const dotGroup = container.append('g').attr('class', 'traffic-dots');

    // Draw nodes
    const nodeElements = nodeGroup.selectAll<SVGCircleElement, GraphNode>('circle')
      .data(nodes)
      .join('circle')
      .attr('class', 'node-circle')
      .attr('r', 24)
      .attr('fill', (d) => occupancyToColor(d.occupancy))
      .attr('stroke', 'rgba(255,255,255,0.15)')
      .attr('stroke-width', 2)
      .style('filter', (d) => d.occupancy > 0.5 ? 'url(#glow)' : 'none')
      .on('click', (_event, d) => {
        setSelectedNode(d.id);
      })
      .call(d3.drag<SVGCircleElement, GraphNode>()
        .on('start', (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on('drag', (event, d) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on('end', (event, d) => {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        }));

    // Draw labels
    const labelElements = labelGroup.selectAll<SVGTextElement, GraphNode>('text')
      .data(nodes)
      .join('text')
      .attr('class', 'node-label')
      .text((d) => d.id);

    // Tick handler
    simulation.on('tick', () => {
      linkElements
        .attr('x1', (d) => (d.source as GraphNode).x!)
        .attr('y1', (d) => (d.source as GraphNode).y!)
        .attr('x2', (d) => (d.target as GraphNode).x!)
        .attr('y2', (d) => (d.target as GraphNode).y!);

      nodeElements
        .attr('cx', (d) => d.x!)
        .attr('cy', (d) => d.y!);

      labelElements
        .attr('x', (d) => d.x!)
        .attr('y', (d) => d.y!);
    });

    initializedRef.current = true;

    return () => {
      simulation.stop();
    };
  }, [topologyNodes.length, topologyLinks.length]);

  // Update node visuals when telemetry changes (without re-initializing simulation)
  function updateVisualization() {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);

    // Update node colors based on occupancy
    svg.selectAll<SVGCircleElement, GraphNode>('.node-circle')
      .data(nodesRef.current)
      .attr('fill', (d) => {
        const node = topologyNodes.find((n) => n.id === d.id);
        const occ = node?.occupancy ?? d.occupancy;
        return occupancyToColor(occ);
      })
      .style('filter', (d) => {
        const node = topologyNodes.find((n) => n.id === d.id);
        const occ = node?.occupancy ?? d.occupancy;
        return occ > 0.5 ? 'url(#glow)' : 'none';
      });

    // Update link appearance based on utilization
    svg.selectAll<SVGLineElement, GraphLink>('.link-line')
      .data(linksRef.current)
      .attr('stroke-width', (d) => {
        const link = topologyLinks.find(
          (l) =>
            (l.source === d.source || (l.source as GraphNode)?.id === (d.source as GraphNode)?.id) &&
            (l.target === d.target || (l.target as GraphNode)?.id === (d.target as GraphNode)?.id)
        );
        const util = link?.utilization ?? 0;
        return 1.5 + util * 4;
      })
      .attr('stroke-opacity', (d) => {
        const link = topologyLinks.find(
          (l) =>
            (l.source === d.source || (l.source as GraphNode)?.id === (d.source as GraphNode)?.id) &&
            (l.target === d.target || (l.target as GraphNode)?.id === (d.target as GraphNode)?.id)
        );
        return link?.active ? 0.6 : 0.1;
      });
  }

  // Continuous update
  useEffect(() => {
    if (initializedRef.current) {
      updateVisualization();
    }
  }, [topologyNodes, topologyLinks]);

  return (
    <div className="topology-container">
      <svg ref={svgRef} id="topology-svg" />
    </div>
  );
}
