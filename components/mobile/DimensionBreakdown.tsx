/**
 * DimensionBreakdown Component
 *
 * Displays the 6 evaluation dimensions as horizontal progress bars.
 * Premium glass morphism styling with animated transitions.
 * More readable on mobile than radar charts.
 */

import React from 'react';
import type { EvalDimensionScores, EvalDimensionScore } from '../../types';
import haptics from '../../utils/haptics';

interface DimensionBreakdownProps {
  scores: EvalDimensionScores;
  compact?: boolean;
  showLabels?: boolean;
}

interface DimensionConfig {
  key: keyof EvalDimensionScores;
  label: string;
  shortLabel: string;
  color: string;
  bgColor: string;
  glowColor: string;
}

// Premium dimension configurations with consistent color system
const dimensions: DimensionConfig[] = [
  {
    key: 'relevance',
    label: 'Relevance',
    shortLabel: 'REL',
    color: 'bg-dimension-relevance',
    bgColor: 'bg-dimension-relevance/20',
    glowColor: 'shadow-[0_0_10px_rgba(230,57,70,0.3)]'
  },
  {
    key: 'specificity',
    label: 'Specificity',
    shortLabel: 'SPE',
    color: 'bg-dimension-specificity',
    bgColor: 'bg-dimension-specificity/20',
    glowColor: 'shadow-[0_0_10px_rgba(69,123,157,0.3)]'
  },
  {
    key: 'pedagogical',
    label: 'Pedagogical',
    shortLabel: 'PED',
    color: 'bg-dimension-pedagogical',
    bgColor: 'bg-dimension-pedagogical/20',
    glowColor: 'shadow-[0_0_10px_rgba(42,157,143,0.3)]'
  },
  {
    key: 'personalization',
    label: 'Personalization',
    shortLabel: 'PER',
    color: 'bg-dimension-personalization',
    bgColor: 'bg-dimension-personalization/20',
    glowColor: 'shadow-[0_0_10px_rgba(233,196,106,0.3)]'
  },
  {
    key: 'actionability',
    label: 'Actionability',
    shortLabel: 'ACT',
    color: 'bg-dimension-actionability',
    bgColor: 'bg-dimension-actionability/20',
    glowColor: 'shadow-[0_0_10px_rgba(244,162,97,0.3)]'
  },
  {
    key: 'tone',
    label: 'Tone',
    shortLabel: 'TON',
    color: 'bg-dimension-tone',
    bgColor: 'bg-dimension-tone/20',
    glowColor: 'shadow-[0_0_10px_rgba(131,56,236,0.3)]'
  }
];

// Extract numeric value from dimension score
function getScoreValue(score: EvalDimensionScore): number | null {
  if (score === null || score === undefined) return null;
  if (typeof score === 'number') return score;
  if (typeof score === 'object' && 'score' in score) return score.score;
  return null;
}

// Get reasoning if available
function getScoreReasoning(score: EvalDimensionScore): string | undefined {
  if (score === null || score === undefined) return undefined;
  if (typeof score === 'object' && 'reasoning' in score) return score.reasoning;
  return undefined;
}

// Get score quality indicator
function getScoreQuality(value: number | null): { label: string; color: string } {
  if (value === null) return { label: '', color: 'text-gray-600' };
  if (value >= 4) return { label: 'Excellent', color: 'text-green-400' };
  if (value >= 3) return { label: 'Good', color: 'text-blue-400' };
  if (value >= 2) return { label: 'Fair', color: 'text-yellow-400' };
  return { label: 'Needs work', color: 'text-red-400' };
}

export const DimensionBreakdown: React.FC<DimensionBreakdownProps> = ({
  scores,
  compact = false,
  showLabels = true
}) => {
  const [expandedDimension, setExpandedDimension] = React.useState<string | null>(null);

  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      {dimensions.map((dim, index) => {
        const rawScore = scores[dim.key];
        const value = getScoreValue(rawScore);
        const reasoning = getScoreReasoning(rawScore);
        const percentage = value !== null ? (value / 5) * 100 : 0;
        const isExpanded = expandedDimension === dim.key;
        const quality = getScoreQuality(value);

        return (
          <div
            key={dim.key}
            className="animate-fade-in"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <button
              type="button"
              onClick={() => {
                if (reasoning) {
                  haptics.light();
                  setExpandedDimension(isExpanded ? null : dim.key);
                }
              }}
              className={`w-full text-left transition-all duration-200 rounded-lg
                ${reasoning ? 'cursor-pointer hover:bg-white/5 active:scale-[0.99]' : 'cursor-default'}
                ${compact ? 'p-1' : 'p-1.5 -mx-1.5'}`}
              disabled={!reasoning}
            >
              <div className="flex justify-between items-center mb-1.5">
                <div className="flex items-center gap-2">
                  {/* Color indicator dot */}
                  <div className={`w-2 h-2 rounded-full ${dim.color} ${value !== null && value >= 4 ? dim.glowColor : ''}`} />
                  <span className={`font-medium ${compact ? 'text-xs' : 'text-sm'} text-gray-300`}>
                    {showLabels ? (compact ? dim.shortLabel : dim.label) : dim.shortLabel}
                  </span>
                  {reasoning && (
                    <svg
                      className={`w-3 h-3 text-gray-600 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {!compact && value !== null && (
                    <span className={`text-[10px] font-medium ${quality.color} uppercase tracking-wide`}>
                      {quality.label}
                    </span>
                  )}
                  <span className={`font-semibold tabular-nums ${compact ? 'text-xs' : 'text-sm'}`}>
                    {value !== null ? (
                      <span className="text-white">{value.toFixed(1)}<span className="text-gray-500">/5</span></span>
                    ) : (
                      <span className="text-gray-600">—</span>
                    )}
                  </span>
                </div>
              </div>

              {/* Progress bar with glass effect */}
              <div className={`bg-gray-800/60 rounded-full overflow-hidden backdrop-blur-xs ${compact ? 'h-1.5' : 'h-2.5'}`}>
                <div
                  className={`h-full rounded-full transition-all duration-700 ease-out ${dim.color}
                    ${value !== null && value >= 4 ? dim.glowColor : ''}`}
                  style={{
                    width: `${percentage}%`,
                    transitionDelay: `${index * 50}ms`
                  }}
                />
              </div>
            </button>

            {/* Expandable reasoning - Premium glass panel */}
            {isExpanded && reasoning && (
              <div className="mt-2 ml-4 animate-fade-in">
                <div className={`p-3 rounded-xl ${dim.bgColor} backdrop-blur-sm border border-white/5`}>
                  <div className="flex items-start gap-2">
                    <svg className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    <p className="text-xs text-gray-300 leading-relaxed">
                      {reasoning}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default DimensionBreakdown;
