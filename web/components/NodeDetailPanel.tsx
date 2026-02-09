'use client';

import { useState } from 'react';
import { GraphNode, GraphLink, CATEGORY_COLORS } from '@/lib/types';

interface Props {
  node: GraphNode | null;
  links: GraphLink[];
  nodes: GraphNode[];
  onClose: () => void;
}

function getLinkNodeId(endpoint: string | GraphNode): string {
  return typeof endpoint === 'string' ? endpoint : endpoint.id;
}

export default function NodeDetailPanel({ node, links, nodes, onClose }: Props) {
  const isVisible = node !== null;
  const [expandedChunks, setExpandedChunks] = useState<Set<string>>(new Set());

  const toggleChunk = (chunkId: string) => {
    setExpandedChunks((prev) => {
      const next = new Set(prev);
      if (next.has(chunkId)) {
        next.delete(chunkId);
      } else {
        next.add(chunkId);
      }
      return next;
    });
  };

  // Find child chunks (for source nodes)
  const childChunks = node?.type === 'source'
    ? links
        .filter(
          (l) =>
            l.type === 'contains' && getLinkNodeId(l.source) === node.id
        )
        .map((l) => nodes.find((n) => n.id === getLinkNodeId(l.target)))
        .filter((n): n is GraphNode => n !== undefined)
    : [];

  // Find related sources via similarity links (for source nodes)
  const relatedSources = node?.type === 'source'
    ? links
        .filter((l) => {
          if (l.type !== 'similarity') return false;
          const srcId = getLinkNodeId(l.source);
          const tgtId = getLinkNodeId(l.target);
          return srcId === node.id || tgtId === node.id;
        })
        .map((l) => {
          const otherId =
            getLinkNodeId(l.source) === node.id
              ? getLinkNodeId(l.target)
              : getLinkNodeId(l.source);
          const otherNode = nodes.find((n) => n.id === otherId);
          return { node: otherNode, strength: l.strength };
        })
        .filter(
          (item): item is { node: GraphNode; strength: number } =>
            item.node !== undefined
        )
    : [];

  // Find parent source (for chunk nodes)
  const parentSource = node?.type === 'chunk'
    ? (() => {
        const containsLink = links.find(
          (l) =>
            l.type === 'contains' && getLinkNodeId(l.target) === node.id
        );
        if (!containsLink) return undefined;
        return nodes.find(
          (n) => n.id === getLinkNodeId(containsLink.source)
        );
      })()
    : undefined;

  const categoryColor = node
    ? CATEGORY_COLORS[node.category] || CATEGORY_COLORS.uncategorized
    : '#6b7280';

  return (
    <div
      className={`fixed top-0 right-0 w-96 h-full bg-gray-900/95 backdrop-blur-sm border-l border-gray-700 z-50 transition-transform duration-300 ease-in-out ${
        isVisible ? 'translate-x-0' : 'translate-x-full'
      }`}
    >
      {node && (
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-start justify-between p-5 border-b border-gray-700">
            <div className="flex-1 min-w-0 pr-3">
              <h2 className="text-lg font-semibold text-white truncate">
                {node.label}
              </h2>
              <div className="flex items-center gap-2 mt-2">
                <span
                  className="inline-block px-2 py-0.5 rounded text-xs font-medium"
                  style={{
                    backgroundColor: `${categoryColor}20`,
                    color: categoryColor,
                    border: `1px solid ${categoryColor}40`,
                  }}
                >
                  {node.category}
                </span>
                <span
                  className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                    node.type === 'source'
                      ? 'bg-blue-900/40 text-blue-300 border border-blue-700/50'
                      : 'bg-purple-900/40 text-purple-300 border border-purple-700/50'
                  }`}
                >
                  {node.type}
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="flex-shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700/50 transition-colors"
              aria-label="Close panel"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {/* Source node details */}
            {node.type === 'source' && (
              <>
                {/* Stats */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gray-800/60 rounded-lg p-3">
                    <div className="text-xs text-gray-400 uppercase tracking-wide">
                      Chunks
                    </div>
                    <div className="text-xl font-semibold text-white mt-1">
                      {node.chunkCount ?? childChunks.length}
                    </div>
                  </div>
                  <div className="bg-gray-800/60 rounded-lg p-3">
                    <div className="text-xs text-gray-400 uppercase tracking-wide">
                      Total Chars
                    </div>
                    <div className="text-xl font-semibold text-white mt-1">
                      {node.totalChars?.toLocaleString() ?? '-'}
                    </div>
                  </div>
                </div>

                {/* Child chunks */}
                {childChunks.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-300 uppercase tracking-wide mb-2">
                      Chunks ({childChunks.length})
                      <span className="text-xs text-gray-500 font-normal ml-2">click to expand</span>
                    </h3>
                    <div className="space-y-2 overflow-y-auto pr-1">
                      {childChunks.map((chunk, index) => {
                        const isExpanded = expandedChunks.has(chunk.id);
                        const isConversationQA = chunk.category === 'conversation' && chunk.content?.startsWith('Question:');
                        return (
                          <div
                            key={chunk.id}
                            className={`bg-gray-800/40 rounded-lg border transition-colors cursor-pointer ${
                              isExpanded
                                ? 'border-gray-500/70 bg-gray-800/70'
                                : 'border-gray-700/50 hover:border-gray-600/50'
                            }`}
                            onClick={() => toggleChunk(chunk.id)}
                          >
                            {/* Chunk header — always visible */}
                            <div className="flex items-center justify-between p-3">
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <span className="text-xs text-gray-500 font-mono flex-shrink-0">
                                  #{index + 1}
                                </span>
                                <span className={`text-sm text-white font-medium ${isExpanded ? '' : 'truncate'}`}>
                                  {chunk.label}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                                {chunk.contentLength !== undefined && (
                                  <span className="text-xs text-gray-500">
                                    {chunk.contentLength.toLocaleString()}c
                                  </span>
                                )}
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  width="14"
                                  height="14"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  className={`text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                                >
                                  <polyline points="6 9 12 15 18 9" />
                                </svg>
                              </div>
                            </div>

                            {/* Collapsed preview — 2 lines */}
                            {!isExpanded && chunk.content && (
                              <div className="px-3 pb-3 -mt-1">
                                <div className="text-xs text-gray-400 line-clamp-2">
                                  {chunk.content}
                                </div>
                              </div>
                            )}

                            {/* Expanded full content */}
                            {isExpanded && chunk.content && (
                              <div className="px-3 pb-3 border-t border-gray-700/50 mt-1 pt-3">
                                {isConversationQA ? (
                                  <div className="space-y-3">
                                    {(() => {
                                      const parts = chunk.content.split('\n\nAnswer:');
                                      const question = parts[0]?.replace('Question: ', '') || '';
                                      const answer = parts[1]?.trim() || '';
                                      return (
                                        <>
                                          <div className="border-l-2 border-cyan-400 pl-3">
                                            <div className="text-xs text-cyan-400 font-medium mb-1">Question</div>
                                            <div className="text-sm text-gray-300">{question}</div>
                                          </div>
                                          <div className="border-l-2 border-green-400 pl-3">
                                            <div className="text-xs text-green-400 font-medium mb-1">Answer</div>
                                            <div className="text-sm text-gray-300 whitespace-pre-wrap">{answer}</div>
                                          </div>
                                        </>
                                      );
                                    })()}
                                  </div>
                                ) : (
                                  <pre className="text-xs text-gray-300 whitespace-pre-wrap break-words font-mono leading-relaxed">
                                    {chunk.content}
                                  </pre>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Related sources */}
                {relatedSources.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-300 uppercase tracking-wide mb-2">
                      Related Sources ({relatedSources.length})
                    </h3>
                    <div className="space-y-2">
                      {relatedSources.map(({ node: relNode, strength }) => (
                        <div
                          key={relNode.id}
                          className="flex items-center justify-between bg-gray-800/40 rounded-lg p-3 border border-gray-700/50"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <div
                              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                              style={{
                                backgroundColor:
                                  CATEGORY_COLORS[relNode.category] ||
                                  CATEGORY_COLORS.uncategorized,
                              }}
                            />
                            <span className="text-sm text-white truncate">
                              {relNode.label}
                            </span>
                          </div>
                          <span className="text-xs text-gray-500 flex-shrink-0 ml-2">
                            {(strength * 100).toFixed(0)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Chunk node details */}
            {node.type === 'chunk' && (
              <>
                {/* Parent source */}
                {parentSource && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-300 uppercase tracking-wide mb-2">
                      Parent Source
                    </h3>
                    <div className="flex items-center gap-2 bg-gray-800/40 rounded-lg p-3 border border-gray-700/50">
                      <div
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{
                          backgroundColor:
                            CATEGORY_COLORS[parentSource.category] ||
                            CATEGORY_COLORS.uncategorized,
                        }}
                      />
                      <span className="text-sm text-white">
                        {parentSource.label}
                      </span>
                    </div>
                  </div>
                )}

                {/* Content length */}
                {node.contentLength !== undefined && (
                  <div className="bg-gray-800/60 rounded-lg p-3">
                    <div className="text-xs text-gray-400 uppercase tracking-wide">
                      Content Length
                    </div>
                    <div className="text-xl font-semibold text-white mt-1">
                      {node.contentLength.toLocaleString()} chars
                    </div>
                  </div>
                )}

                {/* Full content */}
                {node.content && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-300 uppercase tracking-wide mb-2">
                      Content
                    </h3>
                    <div className="bg-gray-800/40 rounded-lg p-3 border border-gray-700/50 max-h-96 overflow-y-auto">
                      {node.category === 'conversation' && node.content.startsWith('Question:') ? (
                        <div className="space-y-3">
                          {(() => {
                            const parts = node.content.split('\n\nAnswer:');
                            const question = parts[0]?.replace('Question: ', '') || '';
                            const answer = parts[1]?.trim() || '';
                            return (
                              <>
                                <div className="border-l-2 border-cyan-400 pl-3">
                                  <div className="text-xs text-cyan-400 font-medium mb-1">Question</div>
                                  <div className="text-sm text-gray-300">{question}</div>
                                </div>
                                <div className="border-l-2 border-green-400 pl-3">
                                  <div className="text-xs text-green-400 font-medium mb-1">Answer</div>
                                  <div className="text-sm text-gray-300 whitespace-pre-wrap">{answer}</div>
                                </div>
                              </>
                            );
                          })()}
                        </div>
                      ) : (
                        <pre className="text-sm text-gray-300 whitespace-pre-wrap break-words font-mono leading-relaxed">
                          {node.content}
                        </pre>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
