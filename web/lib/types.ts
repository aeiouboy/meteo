export interface GraphNode {
  id: string;
  type: 'source' | 'chunk';
  label: string;
  category: string;
  color: string;
  chunkCount?: number;
  totalChars?: number;
  sourceId?: string;
  contentLength?: number;
  content?: string;
  // react-force-graph computed properties
  val?: number;
  x?: number;
  y?: number;
}

export interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
  type: 'contains' | 'similarity';
  strength: number;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
  stats: {
    totalDocs: number;
    totalSources: number;
    categories: Record<string, string>;
  };
}

export const CATEGORY_COLORS: Record<string, string> = {
  schema: '#3b82f6',
  process: '#22c55e',
  troubleshooting: '#f59e0b',
  inventory: '#a855f7',
  uncategorized: '#6b7280',
};
