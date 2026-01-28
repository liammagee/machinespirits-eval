/**
 * DeltaAnalysisTable Component
 *
 * Dimension-by-dimension comparison table showing:
 * - Baseline score
 * - Recognition score
 * - Delta (difference)
 * - Winner badge per dimension
 */

import React from 'react';
import { WinnerIndicator } from './WinnerIndicator';

interface DeltaEntry {
  dimension: string;
  baseline: number | null;
  recognition: number | null;
  delta: number;
  deltaPercent: number;
  significance: '' | '*' | '**';
  winner: 'baseline' | 'recognition' | null;
}

interface DeltaAnalysisTableProps {
  deltaAnalysis: DeltaEntry[];
}

const dimensionLabels: Record<string, string> = {
  relevance: 'Relevance',
  specificity: 'Specificity',
  pedagogical: 'Pedagogical',
  personalization: 'Personalization',
  actionability: 'Actionability',
  tone: 'Tone',
};

export const DeltaAnalysisTable: React.FC<DeltaAnalysisTableProps> = ({
  deltaAnalysis,
}) => {
  if (!deltaAnalysis || deltaAnalysis.length === 0) {
    return (
      <div className="bg-gray-900/60 backdrop-blur-sm border border-white/5 rounded-xl p-4">
        <div className="text-xs text-gray-400 mb-3">Delta Analysis</div>
        <div className="text-sm text-gray-500 text-center py-4">
          No comparison data available
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900/60 backdrop-blur-sm border border-white/5 rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="text-xs text-gray-400">Delta Analysis</div>
        <div className="flex items-center gap-3 text-[10px] text-gray-500">
          <span>
            <span className="text-yellow-400 font-bold">*</span> &gt;5% improvement
          </span>
          <span>
            <span className="text-yellow-400 font-bold">**</span> &gt;10% improvement
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-gray-500 border-b border-white/5">
              <th className="text-left py-2 pr-4">Dimension</th>
              <th className="text-right py-2 px-2">Baseline</th>
              <th className="text-right py-2 px-2">Recognition</th>
              <th className="text-right py-2 px-2">Delta</th>
              <th className="text-center py-2 pl-4">Winner</th>
            </tr>
          </thead>
          <tbody>
            {deltaAnalysis.map((entry) => {
              const deltaColor =
                entry.delta > 0
                  ? 'text-green-400'
                  : entry.delta < 0
                    ? 'text-red-400'
                    : 'text-gray-400';

              return (
                <tr
                  key={entry.dimension}
                  className="border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors"
                >
                  <td className="py-2 pr-4">
                    <span className="text-gray-300">
                      {dimensionLabels[entry.dimension] || entry.dimension}
                    </span>
                  </td>
                  <td className="text-right py-2 px-2 text-blue-400 font-mono">
                    {entry.baseline != null ? entry.baseline.toFixed(2) : '—'}
                  </td>
                  <td className="text-right py-2 px-2 text-yellow-400 font-mono">
                    {entry.recognition != null ? entry.recognition.toFixed(2) : '—'}
                  </td>
                  <td className={`text-right py-2 px-2 font-mono ${deltaColor}`}>
                    {entry.delta > 0 ? '+' : ''}
                    {entry.delta.toFixed(2)}
                    {entry.significance && (
                      <span className="text-yellow-300 ml-0.5">{entry.significance}</span>
                    )}
                  </td>
                  <td className="text-center py-2 pl-4">
                    <WinnerIndicator
                      winner={entry.winner}
                      significance={entry.significance}
                      size="sm"
                      showLabel={false}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Summary row */}
      <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between">
        <div className="text-[10px] text-gray-500">
          {deltaAnalysis.filter((d) => d.winner === 'recognition').length} dimensions favor
          recognition
        </div>
        <div className="text-[10px] text-gray-500">
          {deltaAnalysis.filter((d) => d.winner === 'baseline').length} dimensions favor baseline
        </div>
      </div>
    </div>
  );
};

export default DeltaAnalysisTable;
