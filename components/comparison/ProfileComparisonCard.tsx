/**
 * ProfileComparisonCard Component
 *
 * Single profile result display with:
 * - Profile badge (baseline vs recognition)
 * - Overall score with delta indicator
 * - Mini radar chart of dimension scores
 * - Test stats (latency, success rate)
 */

import React from 'react';

interface DimensionAverages {
  relevance: number | null;
  specificity: number | null;
  pedagogical: number | null;
  personalization: number | null;
  actionability: number | null;
  tone: number | null;
}

interface ProfileComparisonCardProps {
  profile: 'baseline' | 'recognition';
  overallScore: number | null;
  delta?: number | null;
  dimensionAverages: DimensionAverages;
  testCount: number;
  successCount: number;
  avgLatency: number;
  isWinner?: boolean;
}

// Mini radar chart component
const MiniRadarChart: React.FC<{
  scores: DimensionAverages;
  color: string;
}> = ({ scores, color }) => {
  const dimensions = ['relevance', 'specificity', 'pedagogical', 'personalization', 'actionability', 'tone'] as const;
  const size = 80;
  const center = size / 2;
  const radius = 30;

  // Calculate points for polygon
  const points = dimensions
    .map((dim, i) => {
      const angle = (Math.PI * 2 * i) / dimensions.length - Math.PI / 2;
      const value = (scores[dim] ?? 0) / 5; // Normalize to 0-1 (assuming 5-point scale)
      const x = center + Math.cos(angle) * radius * value;
      const y = center + Math.sin(angle) * radius * value;
      return `${x},${y}`;
    })
    .join(' ');

  // Background polygon (full scale)
  const bgPoints = dimensions
    .map((_, i) => {
      const angle = (Math.PI * 2 * i) / dimensions.length - Math.PI / 2;
      const x = center + Math.cos(angle) * radius;
      const y = center + Math.sin(angle) * radius;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg width={size} height={size} className="mx-auto">
      {/* Background grid */}
      <polygon points={bgPoints} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
      <polygon
        points={bgPoints}
        fill="none"
        stroke="rgba(255,255,255,0.05)"
        strokeWidth="1"
        transform={`scale(0.66) translate(${center * 0.5}, ${center * 0.5})`}
      />
      <polygon
        points={bgPoints}
        fill="none"
        stroke="rgba(255,255,255,0.05)"
        strokeWidth="1"
        transform={`scale(0.33) translate(${center * 2}, ${center * 2})`}
      />

      {/* Data polygon */}
      <polygon points={points} fill={`${color}20`} stroke={color} strokeWidth="2" />

      {/* Center dot */}
      <circle cx={center} cy={center} r="2" fill={color} />
    </svg>
  );
};

export const ProfileComparisonCard: React.FC<ProfileComparisonCardProps> = ({
  profile,
  overallScore,
  delta,
  dimensionAverages,
  testCount,
  successCount,
  avgLatency,
  isWinner = false,
}) => {
  const isRecognition = profile === 'recognition';

  // Profile-specific styling
  const profileStyles = isRecognition
    ? {
        border: isWinner ? 'border-yellow-500/40' : 'border-yellow-500/20',
        badge: 'bg-gradient-to-r from-yellow-500/20 to-green-500/20 text-yellow-400 border-yellow-500/30',
        color: '#facc15', // yellow-400
        icon: '⚡',
        label: 'Recognition',
      }
    : {
        border: isWinner ? 'border-blue-500/40' : 'border-blue-500/20',
        badge: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
        color: '#60a5fa', // blue-400
        icon: '🎯',
        label: 'Baseline',
      };

  const successRate = testCount > 0 ? (successCount / testCount) * 100 : 0;

  return (
    <div
      className={`bg-gray-900/60 backdrop-blur-sm border rounded-xl p-4 ${profileStyles.border} ${isWinner ? 'ring-2 ring-yellow-500/20' : ''}`}
    >
      {/* Header with badge */}
      <div className="flex items-center justify-between mb-3">
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border ${profileStyles.badge}`}
        >
          <span>{profileStyles.icon}</span>
          <span className="font-medium">{profileStyles.label}</span>
        </span>

        {isWinner && (
          <span className="text-yellow-400 text-sm">🏆</span>
        )}
      </div>

      {/* Score and radar */}
      <div className="flex items-center gap-4 mb-4">
        {/* Overall score */}
        <div className="text-center">
          <div className="text-3xl font-bold" style={{ color: profileStyles.color }}>
            {overallScore != null ? overallScore.toFixed(1) : '—'}
          </div>
          {delta != null && (
            <div
              className={`text-xs ${delta > 0 ? 'text-green-400' : delta < 0 ? 'text-red-400' : 'text-gray-400'}`}
            >
              {delta > 0 ? '+' : ''}
              {delta.toFixed(1)}
            </div>
          )}
          <div className="text-[10px] text-gray-500">Overall</div>
        </div>

        {/* Mini radar */}
        <div className="flex-1">
          <MiniRadarChart scores={dimensionAverages} color={profileStyles.color} />
        </div>
      </div>

      {/* Stats row */}
      <div className="flex items-center justify-between text-[10px] text-gray-500 pt-2 border-t border-white/5">
        <span>
          {successCount}/{testCount} tests ({successRate.toFixed(0)}%)
        </span>
        <span>{avgLatency.toFixed(0)}ms avg</span>
      </div>
    </div>
  );
};

export default ProfileComparisonCard;
