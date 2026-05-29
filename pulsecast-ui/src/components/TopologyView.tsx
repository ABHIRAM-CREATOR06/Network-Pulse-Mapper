import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { useSimulationStore } from '../store/simulationStore';
import { occupancyToColor } from '../utils/colors';
import type { GraphNode, GraphLink } from '../utils/types';

const NODE_RADIUS = 24;
const GRAPH_PADDING = 50;
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 4;
const TELEMETRY_CARD_WIDTH = 132;
const TELEMETRY_CARD_HEIGHT = 62;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function axisBounds(size: number) {
  const min = GRAPH_PADDING + NODE_RADIUS;
  const max = size - GRAPH_PADDING - NODE_RADIUS;
  return max > min ? { min, max } : { min: size / 2, max: size / 2 };
}

function clampNodeToViewport(node: GraphNode, width: number, height: number) {
  const xBounds = axisBounds(width);
  const yBounds = axisBounds(height);
  node.x = clamp(node.x ?? width / 2, xBounds.min, xBounds.max);
  node.y = clamp(node.y ?? height / 2, yBounds.min, yBounds.max);
}

function graphBounds(nodes: GraphNode[]) {
  const xs = nodes.map((n) => n.x ?? 0);
  const ys = nodes.map((n) => n.y ?? 0);
  return {
    minX: Math.min(...xs) - NODE_RADIUS,
    maxX: Math.max(...xs) + NODE_RADIUS,
    minY: Math.min(...ys) - NODE_RADIUS,
    maxY: Math.max(...ys) + NODE_RADIUS,
  };
}

function clampTranslationAxis(
  current: number,
  minCoord: number,
  maxCoord: number,
  scale: number,
  viewportSize: number,
) {
  const low = viewportSize - GRAPH_PADDING - maxCoord * scale;
  const high = GRAPH_PADDING - minCoord * scale;

  if (low <= high) {
    return clamp(current, low, high);
  }

  return (viewportSize - (minCoord + maxCoord) * scale) / 2;
}

function nodeTelemetry(node: GraphNode) {
  return {
    load: `${Math.round(node.occupancy * 100)}%`,
    queue: `${node.queueDepth}/${node.queueCapacity}`,
    latency: `${node.latencyMs.toFixed(1)} ms`,
    packets: `${node.packetsSent} sent / ${node.packetsDropped} drop`,
  };
}

export function TopologyView() {
  const svgRef = useRef<SVGSVGElement>(null);
  const simulationRef = useRef<d3.Simulation<GraphNode, GraphLink> | null>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const containerRef = useRef<d3.Selection<SVGGElement, unknown, null, undefined> | null>(null);
  const nodesRef = useRef<GraphNode[]>([]);
  const linksRef = useRef<GraphLink[]>([]);
  const layoutModeRef = useRef<'manual' | 'auto'>('manual');
  const initializedRef = useRef(false);

  const topologyNodes = useSimulationStore((s) => s.topologyNodes);
  const topologyLinks = useSimulationStore((s) => s.topologyLinks);
  const activeView = useSimulationStore((s) => s.activeView);
  const setSelectedNode = useSimulationStore((s) => s.setSelectedNode);
  const layoutMode = useSimulationStore((s) => s.layoutMode);
  const fitRequest = useSimulationStore((s) => s.fitRequest);
  const autoLayoutRequest = useSimulationStore((s) => s.autoLayoutRequest);
  const nodeKey = topologyNodes.map((n) => n.id).join('|');

  layoutModeRef.current = layoutMode;

  function constrainedTransform(transform: d3.ZoomTransform) {
    if (!svgRef.current || nodesRef.current.length === 0) return transform;

    const width = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight;
    const bounds = graphBounds(nodesRef.current);

    const x = clampTranslationAxis(transform.x, bounds.minX, bounds.maxX, transform.k, width);
    const y = clampTranslationAxis(transform.y, bounds.minY, bounds.maxY, transform.k, height);

    return d3.zoomIdentity.translate(x, y).scale(transform.k);
  }

  function renderPositions() {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);

    svg.selectAll<SVGLineElement, GraphLink>('.link-line')
      .attr('x1', (d) => (d.source as GraphNode).x!)
      .attr('y1', (d) => (d.source as GraphNode).y!)
      .attr('x2', (d) => (d.target as GraphNode).x!)
      .attr('y2', (d) => (d.target as GraphNode).y!);

    svg.selectAll<SVGCircleElement, GraphNode>('.node-circle')
      .attr('cx', (d) => d.x!)
      .attr('cy', (d) => d.y!);

    svg.selectAll<SVGTextElement, GraphNode>('.node-label')
      .attr('x', (d) => d.x!)
      .attr('y', (d) => d.y!);

    svg.selectAll<SVGGElement, GraphNode>('.node-telemetry')
      .attr('transform', (d) => {
        const x = (d.x ?? 0) - TELEMETRY_CARD_WIDTH / 2;
        const y = (d.y ?? 0) + NODE_RADIUS + 12;
        return `translate(${x}, ${y})`;
      });

    const positions = nodesRef.current.map((n) => ({ id: n.id, x: n.x, y: n.y }));
    window.dispatchEvent(new CustomEvent('topology-tick', { detail: positions }));
  }

  function centerGraphCoordinates(width: number, height: number) {
    if (nodesRef.current.length === 0) return;

    const bounds = graphBounds(nodesRef.current);
    const currentCenterX = (bounds.minX + bounds.maxX) / 2;
    const currentCenterY = (bounds.minY + bounds.maxY) / 2;
    const dx = width / 2 - currentCenterX;
    const dy = height / 2 - currentCenterY;

    nodesRef.current.forEach((node) => {
      node.x = (node.x ?? width / 2) + dx;
      node.y = (node.y ?? height / 2) + dy;
      clampNodeToViewport(node, width, height);
    });
  }

  function pinNodesToCurrentPositions() {
    nodesRef.current.forEach((node) => {
      node.fx = node.x;
      node.fy = node.y;
    });
  }

  function releaseNodePins() {
    nodesRef.current.forEach((node) => {
      node.fx = null;
      node.fy = null;
    });
  }

  function dragPointToGraph(
    event: d3.D3DragEvent<SVGCircleElement, GraphNode, GraphNode>,
  ) {
    if (!svgRef.current) {
      return { x: event.x, y: event.y };
    }

    const width = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight;
    const pointerEvent = event.sourceEvent ?? event;
    const [screenX, screenY] = d3.pointer(pointerEvent, svgRef.current);
    const [graphX, graphY] = d3.zoomTransform(svgRef.current).invert([screenX, screenY]);
    const xBounds = axisBounds(width);
    const yBounds = axisBounds(height);

    return {
      x: clamp(graphX, xBounds.min, xBounds.max),
      y: clamp(graphY, yBounds.min, yBounds.max),
    };
  }

  function placeNodeAtDragPoint(
    event: d3.D3DragEvent<SVGCircleElement, GraphNode, GraphNode>,
    node: GraphNode,
  ) {
    const next = dragPointToGraph(event);
    node.x = next.x;
    node.y = next.y;
    node.fx = next.x;
    node.fy = next.y;
    renderPositions();
  }

  function fitGraphToViewport(animate = true) {
    if (!svgRef.current || !zoomRef.current || nodesRef.current.length === 0) return;

    const svg = d3.select(svgRef.current);
    const width = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight;
    if (width === 0 || height === 0) return;

    centerGraphCoordinates(width, height);
    renderPositions();

    const bounds = graphBounds(nodesRef.current);
    const graphWidth = Math.max(bounds.maxX - bounds.minX, 1);
    const graphHeight = Math.max(bounds.maxY - bounds.minY, 1);
    const availableWidth = Math.max(width - GRAPH_PADDING * 2, 1);
    const availableHeight = Math.max(height - GRAPH_PADDING * 2, 1);
    const scale = clamp(
      Math.min(1, availableWidth / graphWidth, availableHeight / graphHeight),
      MIN_ZOOM,
      MAX_ZOOM,
    );

    const x = width / 2 - ((bounds.minX + bounds.maxX) / 2) * scale;
    const y = height / 2 - ((bounds.minY + bounds.maxY) / 2) * scale;
    const transform = constrainedTransform(d3.zoomIdentity.translate(x, y).scale(scale));

    const target = animate ? svg.transition().duration(350) : svg;
    target.call(zoomRef.current.transform, transform);
  }

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
    const previousPositions = new Map(
      nodesRef.current.map((n) => [n.id, { x: n.x, y: n.y }])
    );

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
      .scaleExtent([MIN_ZOOM, MAX_ZOOM])
      .extent([[0, 0], [width, height]])
      .filter((event) => {
        const target = event.target as Element | null;
        return !target?.closest('.node-circle') && !event.button;
      })
      .on('zoom', (event) => {
        const nextTransform = constrainedTransform(event.transform);
        container.attr('transform', nextTransform.toString());
      });
    zoomRef.current = zoom;
    containerRef.current = container;
    svg.call(zoom);

    const linkGroup = container.append('g').attr('class', 'links');
    const nodeGroup = container.append('g').attr('class', 'nodes');
    const telemetryGroup = container.append('g').attr('class', 'telemetry-layer');
    const labelGroup = container.append('g').attr('class', 'labels');

    // Forecast overlay group
    if (activeView === 'forecast') {
      container.append('g').attr('class', 'forecast-overlays');
    }

    // Preserve positions from previous nodes
    const nodes: GraphNode[] = topologyNodes.map((n) => ({
      ...n,
      x: previousPositions.get(n.id)?.x ?? n.x ?? width / 2 + (Math.random() - 0.5) * 160,
      y: previousPositions.get(n.id)?.y ?? n.y ?? height / 2 + (Math.random() - 0.5) * 160,
      fx: layoutMode === 'manual' ? previousPositions.get(n.id)?.x ?? n.x : null,
      fy: layoutMode === 'manual' ? previousPositions.get(n.id)?.y ?? n.y : null,
    }));
    nodes.forEach((node) => clampNodeToViewport(node, width, height));

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
    if (layoutMode === 'manual') {
      simulation.alpha(0.12);
    }

    simulationRef.current = simulation;

    // Draw links
    linkGroup.selectAll<SVGLineElement, GraphLink>('line')
      .data(links)
      .join('line')
      .attr('class', 'link-line')
      .attr('stroke', 'url(#link-gradient)')
      .attr('stroke-width', 1.5)
      .attr('stroke-opacity', 0.6);

    // Animated traffic dots on links
    container.append('g').attr('class', 'traffic-dots');

    // Draw nodes
    nodeGroup.selectAll<SVGCircleElement, GraphNode>('circle')
      .data(nodes)
      .join('circle')
      .attr('class', 'node-circle')
      .attr('r', 24)
      .attr('fill', (d) => occupancyToColor(d.occupancy))
      .attr('stroke', 'var(--hairline-strong)')
      .attr('stroke-width', 1)
      .style('filter', (d) => d.occupancy > 0.5 ? 'url(#glow)' : 'none')
      .on('click', (_event, d) => {
        setSelectedNode(d.id);
      })
      .call(d3.drag<SVGCircleElement, GraphNode>()
        .on('start', (event, d) => {
          event.sourceEvent?.stopPropagation();
          setSelectedNode(d.id);
          d.fx = d.x;
          d.fy = d.y;
          if (layoutModeRef.current === 'manual') {
            simulation.stop();
          } else if (!event.active) {
            simulation.alphaTarget(0.3).restart();
          }
        })
        .on('drag', (event, d) => {
          event.sourceEvent?.stopPropagation();
          placeNodeAtDragPoint(event, d);
          if (layoutModeRef.current !== 'manual') {
            simulation.alphaTarget(0.12).restart();
          }
        })
        .on('end', (event, d) => {
          event.sourceEvent?.stopPropagation();
          if (!event.active) simulation.alphaTarget(0);
          if (layoutModeRef.current === 'manual') {
            d.fx = d.x;
            d.fy = d.y;
            simulation.stop();
          } else {
            d.fx = null;
            d.fy = null;
          }
          renderPositions();
        }));

    // Draw labels
    labelGroup.selectAll<SVGTextElement, GraphNode>('text')
      .data(nodes)
      .join('text')
      .attr('class', 'node-label')
      .text((d) => d.id);

    const telemetryCards = telemetryGroup.selectAll<SVGGElement, GraphNode>('g')
      .data(nodes)
      .join('g')
      .attr('class', 'node-telemetry');

    telemetryCards.append('rect')
      .attr('class', 'node-telemetry-bg')
      .attr('width', TELEMETRY_CARD_WIDTH)
      .attr('height', TELEMETRY_CARD_HEIGHT);

    telemetryCards.append('text')
      .attr('class', 'node-telemetry-title')
      .attr('x', 10)
      .attr('y', 16)
      .text((d) => `${d.role.replace('_', ' ')} · load ${nodeTelemetry(d).load}`);

    telemetryCards.append('text')
      .attr('class', 'node-telemetry-line')
      .attr('x', 10)
      .attr('y', 32)
      .text((d) => `queue ${nodeTelemetry(d).queue}`);

    telemetryCards.append('text')
      .attr('class', 'node-telemetry-line')
      .attr('x', 10)
      .attr('y', 46)
      .text((d) => `latency ${nodeTelemetry(d).latency}`);

    telemetryCards.append('text')
      .attr('class', 'node-telemetry-line')
      .attr('x', 10)
      .attr('y', 60)
      .text((d) => nodeTelemetry(d).packets);

    // Tick handler
    simulation.on('tick', () => {
      nodes.forEach((node) => clampNodeToViewport(node, width, height));
      renderPositions();
    });
    simulation.on('end', () => {
      fitGraphToViewport();
    });

    const resizeObserver = new ResizeObserver(([entry]) => {
      const nextWidth = entry.contentRect.width;
      const nextHeight = entry.contentRect.height;
      if (nextWidth === 0 || nextHeight === 0) return;

      zoom.extent([[0, 0], [nextWidth, nextHeight]]);
      simulation.force('center', d3.forceCenter(nextWidth / 2, nextHeight / 2));
      nodes.forEach((node) => clampNodeToViewport(node, nextWidth, nextHeight));
      fitGraphToViewport(false);
      if (layoutModeRef.current === 'manual') {
        pinNodesToCurrentPositions();
        simulation.stop();
      } else {
        simulation.alpha(0.35).restart();
      }
    });
    resizeObserver.observe(svgRef.current);

    initializedRef.current = true;
    fitGraphToViewport(false);
    if (layoutMode === 'manual') {
      pinNodesToCurrentPositions();
      simulation.stop();
    }

    return () => {
      resizeObserver.disconnect();
      simulation.stop();
    };
  }, [nodeKey, topologyLinks.length]);

  useEffect(() => {
    if (!initializedRef.current) return;

    if (layoutMode === 'manual') {
      pinNodesToCurrentPositions();
      simulationRef.current?.stop();
      renderPositions();
    } else {
      releaseNodePins();
      simulationRef.current?.alpha(0.6).restart();
    }
  }, [layoutMode]);

  useEffect(() => {
    if (!initializedRef.current || fitRequest === 0) return;
    fitGraphToViewport();
  }, [fitRequest]);

  useEffect(() => {
    if (!initializedRef.current || autoLayoutRequest === 0) return;
    releaseNodePins();
    simulationRef.current?.alpha(0.85).restart();
  }, [autoLayoutRequest]);

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
        d.occupancy = occ;
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

    svg.selectAll<SVGGElement, GraphNode>('.node-telemetry')
      .data(nodesRef.current)
      .each((d) => {
        const latest = topologyNodes.find((node) => node.id === d.id);
        if (latest) {
          d.occupancy = latest.occupancy;
          d.queueDepth = latest.queueDepth;
          d.queueCapacity = latest.queueCapacity;
          d.packetsSent = latest.packetsSent;
          d.packetsDropped = latest.packetsDropped;
          d.latencyMs = latest.latencyMs;
          d.role = latest.role;
        }
      })
      .select('.node-telemetry-title')
      .text((d) => `${d.role.replace('_', ' ')} · load ${nodeTelemetry(d).load}`);

    svg.selectAll<SVGGElement, GraphNode>('.node-telemetry')
      .select<SVGTextElement>('.node-telemetry-line:nth-of-type(2)')
      .text((d) => `queue ${nodeTelemetry(d).queue}`);

    svg.selectAll<SVGGElement, GraphNode>('.node-telemetry')
      .select<SVGTextElement>('.node-telemetry-line:nth-of-type(3)')
      .text((d) => `latency ${nodeTelemetry(d).latency}`);

    svg.selectAll<SVGGElement, GraphNode>('.node-telemetry')
      .select<SVGTextElement>('.node-telemetry-line:nth-of-type(4)')
      .text((d) => nodeTelemetry(d).packets);
  }

  // Continuous update
  useEffect(() => {
    if (initializedRef.current) {
      updateVisualization();
    }
  }, [topologyNodes, topologyLinks]);

  return (
    <div className="topology-container">
      <svg ref={svgRef} id="topology-svg" style={{ width: '100%', height: '100%' }} />
    </div>
  );
}
