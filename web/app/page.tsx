'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { GraphData, GraphNode, CATEGORY_COLORS } from '@/lib/types';
import { fetchGraphData } from '@/lib/graph-data';
import NetworkGraph from '@/components/NetworkGraph';
import NodeDetailPanel from '@/components/NodeDetailPanel';
import CategoryLegend from '@/components/CategoryLegend';
import SearchFilter from '@/components/SearchFilter';

export default function Home() {
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [visibleCategories, setVisibleCategories] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch graph data on mount
  useEffect(() => {
    fetchGraphData()
      .then((data) => {
        setGraphData(data);
        // Initialize all categories as visible
        const cats = new Set(Object.keys(data.stats.categories));
        setVisibleCategories(cats);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  // Debounce search query (300ms)
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Toggle category visibility
  const handleCategoryToggle = useCallback((category: string) => {
    setVisibleCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  }, []);

  // Node click handler
  const handleNodeClick = useCallback((node: GraphNode) => {
    setSelectedNode((prev) => (prev?.id === node.id ? null : node));
  }, []);

  // Close detail panel
  const handleClosePanel = useCallback(() => {
    setSelectedNode(null);
  }, []);

  // Compute category chunk counts
  const categoryCounts = useMemo(() => {
    if (!graphData) return {};
    const counts: Record<string, number> = {};
    for (const node of graphData.nodes) {
      if (node.type === 'chunk') {
        counts[node.category] = (counts[node.category] || 0) + 1;
      }
    }
    return counts;
  }, [graphData]);

  // Compute search match count
  const searchMatchCount = useMemo(() => {
    if (!graphData || !debouncedSearch) return 0;
    const q = debouncedSearch.toLowerCase();
    return graphData.nodes.filter((node) => {
      const label = (node.label || '').toLowerCase();
      const category = (node.category || '').toLowerCase();
      const content = (node.content || '').toLowerCase();
      return label.includes(q) || category.includes(q) || content.includes(q);
    }).length;
  }, [graphData, debouncedSearch]);

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen w-screen bg-[#0a0a1a]">
        <div className="text-center">
          <div className="animate-pulse text-xl text-gray-400">
            Loading knowledge graph...
          </div>
          <div className="mt-2 text-sm text-gray-600">
            Fetching nodes and edges from Supabase
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !graphData) {
    return (
      <div className="flex items-center justify-center h-screen w-screen bg-[#0a0a1a]">
        <div className="text-center text-red-400">
          <div className="text-xl">Failed to load graph</div>
          <div className="mt-2 text-sm text-gray-500">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <main className="relative w-screen h-screen overflow-hidden">
      {/* Full-screen graph background */}
      <NetworkGraph
        data={graphData}
        onNodeClick={handleNodeClick}
        selectedNode={selectedNode}
        visibleCategories={visibleCategories}
        searchQuery={debouncedSearch}
      />

      {/* Search bar - top center */}
      <SearchFilter
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        stats={graphData.stats}
        matchCount={searchMatchCount}
        isSearching={debouncedSearch.length > 0}
      />

      {/* Category legend - bottom left */}
      <CategoryLegend
        categories={graphData.stats.categories}
        visibleCategories={visibleCategories}
        onToggle={handleCategoryToggle}
        categoryCounts={categoryCounts}
      />

      {/* Node detail panel - right side */}
      <NodeDetailPanel
        node={selectedNode}
        links={graphData.links}
        nodes={graphData.nodes}
        onClose={handleClosePanel}
      />
    </main>
  );
}
