/**
 * StreamingLogPanel Component
 *
 * Displays real-time streaming logs during test execution.
 * Premium glass morphism styling with visual log type indicators.
 * Expandable panel that auto-scrolls to latest content.
 */

import React, { useRef, useEffect, useState } from 'react';
import type { StreamLog } from '../../hooks/useEvalData';
import haptics from '../../utils/haptics';

interface StreamingLogPanelProps {
  logs: StreamLog[];
  isRunning: boolean;
}

// Log type configurations with styling
interface LogTypeConfig {
  color: string;
  bgColor: string;
  icon: React.ReactNode;
}

const LogTypeIcons: Record<StreamLog['type'] | 'info', LogTypeConfig> = {
  success: {
    color: 'text-green-400',
    bgColor: 'bg-green-500/10',
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    )
  },
  warning: {
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/10',
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    )
  },
  error: {
    color: 'text-red-400',
    bgColor: 'bg-red-500/10',
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    )
  },
  progress: {
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    icon: (
      <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
    )
  },
  info: {
    color: 'text-gray-400',
    bgColor: 'bg-gray-500/10',
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )
  }
};

export const StreamingLogPanel: React.FC<StreamingLogPanelProps> = ({
  logs,
  isRunning
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (bottomRef.current && containerRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  // Auto-expand when running starts
  useEffect(() => {
    if (isRunning) {
      setIsExpanded(true);
    }
  }, [isRunning]);

  const getLogConfig = (type: StreamLog['type']): LogTypeConfig => {
    return LogTypeIcons[type] || LogTypeIcons.info;
  };

  // Count log types for summary
  const logCounts = logs.reduce((acc, log) => {
    acc[log.type] = (acc[log.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  if (logs.length === 0 && !isRunning) {
    return null;
  }

  return (
    <div className="border-t border-white/5 bg-gray-900/30 backdrop-blur-sm">
      {/* Toggle header - Glass styling */}
      <button
        type="button"
        onClick={() => {
          haptics.light();
          setIsExpanded(!isExpanded);
        }}
        className="w-full flex items-center justify-between p-3.5
          hover:bg-white/5 active:scale-[0.995] transition-all duration-150"
      >
        <div className="flex items-center gap-3">
          {/* Live indicator */}
          {isRunning && (
            <div className="relative">
              <span className="absolute inset-0 w-2.5 h-2.5 bg-green-500 rounded-full animate-ping opacity-75" />
              <span className="relative w-2.5 h-2.5 bg-green-500 rounded-full block" />
            </div>
          )}

          {/* Title */}
          <span className="text-sm font-medium text-gray-300">
            {isRunning ? 'Live Output' : 'Output'}
          </span>

          {/* Log type counts - Mini badges */}
          <div className="flex items-center gap-1.5">
            {logCounts.error && logCounts.error > 0 && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-500/20 text-red-400 border border-red-500/30">
                {logCounts.error} error{logCounts.error > 1 ? 's' : ''}
              </span>
            )}
            {logCounts.warning && logCounts.warning > 0 && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                {logCounts.warning} warn
              </span>
            )}
            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-white/5 text-gray-500 border border-white/5">
              {logs.length} total
            </span>
          </div>
        </div>

        {/* Expand indicator */}
        <div className={`w-7 h-7 rounded-full bg-white/5 flex items-center justify-center
          transition-all duration-200 ${isExpanded ? 'bg-white/10' : ''}`}>
          <svg
            className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
        </div>
      </button>

      {/* Log content - Terminal style with glass */}
      <div
        ref={containerRef}
        className={`overflow-hidden transition-all duration-300 ease-out
          ${isExpanded ? 'max-h-80' : 'max-h-0'}`}
      >
        <div className="h-full overflow-y-auto bg-black/40 backdrop-blur-sm p-3 font-mono text-xs leading-relaxed
          border-t border-white/5 scrollbar-hide">

          {/* Log entries */}
          {logs.map((log, i) => {
            const config = getLogConfig(log.type);
            return (
              <div
                key={i}
                className={`flex items-start gap-2 py-1 px-2 -mx-2 rounded
                  ${config.bgColor} ${config.color}
                  animate-fade-in`}
                style={{ animationDelay: `${Math.min(i * 20, 200)}ms` }}
              >
                {/* Icon */}
                <span className="flex-shrink-0 mt-0.5 w-4 flex items-center justify-center">
                  {config.icon}
                </span>

                {/* Message */}
                <span className="whitespace-pre-wrap break-words flex-1">
                  {log.message}
                </span>

                {/* Timestamp for progress logs */}
                {log.type === 'progress' && (
                  <span className="text-[10px] text-gray-600 flex-shrink-0 tabular-nums">
                    {new Date().toLocaleTimeString(undefined, {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit'
                    })}
                  </span>
                )}
              </div>
            );
          })}

          {/* Typing indicator while running */}
          {isRunning && (
            <div className="flex items-center gap-1.5 mt-3 pt-2 border-t border-white/5">
              <div className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-red animate-pulse" />
                <span className="w-1.5 h-1.5 rounded-full bg-brand-red animate-pulse" style={{ animationDelay: '0.2s' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-brand-red animate-pulse" style={{ animationDelay: '0.4s' }} />
              </div>
              <span className="text-[10px] text-gray-600 ml-1">Processing...</span>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>
    </div>
  );
};

export default StreamingLogPanel;
