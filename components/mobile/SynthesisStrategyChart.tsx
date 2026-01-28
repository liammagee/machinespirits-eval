/**
 * SynthesisStrategyChart Component
 *
 * Horizontal bars showing distribution of synthesis strategies:
 * - Ghost Dominates (red) - Superego/authority wins
 * - Learner Dominates (blue) - Learner needs prioritized
 * - Dialectical Synthesis (gold/green) - True mutual recognition
 */

import React from 'react';

interface SynthesisStrategyCounts {
  ghost_dominates: number;
  learner_dominates: number;
  dialectical_synthesis: number;
}

interface SynthesisStrategyChartProps {
  counts: SynthesisStrategyCounts;
}

export const SynthesisStrategyChart: React.FC<SynthesisStrategyChartProps> = ({
  counts,
}) => {
  const total =
    counts.ghost_dominates + counts.learner_dominates + counts.dialectical_synthesis;

  if (total === 0) {
    return (
      <div className="bg-gray-900/60 backdrop-blur-sm border border-white/5 rounded-xl p-4">
        <div className="text-xs text-gray-400 mb-3">Synthesis Strategies</div>
        <div className="text-sm text-gray-500 text-center py-4">
          No synthesis data recorded
        </div>
      </div>
    );
  }

  const strategies = [
    {
      key: 'dialectical_synthesis',
      label: 'Dialectical Synthesis',
      count: counts.dialectical_synthesis,
      percentage: (counts.dialectical_synthesis / total) * 100,
      gradient: 'from-yellow-500 to-green-500',
      bgColor: 'bg-yellow-500/20',
      borderColor: 'border-yellow-500/30',
      textColor: 'text-yellow-400',
      icon: '⚡',
      description: 'Mutual recognition achieved',
    },
    {
      key: 'learner_dominates',
      label: 'Learner Dominates',
      count: counts.learner_dominates,
      percentage: (counts.learner_dominates / total) * 100,
      gradient: 'from-blue-500 to-blue-400',
      bgColor: 'bg-blue-500/20',
      borderColor: 'border-blue-500/30',
      textColor: 'text-blue-400',
      icon: '🎯',
      description: 'Learner needs prioritized',
    },
    {
      key: 'ghost_dominates',
      label: 'Ghost Dominates',
      count: counts.ghost_dominates,
      percentage: (counts.ghost_dominates / total) * 100,
      gradient: 'from-red-500 to-red-400',
      bgColor: 'bg-red-500/20',
      borderColor: 'border-red-500/30',
      textColor: 'text-red-400',
      icon: '👻',
      description: 'Authority/superego wins',
    },
  ];

  // Find max for scaling
  const maxCount = Math.max(
    counts.ghost_dominates,
    counts.learner_dominates,
    counts.dialectical_synthesis
  );

  return (
    <div className="bg-gray-900/60 backdrop-blur-sm border border-white/5 rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="text-xs text-gray-400">Synthesis Strategies</div>
        <div className="text-xs text-gray-500">{total} total</div>
      </div>

      <div className="space-y-3">
        {strategies.map((strategy) => (
          <div key={strategy.key} className="space-y-1.5">
            {/* Label row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm">{strategy.icon}</span>
                <span className="text-xs text-gray-300">{strategy.label}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs ${strategy.textColor} font-medium`}>
                  {strategy.count}
                </span>
                <span className="text-xs text-gray-500">
                  ({strategy.percentage.toFixed(0)}%)
                </span>
              </div>
            </div>

            {/* Progress bar */}
            <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
              <div
                className={`h-full bg-gradient-to-r ${strategy.gradient} rounded-full transition-all duration-500`}
                style={{ width: `${maxCount > 0 ? (strategy.count / maxCount) * 100 : 0}%` }}
              />
            </div>

            {/* Description */}
            <div className="text-[10px] text-gray-600">{strategy.description}</div>
          </div>
        ))}
      </div>

      {/* Ideal indicator */}
      {counts.dialectical_synthesis > 0 && (
        <div className="mt-4 pt-3 border-t border-white/5">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-yellow-400">
              {((counts.dialectical_synthesis / total) * 100).toFixed(0)}%
            </span>
            <span className="text-gray-500">of moments achieve dialectical synthesis</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default SynthesisStrategyChart;
