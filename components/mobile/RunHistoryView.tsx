/**
 * RunHistoryView Component
 *
 * Displays list of past evaluation runs with pull-to-refresh support.
 * Tapping a run opens the detail view in a bottom sheet.
 */

import React, { useEffect, useState, useRef, useCallback } from 'react';
import type { EvalRun } from '../../types';
import haptics from '../../utils/haptics';

interface RunHistoryViewProps {
  runs: EvalRun[];
  isLoading: boolean;
  onSelectRun: (runId: string) => void;
  onRefresh: () => Promise<void>;
}

// Format relative time
function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// Get run type badge color - Premium gradient badges
function getRunTypeBadge(runType?: string): { bg: string; text: string; glow?: string } {
  switch (runType) {
    case 'quick':
      return { bg: 'bg-blue-500/20 border border-blue-500/30', text: 'text-blue-400', glow: 'shadow-blue-500/20' };
    case 'batch':
      return { bg: 'bg-green-500/20 border border-green-500/30', text: 'text-green-400', glow: 'shadow-green-500/20' };
    case 'matrix':
    case 'compare':
      return { bg: 'bg-purple-500/20 border border-purple-500/30', text: 'text-purple-400', glow: 'shadow-purple-500/20' };
    case 'interaction':
      return { bg: 'bg-pink-500/20 border border-pink-500/30', text: 'text-pink-400', glow: 'shadow-pink-500/20' };
    default:
      return { bg: 'bg-gray-500/20 border border-gray-500/30', text: 'text-gray-400' };
  }
}

// Available run type filters with descriptions
// Database values → User-friendly labels
const RUN_TYPE_FILTERS = [
  { value: null, label: 'All', description: null },
  { value: 'quick', label: 'Quick', description: 'Single scenario test with one AI tutor profile' },
  { value: 'batch', label: 'Batch', description: 'Multiple scenarios run in sequence' },
  { value: 'compare', label: 'Compare', description: 'Profile × Scenario grid comparison with rubric scoring' },
  { value: 'interaction', label: 'Interact', description: 'Simulated learner-tutor dialogue with AI agents on both sides' },
] as const;

type RunTypeFilter = typeof RUN_TYPE_FILTERS[number]['value'];

export const RunHistoryView: React.FC<RunHistoryViewProps> = ({
  runs,
  isLoading,
  onSelectRun,
  onRefresh
}) => {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef<number | null>(null);
  const PULL_THRESHOLD = 80;

  // Filter runs by type (matrix and compare both map to 'compare')
  const filteredRuns = typeFilter
    ? runs.filter(run => {
        const rt = run.runType;
        if (typeFilter === 'compare') {
          return rt === 'compare' || rt === 'matrix';
        }
        return rt === typeFilter;
      })
    : runs;

  // Load runs on mount
  useEffect(() => {
    if (runs.length === 0) {
      onRefresh();
    }
  }, [runs.length, onRefresh]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (containerRef.current?.scrollTop === 0) {
      touchStartY.current = e.touches[0].clientY;
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (touchStartY.current === null) return;
    if (containerRef.current && containerRef.current.scrollTop > 0) {
      touchStartY.current = null;
      return;
    }

    const currentY = e.touches[0].clientY;
    const distance = currentY - touchStartY.current;

    if (distance > 0 && distance < PULL_THRESHOLD * 1.5) {
      e.preventDefault();
      setPullDistance(distance);
    }
  }, []);

  const handleTouchEnd = useCallback(async () => {
    if (pullDistance >= PULL_THRESHOLD && !isRefreshing) {
      haptics.medium();
      setIsRefreshing(true);
      await onRefresh();
      setIsRefreshing(false);
    }
    setPullDistance(0);
    touchStartY.current = null;
  }, [pullDistance, isRefreshing, onRefresh]);

  return (
    <div
      ref={containerRef}
      className="h-full overflow-y-auto"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull-to-refresh indicator - Premium styling */}
      <div
        className="flex items-center justify-center transition-all duration-300 overflow-hidden"
        style={{
          height: isRefreshing ? PULL_THRESHOLD : pullDistance,
          opacity: isRefreshing ? 1 : Math.min(1, pullDistance / PULL_THRESHOLD)
        }}
      >
        <div className="relative">
          {/* Glow ring */}
          <div className={`absolute inset-0 rounded-full bg-[#E63946]/20 ${isRefreshing ? 'animate-ping' : ''}`} />
          <div className="relative w-10 h-10 rounded-full bg-gray-900/80 backdrop-blur-sm border border-white/10
            flex items-center justify-center">
            <svg
              className={`w-5 h-5 text-[#E63946] ${isRefreshing ? 'animate-spin' : ''}`}
              style={{
                transform: isRefreshing ? undefined : `rotate(${(pullDistance / PULL_THRESHOLD) * 360}deg)`
              }}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </div>
        </div>
      </div>

      {/* Type filter bar */}
      <div className="px-3 pt-2 pb-1 flex gap-2 overflow-x-auto scrollbar-hide">
        {RUN_TYPE_FILTERS.map((filter) => {
          const isActive = typeFilter === filter.value;
          const filterBadge = filter.value ? getRunTypeBadge(filter.value) : null;
          const count = filter.value
            ? runs.filter(r => {
                const rt = r.runType;
                if (filter.value === 'compare') {
                  return rt === 'compare' || rt === 'matrix';
                }
                return rt === filter.value;
              }).length
            : runs.length;

          return (
            <button
              key={filter.label}
              type="button"
              onClick={() => {
                haptics.light();
                setTypeFilter(filter.value);
              }}
              className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150
                active:scale-[0.97] ${
                  isActive
                    ? filterBadge
                      ? `${filterBadge.bg} ${filterBadge.text}`
                      : 'bg-white/10 border border-white/20 text-white'
                    : 'bg-gray-900/40 border border-white/5 text-gray-500 hover:text-gray-400'
                }`}
            >
              {filter.label}
              <span className="text-[10px] opacity-60">{count}</span>
            </button>
          );
        })}
      </div>

      {/* Filter description tooltip */}
      {typeFilter && (
        <div className="px-3 pb-2">
          <div className="px-3 py-2 bg-gray-800/40 rounded-lg border border-white/5">
            <span className="text-xs text-gray-400">
              {RUN_TYPE_FILTERS.find(f => f.value === typeFilter)?.description}
            </span>
          </div>
        </div>
      )}

      {/* Loading state - Premium animated */}
      {isLoading && runs.length === 0 && (
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-gradient-to-r from-[#E63946]/20 to-[#d62839]/20 animate-spin"
                style={{ animationDuration: '3s' }} />
              <div className="relative w-16 h-16 rounded-full bg-gray-900/80 backdrop-blur-sm border border-white/10
                flex items-center justify-center">
                <svg className="w-8 h-8 text-[#E63946] animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
            </div>
            <span className="text-sm text-gray-400 font-medium">Loading runs...</span>
          </div>
        </div>
      )}

      {/* Empty state - Enhanced with animation */}
      {!isLoading && filteredRuns.length === 0 && (
        <div className="flex flex-col items-center justify-center h-64 text-gray-500 px-4">
          <div className="relative mb-6">
            <div className="absolute inset-0 rounded-full bg-gradient-to-r from-gray-600/20 via-transparent to-gray-600/20 animate-spin"
              style={{ animationDuration: '8s' }} />
            <div className="relative w-20 h-20 rounded-full bg-gray-900/50 backdrop-blur-sm border border-white/5
              flex items-center justify-center">
              <svg className="w-10 h-10 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <p className="text-sm font-medium text-gray-400">
            {typeFilter ? `No ${typeFilter} runs found` : 'No evaluation runs yet'}
          </p>
          <p className="text-xs text-gray-600 mt-1">
            {typeFilter ? 'Try a different filter or run a test' : 'Run a test to see results here'}
          </p>
        </div>
      )}

      {/* Run list - Glass cards */}
      {filteredRuns.length > 0 && (
        <div className="p-3 space-y-2">
          {filteredRuns.map((run) => {
            const typeBadge = getRunTypeBadge(run.runType);

            return (
              <button
                key={run.id}
                type="button"
                onClick={() => {
                  haptics.light();
                  onSelectRun(run.id);
                }}
                className="w-full p-4 text-left bg-gray-900/60 backdrop-blur-sm border border-white/5
                  rounded-xl active:scale-[0.99] active:bg-gray-800/80 transition-all duration-150"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    {/* Run type and status */}
                    <div className="flex items-center gap-2 mb-2">
                      {run.runType && (
                        <span className={`text-[10px] px-2.5 py-1 rounded-lg font-semibold uppercase tracking-wide
                          ${typeBadge.bg} ${typeBadge.text}`}>
                          {run.runType}
                        </span>
                      )}
                      {run.status === 'running' && (
                        <span className="flex items-center gap-1.5 text-[10px] text-green-400 font-medium">
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                          </span>
                          Running
                        </span>
                      )}
                    </div>

                    {/* Description */}
                    <p className="text-sm font-medium text-white line-clamp-1 mb-2">
                      {run.description || run.id}
                    </p>

                    {/* Profiles - Glass pills */}
                    {run.profiles && run.profiles.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {run.profiles.slice(0, 3).map((profile) => (
                          <span
                            key={profile}
                            className="text-[10px] px-2 py-0.5 bg-white/5 border border-white/10
                              text-gray-400 rounded-full"
                          >
                            {profile}
                          </span>
                        ))}
                        {run.profiles.length > 3 && (
                          <span className="text-[10px] text-gray-500 px-1">
                            +{run.profiles.length - 3}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Stats */}
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      {run.totalTests !== undefined && (
                        <span className="flex items-center gap-1">
                          <span className="w-1 h-1 rounded-full bg-gray-600" />
                          {run.totalTests} tests
                        </span>
                      )}
                      {run.totalScenarios !== undefined && (
                        <span className="flex items-center gap-1">
                          <span className="w-1 h-1 rounded-full bg-gray-600" />
                          {run.totalScenarios} scenarios
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right side - time and chevron */}
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    <span className="text-xs text-gray-500 font-medium">
                      {formatRelativeTime(run.createdAt)}
                    </span>
                    <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center">
                      <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Bottom padding for tab bar */}
      <div className="h-4" />
    </div>
  );
};

export default RunHistoryView;
