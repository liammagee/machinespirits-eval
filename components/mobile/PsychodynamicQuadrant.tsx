/**
 * PsychodynamicQuadrant Component
 *
 * 2D scatter visualization of psychodynamic parameters:
 * - X-axis: superegoCompliance (0.0-1.0)
 * - Y-axis: recognitionSeeking (0.0-1.0)
 *
 * Four quadrants represent different tutor-learner dynamics:
 * - Top-right (high/high): Dialogical Recognition (ideal)
 * - Top-left (low/high): Permissive Responsive
 * - Bottom-right (high/low): Traditional Authoritarian
 * - Bottom-left (low/low): Disengaged
 */

import React from 'react';

interface HistoricalPoint {
  compliance: number;
  seeking: number;
  timestamp: string;
}

interface PsychodynamicQuadrantProps {
  superegoCompliance: number;
  recognitionSeeking: number;
  historicalPoints?: HistoricalPoint[];
  size?: number;
}

export const PsychodynamicQuadrant: React.FC<PsychodynamicQuadrantProps> = ({
  superegoCompliance,
  recognitionSeeking,
  historicalPoints = [],
  size = 200,
}) => {
  const padding = 40;
  const chartSize = size - padding * 2;

  // Convert values (0-1) to chart coordinates
  const toX = (value: number) => padding + value * chartSize;
  const toY = (value: number) => padding + (1 - value) * chartSize; // Invert Y

  // Current position
  const currentX = toX(superegoCompliance);
  const currentY = toY(recognitionSeeking);

  // Quadrant labels and positions
  const quadrants = [
    {
      label: 'Permissive',
      sublabel: 'Responsive',
      x: padding + chartSize * 0.25,
      y: padding + chartSize * 0.25,
      color: 'text-blue-400/60',
    },
    {
      label: 'Dialogical',
      sublabel: 'Recognition',
      x: padding + chartSize * 0.75,
      y: padding + chartSize * 0.25,
      color: 'text-green-400/60',
    },
    {
      label: 'Disengaged',
      sublabel: '',
      x: padding + chartSize * 0.25,
      y: padding + chartSize * 0.75,
      color: 'text-gray-500/60',
    },
    {
      label: 'Traditional',
      sublabel: 'Authoritarian',
      x: padding + chartSize * 0.75,
      y: padding + chartSize * 0.75,
      color: 'text-red-400/60',
    },
  ];

  // Determine current quadrant for highlight
  const getQuadrantName = () => {
    if (superegoCompliance >= 0.5 && recognitionSeeking >= 0.5) return 'Dialogical Recognition';
    if (superegoCompliance < 0.5 && recognitionSeeking >= 0.5) return 'Permissive Responsive';
    if (superegoCompliance >= 0.5 && recognitionSeeking < 0.5) return 'Traditional Authoritarian';
    return 'Disengaged';
  };

  return (
    <div className="bg-gray-900/60 backdrop-blur-sm border border-white/5 rounded-xl p-4">
      <div className="text-xs text-gray-400 mb-3">Psychodynamic Quadrant</div>

      <svg width={size} height={size} className="mx-auto">
        {/* Background gradient for quadrants */}
        <defs>
          <linearGradient id="quadrantBg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.1" />
            <stop offset="50%" stopColor="#22c55e" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#ef4444" stopOpacity="0.1" />
          </linearGradient>
          <radialGradient id="pointGlow">
            <stop offset="0%" stopColor="#E63946" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#E63946" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Chart background */}
        <rect
          x={padding}
          y={padding}
          width={chartSize}
          height={chartSize}
          fill="url(#quadrantBg)"
          rx="4"
        />

        {/* Grid lines */}
        <line
          x1={padding + chartSize / 2}
          y1={padding}
          x2={padding + chartSize / 2}
          y2={padding + chartSize}
          stroke="white"
          strokeOpacity="0.1"
          strokeDasharray="4,4"
        />
        <line
          x1={padding}
          y1={padding + chartSize / 2}
          x2={padding + chartSize}
          y2={padding + chartSize / 2}
          stroke="white"
          strokeOpacity="0.1"
          strokeDasharray="4,4"
        />

        {/* Quadrant labels */}
        {quadrants.map((q, i) => (
          <g key={i}>
            <text
              x={q.x}
              y={q.y - 6}
              textAnchor="middle"
              className={`text-[9px] ${q.color} fill-current`}
            >
              {q.label}
            </text>
            {q.sublabel && (
              <text
                x={q.x}
                y={q.y + 6}
                textAnchor="middle"
                className={`text-[9px] ${q.color} fill-current`}
              >
                {q.sublabel}
              </text>
            )}
          </g>
        ))}

        {/* Historical trail */}
        {historicalPoints.length > 1 && (
          <polyline
            points={historicalPoints
              .map((p) => `${toX(p.compliance)},${toY(p.seeking)}`)
              .join(' ')}
            fill="none"
            stroke="#E63946"
            strokeOpacity="0.3"
            strokeWidth="1"
          />
        )}

        {/* Historical points (fading) */}
        {historicalPoints.map((point, i) => {
          const opacity = 0.2 + (i / historicalPoints.length) * 0.4;
          return (
            <circle
              key={i}
              cx={toX(point.compliance)}
              cy={toY(point.seeking)}
              r={3}
              fill="#E63946"
              fillOpacity={opacity}
            />
          );
        })}

        {/* Current position glow */}
        <circle cx={currentX} cy={currentY} r={20} fill="url(#pointGlow)" />

        {/* Current position */}
        <circle
          cx={currentX}
          cy={currentY}
          r={8}
          fill="#E63946"
          stroke="white"
          strokeWidth="2"
        />

        {/* Axis labels */}
        <text
          x={padding + chartSize / 2}
          y={size - 8}
          textAnchor="middle"
          className="text-[10px] text-gray-500 fill-current"
        >
          Superego Compliance
        </text>
        <text
          x={12}
          y={padding + chartSize / 2}
          textAnchor="middle"
          className="text-[10px] text-gray-500 fill-current"
          transform={`rotate(-90, 12, ${padding + chartSize / 2})`}
        >
          Recognition Seeking
        </text>

        {/* Axis scale markers */}
        <text
          x={padding}
          y={size - 8}
          textAnchor="middle"
          className="text-[8px] text-gray-600 fill-current"
        >
          0
        </text>
        <text
          x={padding + chartSize}
          y={size - 8}
          textAnchor="middle"
          className="text-[8px] text-gray-600 fill-current"
        >
          1
        </text>
      </svg>

      {/* Current values and quadrant */}
      <div className="mt-3 pt-3 border-t border-white/5 space-y-2">
        <div className="flex justify-between text-xs">
          <span className="text-gray-500">Compliance</span>
          <span className="text-white font-medium">
            {(superegoCompliance * 100).toFixed(0)}%
          </span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-gray-500">Recognition</span>
          <span className="text-white font-medium">
            {(recognitionSeeking * 100).toFixed(0)}%
          </span>
        </div>
        <div className="flex justify-between text-xs pt-2 border-t border-white/5">
          <span className="text-gray-500">Quadrant</span>
          <span className="text-[#E63946] font-medium">{getQuadrantName()}</span>
        </div>
      </div>
    </div>
  );
};

export default PsychodynamicQuadrant;
