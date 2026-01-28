/**
 * ScoreRadial Component
 *
 * A premium circular gauge displaying the overall evaluation score with pass/fail indication.
 * Features gradient strokes, glow effects, and smooth animations.
 * Mobile-optimized with clear visual feedback.
 */

import React, { useEffect, useState } from 'react';

interface ScoreRadialProps {
  score: number | null;
  passed: boolean;
  size?: number;
  animate?: boolean;
}

export const ScoreRadial: React.FC<ScoreRadialProps> = ({
  score,
  passed,
  size = 120,
  animate = true
}) => {
  const [animatedScore, setAnimatedScore] = useState(animate ? 0 : (score ?? 0));
  const percentage = score !== null ? animatedScore : 0;
  const radius = (size - 16) / 2; // Account for stroke width
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  // Unique ID for gradient definitions
  const gradientId = `score-gradient-${passed ? 'pass' : 'fail'}`;
  const glowId = `score-glow-${passed ? 'pass' : 'fail'}`;

  // Animate score on mount/change
  useEffect(() => {
    if (!animate || score === null) {
      setAnimatedScore(score ?? 0);
      return;
    }

    const duration = 1000;
    const startTime = Date.now();
    const startValue = animatedScore;
    const endValue = score;

    const animateValue = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = startValue + (endValue - startValue) * eased;

      setAnimatedScore(current);

      if (progress < 1) {
        requestAnimationFrame(animateValue);
      }
    };

    requestAnimationFrame(animateValue);
  }, [score, animate]);

  // Get quality label based on score
  const getQualityLabel = (s: number): string => {
    if (s >= 80) return 'Excellent';
    if (s >= 60) return 'Good';
    if (s >= 40) return 'Fair';
    return 'Needs Work';
  };

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      {/* Outer glow effect */}
      {score !== null && (
        <div
          className={`absolute inset-0 rounded-full transition-opacity duration-1000 ${
            passed ? 'bg-green-500/10' : 'bg-red-500/10'
          } ${percentage > 0 ? 'opacity-100' : 'opacity-0'}`}
          style={{
            boxShadow: passed
              ? '0 0 40px rgba(34, 197, 94, 0.2), inset 0 0 20px rgba(34, 197, 94, 0.05)'
              : '0 0 40px rgba(230, 57, 70, 0.2), inset 0 0 20px rgba(230, 57, 70, 0.05)'
          }}
        />
      )}

      <svg className="transform -rotate-90" width={size} height={size}>
        {/* Gradient definitions */}
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            {passed ? (
              <>
                <stop offset="0%" stopColor="#22c55e" />
                <stop offset="50%" stopColor="#4ade80" />
                <stop offset="100%" stopColor="#22c55e" />
              </>
            ) : (
              <>
                <stop offset="0%" stopColor="#E63946" />
                <stop offset="50%" stopColor="#f87171" />
                <stop offset="100%" stopColor="#c1121f" />
              </>
            )}
          </linearGradient>
          <filter id={glowId} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Background track - glass effect */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(31, 41, 55, 0.8)"
          strokeWidth="10"
          fill="none"
        />

        {/* Inner subtle ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius - 6}
          stroke="rgba(255, 255, 255, 0.03)"
          strokeWidth="1"
          fill="none"
        />

        {/* Progress arc with gradient */}
        {score !== null && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={`url(#${gradientId})`}
            strokeWidth="10"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            filter={percentage >= 60 ? `url(#${glowId})` : undefined}
            className="transition-all duration-100"
          />
        )}

        {/* Decorative end cap glow */}
        {score !== null && percentage > 5 && (
          <circle
            cx={size / 2 + radius * Math.cos((2 * Math.PI * percentage) / 100 - Math.PI / 2)}
            cy={size / 2 + radius * Math.sin((2 * Math.PI * percentage) / 100 - Math.PI / 2)}
            r="5"
            fill={passed ? '#4ade80' : '#f87171'}
            opacity="0.6"
            className="animate-pulse"
          />
        )}
      </svg>

      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {score !== null ? (
          <>
            {/* Score value */}
            <div className="flex items-baseline gap-0.5">
              <span className="text-4xl font-bold text-white tabular-nums">
                {Math.round(animatedScore)}
              </span>
              <span className="text-lg text-gray-500 font-medium">%</span>
            </div>

            {/* Pass/Fail badge */}
            <div
              className={`mt-1 px-3 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider
                ${passed
                  ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                  : 'bg-red-500/20 text-red-400 border border-red-500/30'
                }`}
            >
              {passed ? 'Pass' : 'Fail'}
            </div>

            {/* Quality label */}
            {size >= 140 && (
              <span className="mt-2 text-[10px] text-gray-500 font-medium">
                {getQualityLabel(score)}
              </span>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center gap-1">
            <svg className="w-8 h-8 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="text-gray-500 text-xs font-medium">No score</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default ScoreRadial;
