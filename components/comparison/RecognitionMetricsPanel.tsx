/**
 * RecognitionMetricsPanel Component
 *
 * Displays recognition-specific metrics that only the recognition profile generates:
 * - Moments generated (recognition events recorded)
 * - Dialectical depth (quality of dialectical engagement)
 * - Synthesis strategies distribution
 */

import React from 'react';

interface SynthesisStrategies {
  ghost_dominates: number;
  learner_dominates: number;
  dialectical_synthesis: number;
}

interface RecognitionMetricsPanelProps {
  momentsGenerated: number;
  avgDialecticalDepth: number;
  synthesisStrategies: SynthesisStrategies;
}

export const RecognitionMetricsPanel: React.FC<RecognitionMetricsPanelProps> = ({
  momentsGenerated,
  avgDialecticalDepth,
  synthesisStrategies,
}) => {
  const totalStrategies =
    synthesisStrategies.ghost_dominates +
    synthesisStrategies.learner_dominates +
    synthesisStrategies.dialectical_synthesis;

  const dialecticalPercent =
    totalStrategies > 0
      ? (synthesisStrategies.dialectical_synthesis / totalStrategies) * 100
      : 0;

  return (
    <div className="bg-gray-900/60 backdrop-blur-sm border border-yellow-500/20 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-yellow-400">⚡</span>
        <span className="text-xs text-yellow-400 font-medium">Recognition Metrics</span>
        <span className="text-[10px] text-gray-500">(recognition profile only)</span>
      </div>

      {/* Key metrics row */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {/* Moments */}
        <div className="text-center">
          <div className="text-2xl font-bold text-yellow-400">{momentsGenerated}</div>
          <div className="text-[10px] text-gray-400">Moments</div>
        </div>

        {/* Dialectical Depth */}
        <div className="text-center">
          <div className="text-2xl font-bold text-green-400">
            {(avgDialecticalDepth * 100).toFixed(0)}%
          </div>
          <div className="text-[10px] text-gray-400">Dialectical Depth</div>
        </div>

        {/* Synthesis Rate */}
        <div className="text-center">
          <div className="text-2xl font-bold text-purple-400">{dialecticalPercent.toFixed(0)}%</div>
          <div className="text-[10px] text-gray-400">Synthesis Rate</div>
        </div>
      </div>

      {/* Synthesis strategy breakdown */}
      {totalStrategies > 0 && (
        <div className="space-y-2">
          <div className="text-[10px] text-gray-500 mb-2">Synthesis Strategies</div>

          {/* Dialectical Synthesis */}
          <div className="flex items-center gap-2">
            <div className="w-20 text-[10px] text-gray-400">Dialectical</div>
            <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-yellow-500 to-green-500 rounded-full"
                style={{ width: `${dialecticalPercent}%` }}
              />
            </div>
            <div className="w-8 text-[10px] text-green-400 text-right">
              {synthesisStrategies.dialectical_synthesis}
            </div>
          </div>

          {/* Learner Dominates */}
          <div className="flex items-center gap-2">
            <div className="w-20 text-[10px] text-gray-400">Learner</div>
            <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full"
                style={{
                  width: `${totalStrategies > 0 ? (synthesisStrategies.learner_dominates / totalStrategies) * 100 : 0}%`,
                }}
              />
            </div>
            <div className="w-8 text-[10px] text-blue-400 text-right">
              {synthesisStrategies.learner_dominates}
            </div>
          </div>

          {/* Ghost Dominates */}
          <div className="flex items-center gap-2">
            <div className="w-20 text-[10px] text-gray-400">Ghost</div>
            <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-red-500 rounded-full"
                style={{
                  width: `${totalStrategies > 0 ? (synthesisStrategies.ghost_dominates / totalStrategies) * 100 : 0}%`,
                }}
              />
            </div>
            <div className="w-8 text-[10px] text-red-400 text-right">
              {synthesisStrategies.ghost_dominates}
            </div>
          </div>
        </div>
      )}

      {totalStrategies === 0 && momentsGenerated === 0 && (
        <div className="text-center py-2">
          <div className="text-sm text-gray-500">No recognition events recorded</div>
          <div className="text-[10px] text-gray-600 mt-1">
            Run test to generate recognition metrics
          </div>
        </div>
      )}
    </div>
  );
};

export default RecognitionMetricsPanel;
