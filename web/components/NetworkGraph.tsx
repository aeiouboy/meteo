'use client';

import { useCallback, useEffect, useRef, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { GraphData, GraphNode, GraphLink } from '@/lib/types';

const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), {
  ssr: false,
});

interface Props {
  data: GraphData;
  onNodeClick: (node: GraphNode) => void;
  selectedNode: GraphNode | null;
  visibleCategories: Set<string>;
  searchQuery: string;
}

export default function NetworkGraph({
  data,
  onNodeClick,
  selectedNode,
  visibleCategories,
  searchQuery,
}: Props) {
  const fgRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState<{
    width: number;
    height: number;
  }>({
    width: typeof window !== 'undefined' ? window.innerWidth : 800,
    height: typeof window !== 'undefined' ? window.innerHeight : 600,
  });

  // Track container dimensions with ResizeObserver
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateDimensions = () => {
      setDimensions({
        width: container.clientWidth,
        height: container.clientHeight,
      });
    };

    updateDimensions();

    const observer = new ResizeObserver(updateDimensions);
    observer.observe(container);

    return () => observer.disconnect();
  }, []);

  // Build the set of matching node IDs for search highlighting
  const searchMatchIds = useMemo(() => {
    const ids = new Set<string>();
    if (!searchQuery.trim()) return ids;
    const q = searchQuery.toLowerCase();
    for (const node of data.nodes) {
      if (
        node.label.toLowerCase().includes(q) ||
        node.category.toLowerCase().includes(q) ||
        (node.content && node.content.toLowerCase().includes(q))
      ) {
        ids.add(node.id);
      }
    }
    return ids;
  }, [data.nodes, searchQuery]);

  // Filter graph data based on visible categories and search query
  const filteredData = useMemo(() => {
    const visibleNodes = data.nodes.filter((node) =>
      visibleCategories.has(node.category)
    );
    const visibleNodeIds = new Set(visibleNodes.map((n) => n.id));

    const visibleLinks = data.links.filter((link) => {
      const sourceId =
        typeof link.source === 'string' ? link.source : link.source.id;
      const targetId =
        typeof link.target === 'string' ? link.target : link.target.id;
      return visibleNodeIds.has(sourceId) && visibleNodeIds.has(targetId);
    });

    return { nodes: visibleNodes, links: visibleLinks };
  }, [data.nodes, data.links, visibleCategories]);

  // Configure forces after mount
  useEffect(() => {
    if (fgRef.current) {
      const charge = fgRef.current.d3Force('charge');
      if (charge) {
        charge.strength((node: any) =>
          node.type === 'source' ? -120 : -30
        );
      }

      const link = fgRef.current.d3Force('link');
      if (link) {
        link.distance((link: any) =>
          link.type === 'contains' ? 30 : 100
        );
      }
    }
  }, [filteredData]);

  // Custom node rendering
  const nodeCanvasObject = useCallback(
    (node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const isSource = node.type === 'source';
      const radius = isSource ? 8 : 3;
      const alpha = isSource ? 0.9 : 0.5;
      const color = node.color || '#6b7280';
      const isSelected = selectedNode?.id === node.id;
      const isSearchMatch =
        searchQuery.trim() !== '' && searchMatchIds.has(node.id);

      // Parse color for alpha manipulation
      const fillColor = hexToRgba(color, alpha);

      // Glow effect
      ctx.save();
      if (isSearchMatch) {
        ctx.shadowBlur = isSource ? 25 : 15;
        ctx.shadowColor = '#ffffff';
      } else {
        ctx.shadowBlur = isSource ? 15 : 6;
        ctx.shadowColor = color;
      }

      // Draw filled circle
      ctx.beginPath();
      ctx.arc(node.x!, node.y!, radius, 0, 2 * Math.PI);
      ctx.fillStyle = fillColor;
      ctx.fill();

      ctx.restore();

      // Selected node ring
      if (isSelected) {
        ctx.beginPath();
        ctx.arc(node.x!, node.y!, radius + 2, 0, 2 * Math.PI);
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Label text for source nodes
      if (isSource) {
        const label = node.label || '';
        const fontSize = 4;
        ctx.font = `${fontSize}px Sans-Serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.fillText(label, node.x!, node.y! + radius + 2);
      }
    },
    [selectedNode, searchQuery, searchMatchIds]
  );

  // Node pointer area paint for clickable area
  const nodePointerAreaPaint = useCallback(
    (node: any, color: string, ctx: CanvasRenderingContext2D) => {
      const radius = node.type === 'source' ? 8 : 3;
      ctx.beginPath();
      ctx.arc(node.x!, node.y!, radius + 2, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();
    },
    []
  );

  // Link color
  const linkColor = useCallback((link: any) => {
    if (link.type === 'similarity') {
      const strength =
        typeof link.strength === 'number' ? link.strength : 0.5;
      return `rgba(255,165,0,${strength * 0.5})`;
    }
    return 'rgba(255,255,255,0.08)';
  }, []);

  // Link width
  const linkWidth = useCallback((link: any) => {
    if (link.type === 'similarity') {
      const strength =
        typeof link.strength === 'number' ? link.strength : 0.5;
      return strength * 2;
    }
    return 0.5;
  }, []);

  // Click handler
  const handleNodeClick = useCallback(
    (node: any) => {
      onNodeClick(node as GraphNode);
    },
    [onNodeClick]
  );

  return (
    <div ref={containerRef} className="w-full h-full">
      <ForceGraph2D
        ref={fgRef}
        graphData={filteredData}
        backgroundColor="#0a0a1a"
        width={dimensions.width}
        height={dimensions.height}
        cooldownTicks={100}
        d3AlphaDecay={0.02}
        d3VelocityDecay={0.3}
        nodeRelSize={1}
        nodeCanvasObject={nodeCanvasObject}
        nodePointerAreaPaint={nodePointerAreaPaint}
        onNodeClick={handleNodeClick}
        linkColor={linkColor}
        linkWidth={linkWidth}
        linkDirectionalParticles={2}
        linkDirectionalParticleSpeed={0.004}
        linkDirectionalParticleWidth={1.5}
        linkDirectionalParticleColor={() => 'rgba(255,255,255,0.4)'}
      />
    </div>
  );
}

/**
 * Convert a hex color string to an rgba string with the given alpha.
 */
function hexToRgba(hex: string, alpha: number): string {
  // Handle shorthand or missing hash
  let cleaned = hex.replace('#', '');
  if (cleaned.length === 3) {
    cleaned = cleaned
      .split('')
      .map((c) => c + c)
      .join('');
  }
  if (cleaned.length !== 6) {
    return `rgba(107, 114, 128, ${alpha})`;
  }
  const r = parseInt(cleaned.substring(0, 2), 16);
  const g = parseInt(cleaned.substring(2, 4), 16);
  const b = parseInt(cleaned.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
