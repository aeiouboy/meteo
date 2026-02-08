import { GraphData, GraphNode } from './types';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;

export async function fetchGraphData(): Promise<GraphData> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/graph-data`);
  if (!res.ok) {
    throw new Error(`Failed to fetch graph data: ${res.statusText}`);
  }
  const data = await res.json();

  // Add computed properties for react-force-graph
  const nodes: GraphNode[] = data.nodes.map((node: GraphNode) => ({
    ...node,
    val: node.type === 'source' ? 8 : 3,
  }));

  return {
    nodes,
    links: data.links,
    stats: data.stats,
  };
}
