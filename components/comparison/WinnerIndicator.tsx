/**
 * WinnerIndicator Component
 *
 * Visual badge showing which profile won a comparison.
 * Uses color coding:
 * - Gold/yellow gradient for winner
 * - Gray for tie/no winner
 * - Significance stars (* = >5%, ** = >10% improvement)
 */

import React from 'react';

interface WinnerIndicatorProps {
  winner: 'baseline' | 'recognition' | null;
  significance?: '' | '*' | '**';
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export const WinnerIndicator: React.FC<WinnerIndicatorProps> = ({
  winner,
  significance = '',
  size = 'md',
  showLabel = true,
}) => {
  if (!winner) {
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full
          bg-gray-700/50 text-gray-400 border border-gray-600/30
          ${size === 'sm' ? 'text-[10px]' : size === 'lg' ? 'text-sm' : 'text-xs'}`}
      >
        <span className="opacity-50">~</span>
        {showLabel && <span>Tie</span>}
      </span>
    );
  }

  const isRecognition = winner === 'recognition';

  // Winner styling
  const winnerStyles = isRecognition
    ? 'bg-gradient-to-r from-yellow-500/20 to-green-500/20 text-yellow-400 border-yellow-500/30'
    : 'bg-gradient-to-r from-blue-500/20 to-blue-400/20 text-blue-400 border-blue-500/30';

  const icon = isRecognition ? '🏆' : '🎯';
  const label = isRecognition ? 'Recognition' : 'Baseline';

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border
        ${winnerStyles}
        ${size === 'sm' ? 'text-[10px]' : size === 'lg' ? 'text-sm' : 'text-xs'}`}
    >
      <span>{icon}</span>
      {showLabel && <span className="font-medium">{label}</span>}
      {significance && (
        <span className="text-yellow-300 font-bold">{significance}</span>
      )}
    </span>
  );
};

export default WinnerIndicator;
