/**
 * RecognitionABMode Component
 *
 * Main controller for Recognition A/B comparison mode.
 * - Manages SSE streaming to /api/eval/stream/recognition-ab
 * - Displays side-by-side baseline vs recognition results
 * - Shows delta analysis with winner indicators
 * - Recognition-specific metrics panel for treatment profile
 */

import React, { useState, useRef, useCallback } from 'react';
import { ProfileComparisonCard } from './ProfileComparisonCard';
import { DeltaAnalysisTable } from './DeltaAnalysisTable';
import { RecognitionMetricsPanel } from './RecognitionMetricsPanel';
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

interface DimensionAverages {
  relevance: number | null;
  specificity: number | null;
  pedagogical: number | null;
  personalization: number | null;
  actionability: number | null;
  tone: number | null;
}

interface SynthesisStrategies {
  ghost_dominates: number;
  learner_dominates: number;
  dialectical_synthesis: number;
}

interface OverallScores {
  baseline: number | null;
  recognition: number | null;
  delta: number | null;
  significance: '' | '*' | '**';
  winner: 'baseline' | 'recognition' | null;
}

interface RecognitionMetrics {
  momentsGenerated: number;
  avgDialecticalDepth: number;
  synthesisStrategies: SynthesisStrategies;
}

interface LogEntry {
  message: string;
  level: string;
  timestamp?: string;
}

interface ResultEntry {
  profile: string;
  scenarioId: string;
  scenarioName: string;
  passed: boolean;
  score: number | null;
  latencyMs: number;
}

interface RecognitionABModeProps {
  onRunComplete?: (runId: string) => void;
}

export const RecognitionABMode: React.FC<RecognitionABModeProps> = ({ onRunComplete }) => {
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, percentage: 0 });
  const [currentScenario, setCurrentScenario] = useState('');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [results, setResults] = useState<ResultEntry[]>([]);

  // Final results state
  const [dimensionAverages, setDimensionAverages] = useState<{
    baseline: DimensionAverages;
    recognition: DimensionAverages;
  } | null>(null);
  const [deltaAnalysis, setDeltaAnalysis] = useState<DeltaEntry[]>([]);
  const [overallScores, setOverallScores] = useState<OverallScores | null>(null);
  const [recognitionMetrics, setRecognitionMetrics] = useState<RecognitionMetrics | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const addLog = useCallback((entry: LogEntry) => {
    setLogs((prev) => [...prev.slice(-100), entry]); // Keep last 100 logs
  }, []);

  const runComparison = useCallback(async () => {
    // Reset state
    setIsRunning(true);
    setProgress({ current: 0, total: 0, percentage: 0 });
    setCurrentScenario('');
    setLogs([]);
    setResults([]);
    setDimensionAverages(null);
    setDeltaAnalysis([]);
    setOverallScores(null);
    setRecognitionMetrics(null);
    setRunId(null);
    setError(null);

    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const es = new EventSource('/api/eval/stream/recognition-ab');
    eventSourceRef.current = es;

    es.addEventListener('start', (event) => {
      const data = JSON.parse(event.data);
      setProgress({ current: 0, total: data.totalTests, percentage: 0 });
      addLog({ message: `Starting Recognition A/B test: ${data.scenarioCount} scenarios`, level: 'info' });
    });

    es.addEventListener('progress', (event) => {
      const data = JSON.parse(event.data);
      setProgress({ current: data.current, total: data.total, percentage: data.percentage });
      setCurrentScenario(data.scenario);
    });

    es.addEventListener('log', (event) => {
      const data = JSON.parse(event.data);
      addLog({ message: data.message, level: data.level, timestamp: data.timestamp });
    });

    es.addEventListener('result', (event) => {
      const data = JSON.parse(event.data);
      setResults((prev) => [...prev, data]);
    });

    es.addEventListener('complete', (event) => {
      const data = JSON.parse(event.data);

      setDimensionAverages(data.dimensionAverages);
      setDeltaAnalysis(data.deltaAnalysis);
      setOverallScores(data.overallScores);
      setRecognitionMetrics(data.recognitionMetrics);
      setRunId(data.runId);

      setIsRunning(false);
      es.close();
      eventSourceRef.current = null;

      if (onRunComplete) {
        onRunComplete(data.runId);
      }
    });

    es.addEventListener('error', (event) => {
      try {
        const data = JSON.parse((event as MessageEvent).data);
        setError(data.error);
        addLog({ message: `Error: ${data.error}`, level: 'error' });
      } catch {
        setError('Connection error');
        addLog({ message: 'Connection error', level: 'error' });
      }
      setIsRunning(false);
      es.close();
      eventSourceRef.current = null;
    });

    es.onerror = () => {
      if (es.readyState === EventSource.CLOSED) {
        setIsRunning(false);
      }
    };
  }, [addLog, onRunComplete]);

  const cancelRun = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setIsRunning(false);
    addLog({ message: 'Test cancelled by user', level: 'warning' });
  }, [addLog]);

  // Calculate stats for each profile
  const baselineResults = results.filter((r) => r.profile === 'baseline');
  const recognitionResults = results.filter((r) => r.profile === 'recognition');

  const baselineStats = {
    testCount: baselineResults.length,
    successCount: baselineResults.filter((r) => r.passed).length,
    avgLatency: baselineResults.length > 0
      ? baselineResults.reduce((sum, r) => sum + r.latencyMs, 0) / baselineResults.length
      : 0,
  };

  const recognitionStats = {
    testCount: recognitionResults.length,
    successCount: recognitionResults.filter((r) => r.passed).length,
    avgLatency: recognitionResults.length > 0
      ? recognitionResults.reduce((sum, r) => sum + r.latencyMs, 0) / recognitionResults.length
      : 0,
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-gray-900/60 backdrop-blur-sm border border-white/5 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <span className="text-lg">⚖️</span>
            <div>
              <h3 className="text-sm font-medium text-white">Recognition A/B Comparison</h3>
              <p className="text-[10px] text-gray-400">
                baseline (control) vs recognition (treatment)
              </p>
            </div>
          </div>

          {isRunning ? (
            <button
              type="button"
              onClick={cancelRun}
              className="px-3 py-1.5 text-xs bg-red-500/20 text-red-400 rounded-lg border border-red-500/30 hover:bg-red-500/30 transition-colors active:scale-[0.98]"
            >
              Cancel
            </button>
          ) : (
            <button
              type="button"
              onClick={runComparison}
              className="px-3 py-1.5 text-xs bg-yellow-500/20 text-yellow-400 rounded-lg border border-yellow-500/30 hover:bg-yellow-500/30 transition-colors active:scale-[0.98]"
            >
              Run A/B Test
            </button>
          )}
        </div>

        {/* Progress bar */}
        {isRunning && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-gray-400">{currentScenario}</span>
              <span className="text-gray-500">
                {progress.current}/{progress.total} ({progress.percentage}%)
              </span>
            </div>
            <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-yellow-500 to-green-500 rounded-full transition-all duration-300"
                style={{ width: `${progress.percentage}%` }}
              />
            </div>
          </div>
        )}

        {/* Error display */}
        {error && (
          <div className="mt-3 p-2 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400">
            {error}
          </div>
        )}
      </div>

      {/* Results section */}
      {(dimensionAverages || isRunning) && (
        <>
          {/* Overall winner banner */}
          {overallScores?.winner && (
            <div className="bg-gradient-to-r from-yellow-500/10 to-green-500/10 border border-yellow-500/20 rounded-xl p-4 text-center">
              <div className="text-xs text-gray-400 mb-2">Overall Winner</div>
              <WinnerIndicator
                winner={overallScores.winner}
                significance={overallScores.significance}
                size="lg"
              />
              {overallScores.delta != null && (
                <div className="mt-2 text-xs text-gray-500">
                  {overallScores.delta > 0 ? '+' : ''}
                  {overallScores.delta.toFixed(1)} points difference
                </div>
              )}
            </div>
          )}

          {/* Profile comparison cards */}
          <div className="grid grid-cols-2 gap-3">
            <ProfileComparisonCard
              profile="baseline"
              overallScore={overallScores?.baseline ?? null}
              delta={null}
              dimensionAverages={dimensionAverages?.baseline ?? {
                relevance: null,
                specificity: null,
                pedagogical: null,
                personalization: null,
                actionability: null,
                tone: null,
              }}
              testCount={baselineStats.testCount}
              successCount={baselineStats.successCount}
              avgLatency={baselineStats.avgLatency}
              isWinner={overallScores?.winner === 'baseline'}
            />
            <ProfileComparisonCard
              profile="recognition"
              overallScore={overallScores?.recognition ?? null}
              delta={overallScores?.delta ?? null}
              dimensionAverages={dimensionAverages?.recognition ?? {
                relevance: null,
                specificity: null,
                pedagogical: null,
                personalization: null,
                actionability: null,
                tone: null,
              }}
              testCount={recognitionStats.testCount}
              successCount={recognitionStats.successCount}
              avgLatency={recognitionStats.avgLatency}
              isWinner={overallScores?.winner === 'recognition'}
            />
          </div>

          {/* Recognition metrics (only for recognition profile) */}
          {recognitionMetrics && (
            <RecognitionMetricsPanel
              momentsGenerated={recognitionMetrics.momentsGenerated}
              avgDialecticalDepth={recognitionMetrics.avgDialecticalDepth}
              synthesisStrategies={recognitionMetrics.synthesisStrategies}
            />
          )}

          {/* Delta analysis table */}
          {deltaAnalysis.length > 0 && <DeltaAnalysisTable deltaAnalysis={deltaAnalysis} />}
        </>
      )}

      {/* Logs panel (collapsible) */}
      {logs.length > 0 && (
        <details className="bg-gray-900/60 backdrop-blur-sm border border-white/5 rounded-xl">
          <summary className="px-4 py-3 text-xs text-gray-400 cursor-pointer hover:text-gray-300">
            Logs ({logs.length})
          </summary>
          <div className="px-4 pb-4 max-h-40 overflow-y-auto">
            <div className="space-y-1 font-mono text-[10px]">
              {logs.slice(-30).map((log, i) => (
                <div
                  key={i}
                  className={
                    log.level === 'error'
                      ? 'text-red-400'
                      : log.level === 'warning'
                        ? 'text-yellow-400'
                        : log.level === 'success'
                          ? 'text-green-400'
                          : 'text-gray-500'
                  }
                >
                  {log.message}
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          </div>
        </details>
      )}

      {/* Run ID link */}
      {runId && !isRunning && (
        <div className="text-center text-[10px] text-gray-500">
          Run ID: <span className="text-gray-400 font-mono">{runId}</span>
        </div>
      )}
    </div>
  );
};

export default RecognitionABMode;
