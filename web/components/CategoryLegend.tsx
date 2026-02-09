'use client';

import { CATEGORY_COLORS } from '@/lib/types';

interface Props {
  categories: Record<string, string>;
  visibleCategories: Set<string>;
  onToggle: (category: string) => void;
  categoryCounts: Record<string, number>;
}

export default function CategoryLegend({
  categories,
  visibleCategories,
  onToggle,
  categoryCounts,
}: Props) {
  const categoryKeys = Object.keys(categories);

  if (categoryKeys.length === 0) return null;

  return (
    <div className="fixed sm:bottom-6 bottom-2 sm:left-6 left-2 z-40 bg-gray-900/80 backdrop-blur-sm rounded-xl p-4 border border-gray-700/50 max-h-[40vh] overflow-y-auto">
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
        Categories
      </h3>
      <div className="space-y-1.5">
        {categoryKeys.map((category) => {
          const isVisible = visibleCategories.has(category);
          const color =
            CATEGORY_COLORS[category] || CATEGORY_COLORS.uncategorized;
          const count = categoryCounts[category] ?? 0;

          return (
            <button
              key={category}
              onClick={() => onToggle(category)}
              className={`flex items-center gap-2.5 w-full px-2 py-1.5 rounded-lg text-left transition-all duration-150 hover:bg-gray-700/40 group ${
                isVisible ? 'opacity-100' : 'opacity-40'
              }`}
            >
              <span
                className="w-3 h-3 rounded-full flex-shrink-0 transition-opacity"
                style={{ backgroundColor: color }}
              />
              <span
                className={`text-sm text-gray-200 flex-1 transition-all ${
                  isVisible ? '' : 'line-through'
                }`}
              >
                {category}
              </span>
              <span className="text-xs text-gray-500 tabular-nums">
                {count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
