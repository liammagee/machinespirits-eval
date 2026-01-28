/**
 * RunDetailView Component
 *
 * Detailed view of a single evaluation run, displayed in a bottom sheet.
 * Shows stats, dimension breakdown, and individual results.
 */

import React, { useState } from 'react';
import type { RunDetails } from '../../../hooks/useEvalData';
import type { EvalQuickTestResult } from '../../../types';
import { DimensionBreakdown } from './DimensionBreakdown';
import { ScoreRadial } from './ScoreRadial';
import haptics from '../../../utils/haptics';

interface RunDetailViewProps {
  details: RunDetails;
  onViewDialogue: (logDate: string) => void;
  onClose: () => void;
}

// Format date for display
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

// Calculate average score from results
function getAverageScore(results: EvalQuickTestResult[]): number | null {
  const scores = results.filter(r => r.overallScore !== null).map(r => r.overallScore as number);
  if (scores.length === 0) return null;
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

// Count passed tests
function getPassedCount(results: EvalQuickTestResult[]): number {
  return results.filter(r => r.passed).length;
}

export const RunDetailView: React.FC<RunDetailViewProps> = ({
  details,
  onViewDialogue,
  onClose
}) => {
  const [selectedTab, setSelectedTab] = useState<'overview' | 'results'>('overview');
  const [expandedResult, setExpandedResult] = useState<string | null>(null);

  const { run, stats, results } = details;
  const avgScore = getAverageScore(results);
  const passedCount = getPassedCount(results);
  const passRate = results.length > 0 ? (passedCount / results.length) * 100 : 0;

  return (
    <div className="pb-4">
      {/* Run Header */}
      <div className="px-4 py-3 border-b border-gray-800">
        <p className="text-sm text-white line-clamp-2">{run.description || run.id}</p>
        <p className="text-xs text-gray-500 mt-1">{formatDate(run.createdAt)}</p>
      </div>

      {/* Tab Switcher */}
      <div className="flex border-b border-gray-800">
        <button
          type="button"
          onClick={() => {
            haptics.light();
            setSelectedTab('overview');
          }}
          className={`flex-1 py-3 text-sm font-medium transition-colors
            ${selectedTab === 'overview'
              ? 'text-[#E63946] border-b-2 border-[#E63946]'
              : 'text-gray-400'
            }`}
        >
          Overview
        </button>
        <button
          type="button"
          onClick={() => {
            haptics.light();
            setSelectedTab('results');
          }}
          className={`flex-1 py-3 text-sm font-medium transition-colors
            ${selectedTab === 'results'
              ? 'text-[#E63946] border-b-2 border-[#E63946]'
              : 'text-gray-400'
            }`}
        >
          Results ({results.length})
        </button>
      </div>

      {/* Overview Tab */}
      {selectedTab === 'overview' && (
        <div className="p-4 space-y-6">
          {/* Score Summary */}
          <div className="flex items-center justify-center">
            <div className="flex flex-col items-center">
              <ScoreRadial score={avgScore} passed={passRate >= 70} size={120} />
              <p className="text-xs text-gray-400 mt-2">
                {passedCount}/{results.length} passed ({passRate.toFixed(0)}%)
              </p>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-800/50 rounded-lg p-3">
              <div className="text-xl font-semibold text-white">{run.totalTests || results.length}</div>
              <div className="text-xs text-gray-400">Total Tests</div>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-3">
              <div className="text-xl font-semibold text-white">{run.totalScenarios || '-'}</div>
              <div className="text-xs text-gray-400">Scenarios</div>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-3">
              <div className="text-xl font-semibold text-white">{run.totalConfigurations || '-'}</div>
              <div className="text-xs text-gray-400">Configurations</div>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-3">
              <div className="text-xl font-semibold text-white">
                {stats.length > 0 && stats[0].avgLatencyMs
                  ? `${(stats[0].avgLatencyMs / 1000).toFixed(1)}s`
                  : '-'}
              </div>
              <div className="text-xs text-gray-400">Avg Latency</div>
            </div>
          </div>

          {/* Profile Stats */}
          {stats.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-gray-300">Profile Performance</h4>
              {stats.map((stat, i) => (
                <div key={i} className="bg-gray-800/30 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-white">{stat.model}</span>
                    <span className={`text-sm font-medium ${stat.avgScore && stat.avgScore >= 70 ? 'text-green-400' : 'text-red-400'}`}>
                      {stat.avgScore?.toFixed(1) || 'N/A'}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500">
                    {stat.successfulTests}/{stat.totalTests} passed • {(stat.successRate * 100).toFixed(0)}% success
                  </div>
                  {stat.dimensions && (
                    <div className="mt-3">
                      <DimensionBreakdown scores={stat.dimensions} compact />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Results Tab */}
      {selectedTab === 'results' && (
        <div className="divide-y divide-gray-800">
          {results.map((result, i) => {
            const isExpanded = expandedResult === `${result.scenarioId}-${i}`;

            return (
              <div key={`${result.scenarioId}-${i}`}>
                <button
                  type="button"
                  onClick={() => {
                    haptics.light();
                    setExpandedResult(isExpanded ? null : `${result.scenarioId}-${i}`);
                  }}
                  className="w-full p-4 text-left active:bg-gray-800/30 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`w-2 h-2 rounded-full ${result.passed ? 'bg-green-400' : 'bg-red-400'}`} />
                        <span className="text-sm text-white line-clamp-1">{result.scenarioName}</span>
                      </div>
                      <p className="text-xs text-gray-500">{result.profile}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-lg font-semibold ${result.passed ? 'text-green-400' : 'text-red-400'}`}>
                        {result.overallScore?.toFixed(0) || '-'}
                      </span>
                      <svg
                        className={`w-4 h-4 text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </button>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="px-4 pb-4 space-y-4 bg-gray-900/30">
                    {/* Metrics */}
                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-gray-800/50 rounded p-2 text-center">
                        <div className="text-sm font-medium text-white">
                          {result.latencyMs ? `${(result.latencyMs / 1000).toFixed(1)}s` : '-'}
                        </div>
                        <div className="text-[10px] text-gray-500">Latency</div>
                      </div>
                      <div className="bg-gray-800/50 rounded p-2 text-center">
                        <div className="text-sm font-medium text-white">
                          {result.totalTokens?.toLocaleString() || '-'}
                        </div>
                        <div className="text-[10px] text-gray-500">Tokens</div>
                      </div>
                      <div className="bg-gray-800/50 rounded p-2 text-center">
                        <div className="text-sm font-medium text-white">
                          {result.dialogueRounds || '-'}
                        </div>
                        <div className="text-[10px] text-gray-500">Rounds</div>
                      </div>
                    </div>

                    {/* Dimension Scores */}
                    {result.scores && (
                      <DimensionBreakdown scores={result.scores} compact />
                    )}

                    {/* Validation */}
                    {result.validation && (
                      <div className="flex gap-4 text-xs">
                        <span className={result.validation.passesRequired ? 'text-green-400' : 'text-red-400'}>
                          {result.validation.passesRequired ? '✓' : '✗'} Required
                        </span>
                        <span className={result.validation.passesForbidden ? 'text-green-400' : 'text-red-400'}>
                          {result.validation.passesForbidden ? '✓' : '✗'} Forbidden
                        </span>
                      </div>
                    )}

                    {/* Suggestions count */}
                    {result.suggestions && result.suggestions.length > 0 && (
                      <p className="text-xs text-gray-500">
                        {result.suggestions.length} suggestion{result.suggestions.length !== 1 ? 's' : ''} generated
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default RunDetailView;
