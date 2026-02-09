'use client';

interface Props {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  stats: {
    totalDocs: number;
    totalSources: number;
    categories: Record<string, string>;
  };
  matchCount?: number;
  isSearching?: boolean;
}

export default function SearchFilter({
  searchQuery,
  onSearchChange,
  stats,
  matchCount = 0,
  isSearching = false,
}: Props) {
  const categoryCount = Object.keys(stats.categories).length;

  return (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-40 bg-gray-900/80 backdrop-blur-sm rounded-xl p-3 border border-gray-700/50 w-[calc(100vw-3rem)] max-w-96">
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none"
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search nodes..."
          className="w-full bg-gray-800 border border-gray-700 text-white placeholder-gray-500 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-colors"
        />
        {searchQuery.length > 0 && (
          <button
            onClick={() => onSearchChange('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
            aria-label="Clear search"
          >
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
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>
      <p className={`text-xs mt-2 text-center ${
        isSearching && matchCount === 0 ? 'text-amber-400' : 'text-gray-500'
      }`}>
        {isSearching
          ? matchCount > 0
            ? `Found ${matchCount} matching node${matchCount !== 1 ? 's' : ''}`
            : 'No matching nodes found'
          : `${stats.totalDocs} chunks from ${stats.totalSources} sources across ${categoryCount} categories`
        }
      </p>
    </div>
  );
}
