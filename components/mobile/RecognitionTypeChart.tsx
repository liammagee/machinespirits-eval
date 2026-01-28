/**
 * RecognitionTypeChart Component
 *
 * Horizontal stacked bar showing distribution of recognition types:
 * - Pedagogical (green) - Learning-focused recognition moments
 * - Metacognitive (blue) - Reflection on learning process
 * - Existential (purple) - Deep identity/meaning moments
 */

import React from 'react';

interface RecognitionTypeCounts {
  pedagogical: number;
  metacognitive: number;
  existential: number;
}

interface RecognitionTypeChartProps {
  counts: RecognitionTypeCounts;
  showLegend?: boolean;
}

export const RecognitionTypeChart: React.FC<RecognitionTypeChartProps> = ({
  counts,
  showLegend = true,
}) => {
  const total = counts.pedagogical + counts.metacognitive + counts.existential;

  if (total === 0) {
    return (
      <div className="bg-gray-900/60 backdrop-blur-sm border border-white/5 rounded-xl p-4">
        <div className="text-xs text-gray-400 mb-3">Recognition Types</div>
        <div className="text-sm text-gray-500 text-center py-4">
          No recognition moments recorded
        </div>
      </div>
    );
  }

  const percentages = {
    pedagogical: (counts.pedagogical / total) * 100,
    metacognitive: (counts.metacognitive / total) * 100,
    existential: (counts.existential / total) * 100,
  };

  const types = [
    {
      key: 'pedagogical',
      label: 'Pedagogical',
      count: counts.pedagogical,
      percentage: percentages.pedagogical,
      color: 'bg-green-500',
      textColor: 'text-green-400',
      description: 'Learning-focused',
    },
    {
      key: 'metacognitive',
      label: 'Metacognitive',
      count: counts.metacognitive,
      percentage: percentages.metacognitive,
      color: 'bg-blue-500',
      textColor: 'text-blue-400',
      description: 'Process reflection',
    },
    {
      key: 'existential',
      label: 'Existential',
      count: counts.existential,
      percentage: percentages.existential,
      color: 'bg-purple-500',
      textColor: 'text-purple-400',
      description: 'Identity/meaning',
    },
  ];

  return (
    <div className="bg-gray-900/60 backdrop-blur-sm border border-white/5 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs text-gray-400">Recognition Types</div>
        <div className="text-xs text-gray-500">{total} total</div>
      </div>

      {/* Stacked bar */}
      <div className="h-6 rounded-full overflow-hidden flex bg-gray-800">
        {types.map(
          (type) =>
            type.percentage > 0 && (
              <div
                key={type.key}
                className={`${type.color} transition-all duration-500`}
                style={{ width: `${type.percentage}%` }}
                title={`${type.label}: ${type.count} (${type.percentage.toFixed(1)}%)`}
              />
            )
        )}
      </div>

      {/* Legend */}
      {showLegend && (
        <div className="mt-4 space-y-2">
          {types.map((type) => (
            <div key={type.key} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${type.color}`} />
                <span className="text-xs text-gray-300">{type.label}</span>
                <span className="text-xs text-gray-600">{type.description}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs ${type.textColor} font-medium`}>
                  {type.count}
                </span>
                <span className="text-xs text-gray-500">
                  ({type.percentage.toFixed(0)}%)
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RecognitionTypeChart;
