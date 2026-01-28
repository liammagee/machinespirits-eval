/**
 * useEvalData Hook
 *
 * Data fetching and caching hook for the mobile evaluation dashboard.
 * Handles all eval API interactions with localStorage caching for offline support.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type {
  EvalProfile,
  EvalScenario,
  EvalRun,
  EvalQuickTestResult,
  EvalDialogue,
  EvalDoc,
  EvalDimensionScores
} from '../types';

// Cache configuration
const CACHE_CONFIG = {
  profiles: { ttl: 300000, key: 'eval-profiles' },      // 5 min
  scenarios: { ttl: 300000, key: 'eval-scenarios' },    // 5 min
  runs: { ttl: 60000, key: 'eval-runs' },               // 1 min
  logDates: { ttl: 300000, key: 'eval-log-dates' },     // 5 min
  docs: { ttl: 3600000, key: 'eval-docs' },             // 1 hour
  lastResult: { ttl: 86400000, key: 'eval-last-result' } // 24 hours - offline viewing
};

// Retry configuration for connection resilience
const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 10000  // 10 seconds
};

// Calculate exponential backoff delay
function getRetryDelay(attempt: number): number {
  const delay = Math.min(
    RETRY_CONFIG.baseDelay * Math.pow(2, attempt),
    RETRY_CONFIG.maxDelay
  );
  // Add jitter
  return delay + Math.random() * 1000;
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

function getCached<T>(key: string, ttl: number): T | null {
  try {
    const cached = localStorage.getItem(key);
    if (!cached) return null;

    const entry: CacheEntry<T> = JSON.parse(cached);
    if (Date.now() - entry.timestamp > ttl) {
      localStorage.removeItem(key);
      return null;
    }
    return entry.data;
  } catch {
    return null;
  }
}

function setCache<T>(key: string, data: T): void {
  try {
    const entry: CacheEntry<T> = { data, timestamp: Date.now() };
    localStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // Storage full or unavailable
  }
}

export interface StreamLog {
  type: 'info' | 'success' | 'warning' | 'error' | 'progress';
  message: string;
  timestamp: number;
}

export interface RunStats {
  provider: string;
  model: string;
  totalTests: number;
  successfulTests: number;
  successRate: number;
  avgScore: number | null;
  dimensions: EvalDimensionScores;
  avgLatencyMs: number;
}

export interface RunDetails {
  run: EvalRun;
  stats: RunStats[];
  results: EvalQuickTestResult[];
}

export interface MatrixResult {
  profiles: string[];
  scenariosRun: number;
  dimensionAverages: Record<string, Record<string, number>>;
  rankings: Array<{ profile: string; avgScore: number; rank: number }>;
  results: EvalQuickTestResult[];
  runId?: string;
}

export interface UseEvalDataReturn {
  // Data
  profiles: EvalProfile[];
  scenarios: EvalScenario[];
  runs: EvalRun[];
  logDates: string[];
  docs: EvalDoc[];

  // Quick Test
  runQuickTest: (scenario: string, profile: string) => void;
  isTestRunning: boolean;
  testResult: EvalQuickTestResult | null;
  streamLogs: StreamLog[];
  clearTestResult: () => void;

  // Matrix Test
  runMatrixTest: (profiles: string[], scenarios: string[]) => void;
  isMatrixRunning: boolean;
  matrixResult: MatrixResult | null;
  clearMatrixResult: () => void;

  // History
  loadRuns: () => Promise<void>;
  loadRunDetails: (runId: string) => Promise<RunDetails | null>;

  // Logs
  loadLogDates: () => Promise<void>;
  loadDialogues: (date: string, offset?: number, limit?: number) => Promise<{
    dialogues: EvalDialogue[];
    total: number;
    hasMore: boolean;
  }>;
  loadDialogueById: (dialogueId: string) => Promise<EvalDialogue | null>;

  // Docs
  loadDocs: () => Promise<void>;
  loadDocContent: (name: string) => Promise<string | null>;

  // State
  isLoading: boolean;
  isInitialLoading: boolean;
  error: string | null;
  clearError: () => void;
}

export function useEvalData(): UseEvalDataReturn {
  // Core data
  const [profiles, setProfiles] = useState<EvalProfile[]>([]);
  const [scenarios, setScenarios] = useState<EvalScenario[]>([]);
  const [runs, setRuns] = useState<EvalRun[]>([]);
  const [logDates, setLogDates] = useState<string[]>([]);
  const [docs, setDocs] = useState<EvalDoc[]>([]);

  // Quick test state
  const [isTestRunning, setIsTestRunning] = useState(false);
  const [testResult, setTestResult] = useState<EvalQuickTestResult | null>(null);
  const [streamLogs, setStreamLogs] = useState<StreamLog[]>([]);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Matrix test state
  const [isMatrixRunning, setIsMatrixRunning] = useState(false);
  const [matrixResult, setMatrixResult] = useState<MatrixResult | null>(null);
  const matrixEventSourceRef = useRef<EventSource | null>(null);

  // General state
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load profiles and scenarios on mount
  useEffect(() => {
    const loadInitialData = async () => {
      setIsInitialLoading(true);

      // Try cache first (only use if non-empty)
      const cachedProfiles = getCached<EvalProfile[]>(
        CACHE_CONFIG.profiles.key,
        CACHE_CONFIG.profiles.ttl
      );
      const cachedScenarios = getCached<EvalScenario[]>(
        CACHE_CONFIG.scenarios.key,
        CACHE_CONFIG.scenarios.ttl
      );

      // Only use cache if it has actual data
      const hasValidProfileCache = cachedProfiles && cachedProfiles.length > 0;
      const hasValidScenarioCache = cachedScenarios && cachedScenarios.length > 0;

      if (hasValidProfileCache) setProfiles(cachedProfiles);
      if (hasValidScenarioCache) setScenarios(cachedScenarios);

      // Fetch fresh data if no valid cache
      if (!hasValidProfileCache || !hasValidScenarioCache) {
        try {
          const [profilesRes, scenariosRes] = await Promise.all([
            fetch('/api/eval/profiles'),
            fetch('/api/eval/scenarios')
          ]);

          if (profilesRes.ok) {
            const data = await profilesRes.json();
            const profileList = data.profiles || [];
            if (profileList.length > 0) {
              setProfiles(profileList);
              setCache(CACHE_CONFIG.profiles.key, profileList);
            }
          }

          if (scenariosRes.ok) {
            const data = await scenariosRes.json();
            const scenarioList = data.scenarios || [];
            if (scenarioList.length > 0) {
              setScenarios(scenarioList);
              setCache(CACHE_CONFIG.scenarios.key, scenarioList);
            }
          }
        } catch (err) {
          console.error('Failed to load initial eval data:', err);
          setError('Failed to load profiles and scenarios');
        }
      }

      setIsInitialLoading(false);
    };

    loadInitialData();
  }, []);

  // Ref for retry timeout (used in runQuickTest)
  const retryTimeoutCleanupRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup EventSources and retry timeouts on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (matrixEventSourceRef.current) {
        matrixEventSourceRef.current.close();
      }
      if (retryTimeoutCleanupRef.current) {
        clearTimeout(retryTimeoutCleanupRef.current);
      }
    };
  }, []);

  const clearError = useCallback(() => setError(null), []);
  const clearTestResult = useCallback(() => {
    setTestResult(null);
    setStreamLogs([]);
  }, []);
  const clearMatrixResult = useCallback(() => {
    setMatrixResult(null);
    setStreamLogs([]);
  }, []);

  // Track current test config for retry
  const currentTestConfigRef = useRef<{ scenarioId: string; profile: string } | null>(null);
  const retryCountRef = useRef(0);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Use a ref to hold the run function for self-reference in retry logic
  const runQuickTestRef = useRef<(scenarioId: string, profile: string, isRetry?: boolean) => void>();

  // Quick Test with streaming and auto-retry
  const runQuickTest = useCallback((scenarioId: string, profile: string, isRetry = false) => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    // Clear any pending retry
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

    // Reset retry count for new tests
    if (!isRetry) {
      retryCountRef.current = 0;
      currentTestConfigRef.current = { scenarioId, profile };
    }

    setIsTestRunning(true);
    if (!isRetry) {
      setTestResult(null);
      setStreamLogs([]);
    }
    setError(null);

    const params = new URLSearchParams({
      scenario: scenarioId,
      profile: profile
    });

    const eventSource = new EventSource(`/api/eval/stream/quick?${params}`);
    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'log') {
          setStreamLogs(prev => [...prev, {
            type: data.level || 'info',
            message: data.message || data.content || '',
            timestamp: Date.now()
          }]);
        } else if (data.type === 'progress') {
          setStreamLogs(prev => [...prev, {
            type: 'progress',
            message: `Progress: ${data.current}/${data.total} (${data.percentage}%)`,
            timestamp: Date.now()
          }]);
        } else if (data.type === 'result') {
          setTestResult(data.result);
          // Save result for offline viewing
          setCache(CACHE_CONFIG.lastResult.key, data.result);
        } else if (data.type === 'complete') {
          setIsTestRunning(false);
          retryCountRef.current = 0; // Reset on success
          currentTestConfigRef.current = null;
          eventSource.close();
        } else if (data.type === 'error') {
          setError(data.message || 'Test failed');
          setIsTestRunning(false);
          retryCountRef.current = 0;
          currentTestConfigRef.current = null;
          eventSource.close();
        }
      } catch (err) {
        console.error('Failed to parse SSE message:', err);
      }
    };

    eventSource.onerror = () => {
      eventSource.close();

      // Auto-retry if we haven't exceeded max retries
      if (retryCountRef.current < RETRY_CONFIG.maxRetries && currentTestConfigRef.current) {
        retryCountRef.current++;
        const delay = getRetryDelay(retryCountRef.current);

        setStreamLogs(prev => [...prev, {
          type: 'warning',
          message: `Connection lost. Retrying in ${Math.round(delay / 1000)}s... (${retryCountRef.current}/${RETRY_CONFIG.maxRetries})`,
          timestamp: Date.now()
        }]);

        retryTimeoutRef.current = setTimeout(() => {
          if (currentTestConfigRef.current && runQuickTestRef.current) {
            runQuickTestRef.current(
              currentTestConfigRef.current.scenarioId,
              currentTestConfigRef.current.profile,
              true
            );
          }
        }, delay);
      } else {
        setError('Connection lost. Please try again when you have a better connection.');
        setIsTestRunning(false);
        currentTestConfigRef.current = null;
      }
    };
  }, []);

  // Keep the ref updated
  runQuickTestRef.current = runQuickTest;

  // Matrix Test with streaming
  const runMatrixTest = useCallback((profileList: string[], scenarioList: string[]) => {
    if (matrixEventSourceRef.current) {
      matrixEventSourceRef.current.close();
    }

    setIsMatrixRunning(true);
    setMatrixResult(null);
    setStreamLogs([]);
    setError(null);

    const params = new URLSearchParams({
      profiles: profileList.join(','),
      scenarios: scenarioList.length > 0 ? scenarioList.join(',') : 'all'
    });

    const eventSource = new EventSource(`/api/eval/stream/matrix?${params}`);
    matrixEventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'log') {
          setStreamLogs(prev => [...prev, {
            type: data.level || 'info',
            message: data.message || data.content || '',
            timestamp: Date.now()
          }]);
        } else if (data.type === 'progress') {
          setStreamLogs(prev => [...prev, {
            type: 'progress',
            message: data.message || `Test ${data.current}/${data.total}`,
            timestamp: Date.now()
          }]);
        } else if (data.type === 'complete') {
          setMatrixResult({
            profiles: data.profiles || [],
            scenariosRun: data.scenariosRun || 0,
            dimensionAverages: data.dimensionAverages || {},
            rankings: data.rankings || [],
            results: data.results || [],
            runId: data.runId
          });
          setIsMatrixRunning(false);
          eventSource.close();
        } else if (data.type === 'error') {
          setError(data.error || 'Matrix test failed');
          setIsMatrixRunning(false);
          eventSource.close();
        }
      } catch (err) {
        console.error('Failed to parse SSE message:', err);
      }
    };

    eventSource.onerror = () => {
      setError('Connection lost during matrix test');
      setIsMatrixRunning(false);
      eventSource.close();
    };
  }, []);

  // Load runs
  const loadRuns = useCallback(async () => {
    setIsLoading(true);
    try {
      // Try cache first
      const cached = getCached<EvalRun[]>(CACHE_CONFIG.runs.key, CACHE_CONFIG.runs.ttl);
      if (cached) {
        setRuns(cached);
        setIsLoading(false);
        return;
      }

      const res = await fetch('/api/eval/runs?limit=50');
      if (!res.ok) throw new Error('Failed to load runs');

      const data = await res.json();
      const runList = data.runs || [];
      setRuns(runList);
      setCache(CACHE_CONFIG.runs.key, runList);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load runs');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load run details
  const loadRunDetails = useCallback(async (runId: string): Promise<RunDetails | null> => {
    try {
      const res = await fetch(`/api/eval/runs/${runId}`);
      if (!res.ok) throw new Error('Failed to load run details');

      const data = await res.json();
      return {
        run: data.run,
        stats: data.stats || [],
        results: data.results || []
      };
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load run details');
      return null;
    }
  }, []);

  // Load log dates
  const loadLogDates = useCallback(async () => {
    setIsLoading(true);
    try {
      const cached = getCached<string[]>(CACHE_CONFIG.logDates.key, CACHE_CONFIG.logDates.ttl);
      if (cached) {
        setLogDates(cached);
        setIsLoading(false);
        return;
      }

      const res = await fetch('/api/eval/logs/dates');
      if (!res.ok) throw new Error('Failed to load log dates');

      const data = await res.json();
      const dates = data.dates || [];
      setLogDates(dates);
      setCache(CACHE_CONFIG.logDates.key, dates);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load log dates');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load dialogues for a date
  const loadDialogues = useCallback(async (
    date: string,
    offset = 0,
    limit = 10
  ): Promise<{ dialogues: EvalDialogue[]; total: number; hasMore: boolean }> => {
    try {
      const res = await fetch(`/api/eval/logs/${date}?offset=${offset}&limit=${limit}`);
      if (!res.ok) throw new Error('Failed to load dialogues');

      const data = await res.json();
      return {
        dialogues: data.dialogues || [],
        total: data.total || 0,
        hasMore: data.hasMore || false
      };
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dialogues');
      return { dialogues: [], total: 0, hasMore: false };
    }
  }, []);

  // Load single dialogue by ID
  const loadDialogueById = useCallback(async (dialogueId: string): Promise<EvalDialogue | null> => {
    try {
      const res = await fetch(`/api/eval/logs/dialogue/${dialogueId}`);
      if (!res.ok) throw new Error('Failed to load dialogue');

      const data = await res.json();
      return data.dialogue || null;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dialogue');
      return null;
    }
  }, []);

  // Load docs
  const loadDocs = useCallback(async () => {
    setIsLoading(true);
    try {
      const cached = getCached<EvalDoc[]>(CACHE_CONFIG.docs.key, CACHE_CONFIG.docs.ttl);
      if (cached) {
        setDocs(cached);
        setIsLoading(false);
        return;
      }

      const res = await fetch('/api/eval/docs');
      if (!res.ok) throw new Error('Failed to load docs');

      const data = await res.json();
      const docList = data.docs || [];
      setDocs(docList);
      setCache(CACHE_CONFIG.docs.key, docList);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load docs');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load doc content
  const loadDocContent = useCallback(async (name: string): Promise<string | null> => {
    try {
      const res = await fetch(`/api/eval/docs/${name}`);
      if (!res.ok) throw new Error('Failed to load doc content');

      const data = await res.json();
      return data.content || null;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load doc');
      return null;
    }
  }, []);

  return {
    // Data
    profiles,
    scenarios,
    runs,
    logDates,
    docs,

    // Quick Test
    runQuickTest,
    isTestRunning,
    testResult,
    streamLogs,
    clearTestResult,

    // Matrix Test
    runMatrixTest,
    isMatrixRunning,
    matrixResult,
    clearMatrixResult,

    // History
    loadRuns,
    loadRunDetails,

    // Logs
    loadLogDates,
    loadDialogues,
    loadDialogueById,

    // Docs
    loadDocs,
    loadDocContent,

    // State
    isLoading,
    isInitialLoading,
    error,
    clearError
  };
}

export default useEvalData;
