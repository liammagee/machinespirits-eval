/**
 * LogsView Component
 *
 * Browse and view dialogue transcripts by date.
 * Supports date selection, pagination, and expandable dialogue entries.
 */

import React, { useEffect, useState, useCallback } from 'react';
import type { EvalDialogue, EvalDialogueEntry } from '../../types';
import haptics from '../../utils/haptics';

interface LogsViewProps {
  logDates: string[];
  isLoading: boolean;
  onLoadDates: () => Promise<void>;
  onLoadDialogues: (date: string, offset?: number, limit?: number) => Promise<{
    dialogues: EvalDialogue[];
    total: number;
    hasMore: boolean;
  }>;
  onLoadDialogueById: (dialogueId: string) => Promise<EvalDialogue | null>;
}

// Format time from ISO string
function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit'
  });
}

// Format date for display
function formatDateLabel(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (dateStr === today.toISOString().split('T')[0]) return 'Today';
  if (dateStr === yesterday.toISOString().split('T')[0]) return 'Yesterday';

  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  });
}

// Agent icon SVG components for consistent styling
const AgentIcons = {
  ego: (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
    </svg>
  ),
  superego: (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
    </svg>
  ),
  user: (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  ),
  default: (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
};

// Get agent badge color - Premium styling with SVG icons
function getAgentBadge(agent: string): { bg: string; text: string; icon: React.ReactNode } {
  switch (agent) {
    case 'ego':
      return { bg: 'bg-blue-500/20 border border-blue-500/30', text: 'text-blue-400', icon: AgentIcons.ego };
    case 'superego':
      return { bg: 'bg-green-500/20 border border-green-500/30', text: 'text-green-400', icon: AgentIcons.superego };
    case 'user':
      return { bg: 'bg-purple-500/20 border border-purple-500/30', text: 'text-purple-400', icon: AgentIcons.user };
    default:
      return { bg: 'bg-gray-500/20 border border-gray-500/30', text: 'text-gray-400', icon: AgentIcons.default };
  }
}

// Dialogue Entry Component - Premium glass styling
const DialogueEntryItem: React.FC<{ entry: EvalDialogueEntry; index: number }> = ({ entry, index }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const agentBadge = getAgentBadge(entry.agent);

  return (
    <div className="border-b border-white/5 last:border-b-0">
      <button
        type="button"
        onClick={() => {
          haptics.light();
          setIsExpanded(!isExpanded);
        }}
        className="w-full p-3 text-left active:bg-white/5 transition-all duration-150"
      >
        <div className="flex items-start gap-3">
          {/* Step number - Gradient ring */}
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-800/80 border border-white/10
            text-gray-400 text-xs font-semibold flex items-center justify-center">
            {index + 1}
          </div>

          <div className="flex-1 min-w-0">
            {/* Agent and action */}
            <div className="flex items-center gap-2 mb-1.5">
              <span className={`inline-flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-lg font-semibold uppercase tracking-wide
                ${agentBadge.bg} ${agentBadge.text}`}>
                {agentBadge.icon}
                <span>{entry.agent}</span>
              </span>
              {entry.action && (
                <span className="text-xs text-gray-500 font-medium">{entry.action}</span>
              )}
            </div>

            {/* Summary info */}
            <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
              {entry.latencyMs && (
                <span className="flex items-center gap-1">
                  <span className="w-1 h-1 rounded-full bg-gray-600" />
                  {entry.latencyMs}ms
                </span>
              )}
              {entry.model && (
                <span className="flex items-center gap-1">
                  <span className="w-1 h-1 rounded-full bg-gray-600" />
                  {entry.model}
                </span>
              )}
              {entry.suggestions && entry.suggestions.length > 0 && (
                <span className="text-blue-400 font-medium">{entry.suggestions.length} suggestions</span>
              )}
              {entry.verdict && (
                <span className={`font-medium ${entry.verdict.approved ? 'text-green-400' : 'text-yellow-400'}`}>
                  {entry.verdict.approved ? '✓ Approved' : '⟳ Revise'}
                </span>
              )}
            </div>
          </div>

          {/* Expand indicator */}
          <div className={`w-6 h-6 rounded-full bg-white/5 flex items-center justify-center
            transition-all duration-200 ${isExpanded ? 'bg-white/10' : ''}`}>
            <svg
              className={`w-3 h-3 text-gray-500 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </button>

      {/* Expanded content - Glass panels */}
      {isExpanded && (
        <div className="px-3 pb-4 pl-14 space-y-3">
          {/* Suggestions */}
          {entry.suggestions && entry.suggestions.length > 0 && (
            <div className="space-y-2">
              <h5 className="text-xs text-gray-400 font-semibold uppercase tracking-wide">Suggestions</h5>
              {entry.suggestions.map((s, i) => (
                <div key={i} className="bg-white/5 backdrop-blur-sm border border-white/5 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <span className={`text-[10px] px-2 py-0.5 rounded-md font-medium
                      ${s.priority === 'high' ? 'bg-red-500/20 border border-red-500/30 text-red-400' :
                        s.priority === 'medium' ? 'bg-yellow-500/20 border border-yellow-500/30 text-yellow-400' :
                          'bg-gray-500/20 border border-gray-500/30 text-gray-400'}`}>
                      {s.type}
                    </span>
                    <div className="flex-1">
                      <div className="text-xs text-white font-medium">{s.title}</div>
                      <div className="text-[10px] text-gray-500 mt-1 line-clamp-2">{s.message}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Verdict */}
          {entry.verdict && (
            <div className="bg-white/5 backdrop-blur-sm border border-white/5 rounded-lg p-3 space-y-1">
              <h5 className="text-xs text-gray-400 font-semibold uppercase tracking-wide">Verdict</h5>
              <div className={`text-sm font-medium ${entry.verdict.approved ? 'text-green-400' : 'text-yellow-400'}`}>
                {entry.verdict.approved ? '✓ Approved' : '⟳ Requires Revision'}
                {entry.verdict.confidence !== undefined && (
                  <span className="text-gray-500 text-xs ml-2 font-normal">
                    ({(entry.verdict.confidence * 100).toFixed(0)}% confidence)
                  </span>
                )}
              </div>
              {entry.verdict.feedback && (
                <p className="text-xs text-gray-500 mt-1">{entry.verdict.feedback}</p>
              )}
            </div>
          )}

          {/* Pre-analysis */}
          {entry.preAnalysis && entry.preAnalysis.isPreAnalysis && (
            <div className="bg-white/5 backdrop-blur-sm border border-white/5 rounded-lg p-3 space-y-1">
              <h5 className="text-xs text-gray-400 font-semibold uppercase tracking-wide">Pre-Analysis</h5>
              {entry.preAnalysis.overallCaution && (
                <p className="text-xs text-gray-500">{entry.preAnalysis.overallCaution}</p>
              )}
            </div>
          )}

          {/* Token usage */}
          {(entry.inputTokens || entry.outputTokens) && (
            <div className="flex gap-4 text-[10px] text-gray-500">
              {entry.inputTokens && (
                <span className="flex items-center gap-1.5">
                  <span className="text-gray-600">↓</span>
                  In: {entry.inputTokens.toLocaleString()}
                </span>
              )}
              {entry.outputTokens && (
                <span className="flex items-center gap-1.5">
                  <span className="text-gray-600">↑</span>
                  Out: {entry.outputTokens.toLocaleString()}
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export const LogsView: React.FC<LogsViewProps> = ({
  logDates,
  isLoading,
  onLoadDates,
  onLoadDialogues
}) => {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dialogues, setDialogues] = useState<EvalDialogue[]>([]);
  const [expandedDialogue, setExpandedDialogue] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [isLoadingDialogues, setIsLoadingDialogues] = useState(false);
  const LIMIT = 10;

  // Load dates on mount
  useEffect(() => {
    if (logDates.length === 0) {
      onLoadDates();
    }
  }, [logDates.length, onLoadDates]);

  // Auto-select most recent date
  useEffect(() => {
    if (logDates.length > 0 && !selectedDate) {
      setSelectedDate(logDates[0]);
    }
  }, [logDates, selectedDate]);

  // Load dialogues when date changes
  useEffect(() => {
    if (selectedDate) {
      setIsLoadingDialogues(true);
      setDialogues([]);
      setOffset(0);
      onLoadDialogues(selectedDate, 0, LIMIT)
        .then(({ dialogues: newDialogues, hasMore: more }) => {
          setDialogues(newDialogues);
          setHasMore(more);
        })
        .finally(() => setIsLoadingDialogues(false));
    }
  }, [selectedDate, onLoadDialogues]);

  // Load more dialogues
  const handleLoadMore = useCallback(async () => {
    if (!selectedDate || isLoadingDialogues || !hasMore) return;

    setIsLoadingDialogues(true);
    const newOffset = offset + LIMIT;
    const { dialogues: newDialogues, hasMore: more } = await onLoadDialogues(selectedDate, newOffset, LIMIT);
    setDialogues((prev) => [...prev, ...newDialogues]);
    setHasMore(more);
    setOffset(newOffset);
    setIsLoadingDialogues(false);
  }, [selectedDate, isLoadingDialogues, hasMore, offset, onLoadDialogues]);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Date selector - Glass bar with fade edges */}
      <div className="flex-shrink-0 p-3 border-b border-white/5 bg-gray-900/30 backdrop-blur-sm">
        <div className="relative">
          {/* Left fade edge */}
          <div className="absolute left-0 top-0 bottom-0 w-4 bg-gradient-to-r from-gray-900/80 to-transparent z-10 pointer-events-none" />
          {/* Right fade edge */}
          <div className="absolute right-0 top-0 bottom-0 w-4 bg-gradient-to-l from-gray-900/80 to-transparent z-10 pointer-events-none" />
          <div className="flex gap-2 overflow-x-auto pb-1 px-1 scrollbar-hide">
            {logDates.map((date) => (
              <button
                key={date}
                type="button"
                onClick={() => {
                  haptics.light();
                  setSelectedDate(date);
                  setExpandedDialogue(null);
                }}
                className={`flex-shrink-0 px-4 py-2.5 rounded-xl text-sm font-medium
                  transition-all duration-200 active:scale-[0.97]
                  ${selectedDate === date
                    ? 'bg-gradient-to-r from-[#E63946] to-[#d62839] text-white shadow-md shadow-[#E63946]/20'
                    : 'bg-gray-800/80 text-gray-300 hover:bg-gray-700/80 border border-white/5'
                  }`}
              >
                {formatDateLabel(date)}
              </button>
            ))}
            {logDates.length === 0 && !isLoading && (
              <span className="text-sm text-gray-500 px-2">No logs available</span>
            )}
          </div>
        </div>
      </div>

      {/* Dialogues list */}
      <div className="flex-1 overflow-y-auto">
        {/* Loading state - Premium animated */}
        {isLoadingDialogues && dialogues.length === 0 && (
          <div className="flex items-center justify-center h-48">
            <div className="flex flex-col items-center gap-4">
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-gradient-to-r from-[#E63946]/20 to-[#d62839]/20 animate-spin"
                  style={{ animationDuration: '3s' }} />
                <div className="relative w-12 h-12 rounded-full bg-gray-900/80 backdrop-blur-sm border border-white/10
                  flex items-center justify-center">
                  <svg className="w-6 h-6 text-[#E63946] animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                </div>
              </div>
              <span className="text-sm text-gray-400 font-medium">Loading dialogues...</span>
            </div>
          </div>
        )}

        {/* Empty state - Enhanced */}
        {!isLoadingDialogues && dialogues.length === 0 && selectedDate && (
          <div className="flex flex-col items-center justify-center h-48 text-gray-500">
            <div className="relative mb-4">
              <div className="absolute inset-0 rounded-full bg-gradient-to-r from-gray-600/20 via-transparent to-gray-600/20 animate-spin"
                style={{ animationDuration: '8s' }} />
              <div className="relative w-16 h-16 rounded-full bg-gray-900/50 backdrop-blur-sm border border-white/5
                flex items-center justify-center">
                <svg className="w-8 h-8 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
            </div>
            <p className="text-sm font-medium text-gray-400">No dialogues for this date</p>
          </div>
        )}

        {/* Dialogue cards - Glass styling */}
        {dialogues.length > 0 && (
          <div className="p-3 space-y-2">
            {dialogues.map((dialogue) => {
              const isExpanded = expandedDialogue === dialogue.dialogueId;

              return (
                <div key={dialogue.dialogueId} className="bg-gray-900/60 backdrop-blur-sm border border-white/5
                  rounded-xl overflow-hidden">
                  {/* Dialogue header */}
                  <button
                    type="button"
                    onClick={() => {
                      haptics.light();
                      setExpandedDialogue(isExpanded ? null : dialogue.dialogueId);
                    }}
                    className="w-full p-4 text-left active:bg-white/5 transition-all duration-150"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-white">
                          {formatTime(dialogue.startTime)}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 mt-1.5">
                          <span className="flex items-center gap-1">
                            <span className="w-1 h-1 rounded-full bg-gray-600" />
                            {dialogue.entryCount} entries
                          </span>
                          {dialogue.summary && (
                            <>
                              <span className="flex items-center gap-1">
                                <span className="w-1 h-1 rounded-full bg-blue-500" />
                                <span className="text-blue-400">{dialogue.summary.totalSuggestions} suggestions</span>
                              </span>
                              {dialogue.summary.approvedCount > 0 && (
                                <span className="flex items-center gap-1">
                                  <span className="w-1 h-1 rounded-full bg-green-500" />
                                  <span className="text-green-400">{dialogue.summary.approvedCount} approved</span>
                                </span>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {dialogue.summary && (
                          <span className="text-xs text-gray-500 font-medium">
                            {(dialogue.summary.totalLatencyMs / 1000).toFixed(1)}s
                          </span>
                        )}
                        <div className={`w-7 h-7 rounded-full bg-white/5 flex items-center justify-center
                          transition-all duration-200 ${isExpanded ? 'bg-white/10' : ''}`}>
                          <svg
                            className={`w-3.5 h-3.5 text-gray-500 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  </button>

                  {/* Expanded dialogue entries */}
                  {isExpanded && dialogue.entries && (
                    <div className="border-t border-white/5 bg-black/20">
                      {dialogue.entries.map((entry, i) => (
                        <DialogueEntryItem key={i} entry={entry} index={i} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Load more button - Glass styling */}
            {hasMore && (
              <button
                type="button"
                onClick={handleLoadMore}
                disabled={isLoadingDialogues}
                className="w-full p-4 text-sm font-medium text-gray-400 hover:text-white
                  bg-white/5 backdrop-blur-sm border border-white/5 rounded-xl
                  transition-all duration-200 disabled:opacity-50
                  active:scale-[0.99]"
              >
                {isLoadingDialogues ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Loading...
                  </span>
                ) : 'Load more dialogues'}
              </button>
            )}
          </div>
        )}

        {/* Bottom padding */}
        <div className="h-4" />
      </div>
    </div>
  );
};

export default LogsView;
