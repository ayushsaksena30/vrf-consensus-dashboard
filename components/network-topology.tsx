'use client';

import dynamic from 'next/dynamic';
import { Scan, X, ZoomIn, ZoomOut } from 'lucide-react';
import { useTheme } from 'next-themes';
import type { ComponentType, MutableRefObject } from 'react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { HoverHint } from '@/components/ui/tooltip';
import type { ForceGraphMethods, ForceGraphProps, LinkObject, NodeObject } from 'react-force-graph-2d';

export interface RoundSnapshot {
  validators: number[];
  slashed_nodes: number[];
  trust_scores: number[];
}

interface NetworkNode {
  id: number;
  trustScore: number;
  slashed: boolean;
  validator: boolean;
  malicious: boolean;
  gridX: number;
  gridY: number;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number;
  fy?: number;
}

interface NetworkLink {
  source: number;
  target: number;
  sourceId: number;
  targetId: number;
  distance: number;
  strength: number;
  severed: boolean;
}

type NodeFilter = 'all' | 'malicious' | 'validator' | 'idle' | 'low-trust' | 'slashed';

type GraphNode = NodeObject<NetworkNode>;
type GraphLink = LinkObject<NetworkNode, NetworkLink>;
type GraphMethods = ForceGraphMethods<GraphNode, GraphLink>;
type GraphProps = ForceGraphProps<NetworkNode, NetworkLink> & {
  ref?: MutableRefObject<GraphMethods | undefined>;
};

const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), {
  ssr: false,
  loading: () => (
    <div className="flex h-[360px] items-center justify-center text-sm text-muted-foreground">
      Loading network topology...
    </div>
  ),
}) as ComponentType<GraphProps>;

function trustColor(score: number, floor: number, ceiling: number, isDark: boolean, slashed: boolean) {
  if (slashed) return isDark ? '#fca5a5' : '#b91c1c';
  if (Math.abs(score - 1) < 0.02) return isDark ? '#a1a1aa' : '#71717a';

  if (score < 1) {
    const progress = Math.max(0, Math.min(1, (score - floor) / Math.max(1 - floor, 0.01)));
    const hue = 28 + progress * 18;
    return `hsl(${hue} 78% ${isDark ? 62 : 42}%)`;
  }

  const progress = Math.max(0, Math.min(1, (score - 1) / Math.max(ceiling - 1, 0.01)));
  const lightness = isDark ? 52 + progress * 10 : 38 - progress * 8;
  return `hsl(${145 + progress * 20} 62% ${lightness}%)`;
}

export function NetworkTopology({
  snapshot,
  history,
  currentRound,
  nodeCount,
  isPreviewRound,
  maliciousNodeIds,
  trustFloor,
  trustCeil,
  onInteraction,
}: {
  snapshot: RoundSnapshot | null;
  history: RoundSnapshot[];
  currentRound: number;
  nodeCount: number;
  isPreviewRound: boolean;
  maliciousNodeIds: number[];
  trustFloor: number;
  trustCeil: number;
  onInteraction: () => void;
}) {
  const { resolvedTheme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<GraphMethods | undefined>(undefined);
  const shouldAutoFitRef = useRef(true);
  const fitTickCountRef = useRef(0);
  const [width, setWidth] = useState(0);
  const [selectedNodeId, setSelectedNodeId] = useState<number | null>(null);
  const [nodeFilter, setNodeFilter] = useState<NodeFilter>('all');
  const isDark = resolvedTheme === 'dark';

  const graphData = useMemo(() => {
    const columns = Math.max(1, Math.ceil(Math.sqrt(Math.max(nodeCount, 1) * 2.2)));
    const nodes: NetworkNode[] = Array.from({ length: nodeCount }, (_, index) => ({
      id: index + 1,
      trustScore: 1,
      slashed: false,
      validator: false,
      malicious: false,
      gridX: ((index % columns) - (columns - 1) / 2) * 32,
      gridY: (Math.floor(index / columns) - (Math.ceil(nodeCount / columns) - 1) / 2) * 30,
    }));
    nodes.forEach((node) => {
      node.x = node.gridX;
      node.y = node.gridY;
    });
    const links: NetworkLink[] = [];
    nodes.forEach((node, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      if (column < columns - 1 && nodes[index + 1]) {
        links.push({ source: node.id, target: nodes[index + 1].id, sourceId: node.id, targetId: nodes[index + 1].id, distance: 32, strength: 0.5, severed: false });
      }
      if (row < Math.floor((nodeCount - 1) / columns) && nodes[index + columns]) {
        links.push({ source: node.id, target: nodes[index + columns].id, sourceId: node.id, targetId: nodes[index + columns].id, distance: 30, strength: 0.5, severed: false });
      }
    });

    return { nodes, links };
  }, [nodeCount]);

  useLayoutEffect(() => {
    shouldAutoFitRef.current = true;
    fitTickCountRef.current = 0;
  }, [nodeCount, width]);

  useLayoutEffect(() => {
    const slashedNodes = new Set(snapshot?.slashed_nodes ?? []);
    const validators = new Set(snapshot?.validators ?? []);
    const maliciousNodes = new Set(maliciousNodeIds);
    graphData.nodes.forEach((node, index) => {
      node.trustScore = isPreviewRound ? 1 : snapshot?.trust_scores[index] ?? 1;
      node.slashed = slashedNodes.has(node.id);
      node.validator = validators.has(node.id);
      node.malicious = maliciousNodes.has(node.id);
    });
    graphData.links.forEach((link) => {
      const sourceNode = graphData.nodes[link.sourceId - 1];
      const targetNode = graphData.nodes[link.targetId - 1];
      link.severed = Boolean(sourceNode?.slashed || targetNode?.slashed);
      link.distance = link.severed ? 44 : 32;
      link.strength = link.severed ? 0.06 : 0.5;
    });

    const graph = graphRef.current;
    if (!graph) return;

    const linkForce = graph.d3Force('link');
    linkForce?.distance((link: NetworkLink) => link.distance);
    linkForce?.strength((link: NetworkLink) => link.strength);

    const chargeForce = graph.d3Force('charge');
    chargeForce?.strength((node: GraphNode) => node.slashed ? -18 : -5);

    graph.d3Force('grid-gravity', (alpha: number) => {
      graphData.nodes.forEach((node) => {
        const x = node.x ?? 0;
        const y = node.y ?? 0;
        const scale = node.slashed ? 1.04 : node.trustScore < 1 ? 1.02 : node.trustScore > 1 ? 0.98 : 1;
        node.vx = (node.vx ?? 0) + (node.gridX * scale - x) * alpha * 0.08;
        node.vy = (node.vy ?? 0) + (node.gridY * scale - y) * alpha * 0.08;
      });
    });

    graph.d3ReheatSimulation();
    graph.resumeAnimation();
  }, [currentRound, graphData, isPreviewRound, maliciousNodeIds, snapshot, width]);

  useEffect(() => {
    graphRef.current?.resumeAnimation();
  }, [isDark, selectedNodeId]);

  const selectedNode = selectedNodeId !== null && snapshot?.trust_scores[selectedNodeId - 1] !== undefined
    ? {
        id: selectedNodeId,
        trustScore: snapshot.trust_scores[selectedNodeId - 1],
        slashed: snapshot.slashed_nodes.includes(selectedNodeId),
        validator: snapshot.validators.includes(selectedNodeId),
        malicious: maliciousNodeIds.includes(selectedNodeId),
      }
    : null;
  const selectedStatus = selectedNode
    ? [selectedNode.malicious && 'Malicious', selectedNode.validator && 'Validator', selectedNode.slashed && 'Slashed']
        .filter(Boolean)
        .join(' · ') || 'Idle'
    : null;
  const handleGraphInteraction = () => {
    shouldAutoFitRef.current = false;
    onInteraction();
  };
  const summaryNodes = Array.from({ length: nodeCount }, (_, index) => ({
    id: index + 1,
    trustScore: isPreviewRound ? 1 : snapshot?.trust_scores[index] ?? 1,
    malicious: maliciousNodeIds.includes(index + 1),
    validator: snapshot?.validators.includes(index + 1) ?? false,
    slashed: snapshot?.slashed_nodes.includes(index + 1) ?? false,
  }));
  const nodeCounts = {
    malicious: summaryNodes.filter((node) => node.malicious).length,
    validator: summaryNodes.filter((node) => node.validator).length,
    idle: summaryNodes.filter((node) => !node.malicious && !node.validator && !node.slashed).length,
    lowTrust: summaryNodes.filter((node) => node.trustScore < 1).length,
    slashed: summaryNodes.filter((node) => node.slashed).length,
  };
  const matchesFilter = (node: NetworkNode, filter: NodeFilter) => {
    if (filter === 'malicious') return node.malicious;
    if (filter === 'validator') return node.validator;
    if (filter === 'idle') return !node.malicious && !node.validator && !node.slashed;
    if (filter === 'low-trust') return node.trustScore < 1;
    if (filter === 'slashed') return node.slashed;
    return true;
  };
  const legend = [
    { key: 'malicious', label: 'Malicious', count: nodeCounts.malicious, color: 'bg-orange-700' },
    { key: 'validator', label: 'Validator', count: nodeCounts.validator, color: 'border-2 border-foreground bg-transparent' },
    { key: 'idle', label: 'Idle', count: nodeCounts.idle, color: 'bg-zinc-500' },
    { key: 'low-trust', label: 'Low trust', count: nodeCounts.lowTrust, color: 'bg-amber-500' },
    { key: 'slashed', label: 'Slashed', count: nodeCounts.slashed, color: 'bg-red-700' },
  ] as const;
  const selectedTrustHistory = selectedNode
    ? history.slice(0, currentRound).map((round) => round.trust_scores[selectedNode.id - 1] ?? 0)
    : [];
  const selectedHistoryMin = selectedTrustHistory.length ? Math.min(...selectedTrustHistory) : 0;
  const selectedHistoryMax = selectedTrustHistory.length ? Math.max(...selectedTrustHistory) : 0;
  const selectedHistoryPoints = selectedTrustHistory.map((score, index) => {
    const x = selectedTrustHistory.length === 1 ? 90 : (index / (selectedTrustHistory.length - 1)) * 180;
    const y = selectedHistoryMax === selectedHistoryMin ? 18 : 32 - ((score - selectedHistoryMin) / (selectedHistoryMax - selectedHistoryMin)) * 28;
    return `${x},${y}`;
  }).join(' ');
  const selectedTrustBand = selectedNode
    ? selectedNode.trustScore < trustFloor
      ? 'Below floor'
      : selectedNode.trustScore < 1
        ? 'Below baseline'
        : selectedNode.trustScore > trustCeil
          ? 'Above ceiling'
          : 'In range'
    : null;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver(([entry]) => {
      setWidth(Math.floor(entry.contentRect.width));
    });
    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    if (!nodeCount || !width) return;

    const frameId = requestAnimationFrame(() => {
      const graph = graphRef.current;
      if (graph && shouldAutoFitRef.current) {
        shouldAutoFitRef.current = false;
        graph.zoomToFit(350, 48);
      }
    });
    return () => cancelAnimationFrame(frameId);
  }, [nodeCount, width]);

  return (
    <div className="space-y-3">
    <div ref={containerRef} className="relative min-h-[360px] w-full overflow-hidden rounded-md bg-muted/40">
      {snapshot && width > 0 ? (
        <>
          <div className="absolute right-3 top-3 z-10 flex items-center gap-1 rounded-md border border-border bg-background/90 p-1 shadow-sm backdrop-blur">
            <HoverHint content="Zoom in to inspect node positions, IDs, and trust colors.">
              <button
                aria-label="Zoom in"
                className="grid size-8 place-items-center rounded-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => {
                  const graph = graphRef.current;
                  if (graph) graph.zoom(Math.min(5, graph.zoom() * 1.4), 180);
                }}
                type="button"
              >
                <ZoomIn aria-hidden="true" className="size-4" />
              </button>
            </HoverHint>
            <HoverHint content="Zoom out to see more of the network at once.">
              <button
                aria-label="Zoom out"
                className="grid size-8 place-items-center rounded-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => {
                  const graph = graphRef.current;
                  if (graph) graph.zoom(Math.max(0.05, graph.zoom() / 1.4), 180);
                }}
                type="button"
              >
                <ZoomOut aria-hidden="true" className="size-4" />
              </button>
            </HoverHint>
            <HoverHint content="Center and fit every node inside the graph canvas.">
              <button
                aria-label="Fit topology to view"
                className="grid size-8 place-items-center rounded-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => {
                  shouldAutoFitRef.current = false;
                  graphRef.current?.zoomToFit(350, 48);
                }}
                type="button"
              >
                <Scan aria-hidden="true" className="size-4" />
              </button>
            </HoverHint>
          </div>
          <ForceGraph2D
            ref={graphRef}
            graphData={graphData}
            width={width}
            height={360}
            backgroundColor={isDark ? '#27272a' : '#f4f4f5'}
            minZoom={0.05}
            maxZoom={5}
            nodeRelSize={4}
            nodeLabel={(node: GraphNode) => `Node ${node.id} · Trust ${node.trustScore.toFixed(3)} · ${node.slashed ? 'Slashed' : node.malicious ? 'Malicious' : node.validator ? 'Validator' : 'Idle'}`}
            nodeColor={(node: GraphNode) => node.slashed ? (isDark ? '#fca5a5' : '#b91c1c') : node.malicious ? (isDark ? '#fdba74' : '#c2410c') : trustColor(node.trustScore, trustFloor, trustCeil, isDark, false)}
            nodeCanvasObject={(node: GraphNode, context: CanvasRenderingContext2D, globalScale: number) => {
              const scale = Math.max(globalScale, 0.01);
              const radius = 5.5 / scale;
              const x = node.x ?? 0;
              const y = node.y ?? 0;
              const matches = matchesFilter(node, nodeFilter);
              const nodeColor = nodeFilter !== 'all' && !matches
                ? (isDark ? '#52525b' : '#a1a1aa')
                : node.slashed
                  ? (isDark ? '#fca5a5' : '#b91c1c')
                  : node.malicious
                    ? (isDark ? '#fdba74' : '#c2410c')
                    : trustColor(node.trustScore, trustFloor, trustCeil, isDark, false);
              context.globalAlpha = matches ? 1 : 0.25;
              context.beginPath();
              context.arc(x, y, radius, 0, 2 * Math.PI);
              context.fillStyle = nodeColor;
              context.fill();
              if (node.validator || node.id === selectedNodeId) {
                context.lineWidth = (node.id === selectedNodeId ? 2.5 : 1.5) / scale;
                context.strokeStyle = node.id === selectedNodeId ? (isDark ? '#ffffff' : '#18181b') : (isDark ? '#e4e4e7' : '#ffffff');
                context.stroke();
              }
              context.font = `${10 / scale}px ui-monospace, SFMono-Regular, monospace`;
              context.textAlign = 'left';
              context.textBaseline = 'middle';
              context.lineWidth = 3 / scale;
              context.strokeStyle = isDark ? '#27272a' : '#f4f4f5';
              context.strokeText(String(node.id), x + radius + 2 / scale, y);
              context.fillStyle = matches ? (isDark ? '#f4f4f5' : '#18181b') : (isDark ? '#71717a' : '#a1a1aa');
              context.fillText(String(node.id), x + radius + 2 / scale, y);
              context.globalAlpha = 1;
            }}
            nodePointerAreaPaint={(node: GraphNode, paintColor: string, context: CanvasRenderingContext2D, globalScale: number) => {
              context.fillStyle = paintColor;
              context.beginPath();
              context.arc(node.x ?? 0, node.y ?? 0, 9 / Math.max(globalScale, 0.01), 0, 2 * Math.PI);
              context.fill();
            }}
            linkColor={(link: GraphLink) => link.severed ? (isDark ? 'rgba(113, 113, 122, 0.28)' : 'rgba(113, 113, 122, 0.2)') : (isDark ? 'rgba(161, 161, 170, 0.48)' : 'rgba(113, 113, 122, 0.4)')}
            linkWidth={(link: GraphLink) => link.severed ? 0.45 : 0.9}
            cooldownTicks={100}
            onEngineStop={() => {
              if (shouldAutoFitRef.current) {
                shouldAutoFitRef.current = false;
                graphRef.current?.zoomToFit(350, 48);
              }
            }}
            onEngineTick={() => {
              if (!shouldAutoFitRef.current) return;
              fitTickCountRef.current += 1;
              if (fitTickCountRef.current >= 30) {
                shouldAutoFitRef.current = false;
                requestAnimationFrame(() => graphRef.current?.zoomToFit(350, 48));
              }
            }}
            onZoom={handleGraphInteraction}
            onNodeClick={(node: GraphNode) => {
              handleGraphInteraction();
              setSelectedNodeId(node.id);
            }}
            onNodeDrag={handleGraphInteraction}
            onBackgroundClick={handleGraphInteraction}
            enableNodeDrag
            enableZoomInteraction
            enablePanInteraction
            enablePointerInteraction
          />
          {selectedNode && (
            <section className="absolute bottom-3 left-3 z-10 w-56 rounded-md border border-border bg-card/95 p-3 text-card-foreground shadow-md backdrop-blur" aria-label={`Validator ${selectedNode.id} details`}>
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="size-3 shrink-0 rounded-full"
                      style={{ backgroundColor: selectedNode.slashed ? (isDark ? '#fca5a5' : '#b91c1c') : selectedNode.malicious ? (isDark ? '#fdba74' : '#c2410c') : trustColor(selectedNode.trustScore, trustFloor, trustCeil, isDark, false) }}
                  />
                  <h3 className="text-sm font-semibold">Node {selectedNode.id}</h3>
                </div>
                <button
                  aria-label="Close validator details"
                  className="grid size-6 shrink-0 place-items-center rounded-sm text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => setSelectedNodeId(null)}
                  type="button"
                >
                  <X aria-hidden="true" className="size-4" />
                </button>
              </div>
              <dl className="space-y-1 text-xs">
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Trust score</dt>
                  <dd className="font-mono tabular-nums">{selectedNode.trustScore.toFixed(3)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Trust band</dt>
                  <dd>{selectedTrustBand}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Status</dt>
                  <dd className={selectedNode.slashed ? 'text-status-alert' : selectedNode.validator ? 'text-status-safe' : undefined}>{selectedStatus}</dd>
                </div>
              </dl>
              <div className="mt-3 border-t border-border pt-2">
                <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                  <span>Trust history</span>
                  <span>{selectedTrustHistory.length} rounds</span>
                </div>
                <svg className="h-9 w-full overflow-visible" viewBox="0 0 180 36" role="img" aria-label={`Trust score history through round ${currentRound}`}>
                  <polyline
                    fill="none"
                    points={selectedHistoryPoints}
                    stroke={trustColor(selectedNode.trustScore, trustFloor, trustCeil, isDark, selectedNode.slashed)}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                  />
                </svg>
              </div>
            </section>
          )}
        </>
      ) : (
        <div className="flex h-[360px] items-center justify-center text-sm text-muted-foreground">
          {snapshot ? 'Preparing network topology...' : 'No round snapshot available.'}
        </div>
      )}
    </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
        <button
          aria-pressed={nodeFilter === 'all'}
          className={`flex min-h-10 items-center justify-between gap-2 rounded-md border px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${nodeFilter === 'all' ? 'border-ring bg-accent text-foreground' : 'border-border bg-card text-muted-foreground hover:bg-muted'}`}
          onClick={() => setNodeFilter('all')}
          type="button"
        >
          <span>All nodes</span>
          <span className="font-mono tabular-nums">{nodeCount}</span>
        </button>
        {legend.map((item) => (
          <button
            aria-pressed={nodeFilter === item.key}
            className={`flex min-h-10 items-center justify-between gap-2 rounded-md border px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${nodeFilter === item.key ? 'border-ring bg-accent text-foreground' : 'border-border bg-card text-muted-foreground hover:bg-muted'}`}
            key={item.key}
            onClick={() => setNodeFilter((current) => current === item.key ? 'all' : item.key)}
            type="button"
          >
            <span className="flex items-center gap-2">
              <i aria-hidden="true" className={`size-2.5 shrink-0 rounded-full ${item.color}`} />
              {item.label}
            </span>
            <span className="font-mono tabular-nums">{item.count}</span>
          </button>
        ))}
      </div>
    </div>
  );
}