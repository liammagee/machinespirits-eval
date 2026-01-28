/**
 * QuickTestView Component
 *
 * Test execution view with profile/scenario selection,
 * streaming output, and result display.
 * Supports both Quick (single) and Matrix (comparison) modes.
 *
 * Mobile-first features:
 * - Quick Actions: Re-run last test, favorites for one-tap access
 * - Compact mode: Minimal UI while test runs, glanceable status
 * - Haptic feedback on completion
 */

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import type { EvalProfile, EvalScenario, EvalQuickTestResult } from '../../types';
import type { StreamLog, MatrixResult } from '../../hooks/useEvalData';
import { ScoreRadial } from './ScoreRadial';
import { DimensionBreakdown } from './DimensionBreakdown';
import { StreamingLogPanel } from './StreamingLogPanel';
import haptics from '../../utils/haptics';

type TestMode = 'quick' | 'matrix';

// Saved test configuration for quick re-run
interface SavedTestConfig {
  profile: string;
  scenario: string;
  scenarioName?: string;
  timestamp: number;
}

// Favorite preset
interface FavoritePreset {
  id: string;
  name: string;
  profile: string;
  scenario: string;
}

// LocalStorage keys
const STORAGE_KEYS = {
  lastTest: 'eval-last-test',
  favorites: 'eval-favorites',
  compactMode: 'eval-compact-mode'
};

// Load from localStorage
function loadLastTest(): SavedTestConfig | null {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.lastTest);
    return data ? JSON.parse(data) : null;
  } catch { return null; }
}

function loadFavorites(): FavoritePreset[] {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.favorites);
    return data ? JSON.parse(data) : [];
  } catch { return []; }
}

function saveFavorites(favorites: FavoritePreset[]) {
  try {
    localStorage.setItem(STORAGE_KEYS.favorites, JSON.stringify(favorites));
  } catch { /* Storage full */ }
}

function saveLastTest(config: SavedTestConfig) {
  try {
    localStorage.setItem(STORAGE_KEYS.lastTest, JSON.stringify(config));
  } catch { /* Storage full */ }
}

interface QuickTestViewProps {
  profiles: EvalProfile[];
  scenarios: EvalScenario[];
  onRunTest: (scenario: string, profile: string) => void;
  onRunMatrix: (profiles: string[], scenarios: string[]) => void;
  isRunning: boolean;
  isMatrixRunning: boolean;
  isLoadingData?: boolean;
  result: EvalQuickTestResult | null;
  matrixResult: MatrixResult | null;
  streamLogs: StreamLog[];
  onClearResult: () => void;
  onClearMatrixResult: () => void;
}

export const QuickTestView: React.FC<QuickTestViewProps> = ({
  profiles,
  scenarios,
  onRunTest,
  onRunMatrix,
  isRunning,
  isMatrixRunning,
  isLoadingData = false,
  result,
  matrixResult,
  streamLogs,
  onClearResult,
  onClearMatrixResult
}) => {
  const [mode, setMode] = useState<TestMode>('quick');
  const [selectedProfile, setSelectedProfile] = useState<string>('');
  const [selectedProfiles, setSelectedProfiles] = useState<Set<string>>(new Set());
  const [selectedScenario, setSelectedScenario] = useState<string>('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Quick Actions state
  const [lastTest, setLastTest] = useState<SavedTestConfig | null>(null);
  const [favorites, setFavorites] = useState<FavoritePreset[]>([]);
  const [showQuickActions, setShowQuickActions] = useState(true);
  const [compactMode, setCompactMode] = useState(false);
  const [showFavoriteModal, setShowFavoriteModal] = useState(false);
  const [newFavoriteName, setNewFavoriteName] = useState('');
  const prevIsRunning = React.useRef(false);

  // Load saved data on mount
  useEffect(() => {
    setLastTest(loadLastTest());
    setFavorites(loadFavorites());
  }, []);

  // Haptic feedback when test completes + title notification
  useEffect(() => {
    const wasRunning = prevIsRunning.current;
    const nowComplete = !isRunning && !isMatrixRunning;

    if (wasRunning && nowComplete) {
      // Strong haptic on completion
      haptics.heavy();

      // Update document title to notify user
      if (result) {
        const score = result.overallScore?.toFixed(1) || '?';
        document.title = result.passed ? `✓ ${score} - Eval` : `✗ ${score} - Eval`;

        // Reset title after 5 seconds
        setTimeout(() => {
          document.title = 'Eval Dashboard';
        }, 5000);
      }
    }

    prevIsRunning.current = isRunning || isMatrixRunning;
  }, [isRunning, isMatrixRunning, result]);

  // Group scenarios by category
  const scenariosByCategory = useMemo(() => {
    const grouped: Record<string, EvalScenario[]> = {};
    scenarios.forEach((s) => {
      const category = s.category || 'General';
      if (!grouped[category]) grouped[category] = [];
      grouped[category].push(s);
    });
    return grouped;
  }, [scenarios]);

  // Set default profile when profiles load
  useEffect(() => {
    if (profiles.length > 0 && !selectedProfile) {
      setSelectedProfile(profiles[0].name);
    }
  }, [profiles, selectedProfile]);

  const handleRunTest = useCallback(() => {
    if (!selectedScenario || !selectedProfile) return;
    haptics.button();

    // Save as last test
    const scenario = scenarios.find(s => s.id === selectedScenario);
    const config: SavedTestConfig = {
      profile: selectedProfile,
      scenario: selectedScenario,
      scenarioName: scenario?.name,
      timestamp: Date.now()
    };
    saveLastTest(config);
    setLastTest(config);

    // Enter compact mode automatically
    setCompactMode(true);

    onRunTest(selectedScenario, selectedProfile);
  }, [selectedScenario, selectedProfile, scenarios, onRunTest]);

  const handleRunMatrix = useCallback(() => {
    if (selectedProfiles.size < 2) return;
    haptics.button();
    setCompactMode(true);
    onRunMatrix(Array.from(selectedProfiles), selectedScenario ? [selectedScenario] : []);
  }, [selectedProfiles, selectedScenario, onRunMatrix]);

  const handleClearResult = useCallback(() => {
    haptics.light();
    if (mode === 'matrix') {
      onClearMatrixResult();
    } else {
      onClearResult();
    }
    setShowSuggestions(false);
    setCompactMode(false);
  }, [mode, onClearMatrixResult, onClearResult]);

  // Quick Actions
  const handleRerunLast = useCallback(() => {
    if (!lastTest) return;
    haptics.button();

    // Set selections
    setSelectedProfile(lastTest.profile);
    setSelectedScenario(lastTest.scenario);
    setMode('quick');
    setCompactMode(true);

    // Run immediately
    onRunTest(lastTest.scenario, lastTest.profile);
  }, [lastTest, onRunTest]);

  const handleRunFavorite = useCallback((fav: FavoritePreset) => {
    haptics.button();
    setSelectedProfile(fav.profile);
    setSelectedScenario(fav.scenario);
    setMode('quick');
    setCompactMode(true);
    onRunTest(fav.scenario, fav.profile);
  }, [onRunTest]);

  const handleAddFavorite = useCallback(() => {
    if (!selectedProfile || !selectedScenario || !newFavoriteName.trim()) return;

    const newFav: FavoritePreset = {
      id: `fav-${Date.now()}`,
      name: newFavoriteName.trim(),
      profile: selectedProfile,
      scenario: selectedScenario
    };

    const updated = [...favorites, newFav];
    setFavorites(updated);
    saveFavorites(updated);
    setShowFavoriteModal(false);
    setNewFavoriteName('');
    haptics.success();
  }, [selectedProfile, selectedScenario, newFavoriteName, favorites]);

  const handleRemoveFavorite = useCallback((favId: string) => {
    haptics.light();
    const updated = favorites.filter(f => f.id !== favId);
    setFavorites(updated);
    saveFavorites(updated);
  }, [favorites]);

  const toggleProfileSelection = (profileName: string) => {
    haptics.light();
    const newSet = new Set(selectedProfiles);
    if (newSet.has(profileName)) {
      newSet.delete(profileName);
    } else {
      newSet.add(profileName);
    }
    setSelectedProfiles(newSet);
  };

  const handleModeChange = (newMode: TestMode) => {
    haptics.light();
    setMode(newMode);
    // Clear results when switching modes
    if (newMode === 'quick') {
      onClearMatrixResult();
    } else {
      onClearResult();
    }
  };

  const selectedProfileData = profiles.find((p) => p.name === selectedProfile);
  const anyRunning = isRunning || isMatrixRunning;
  const hasQuickActions = lastTest || favorites.length > 0;
  const currentScenario = scenarios.find(s => s.id === selectedScenario);

  // Compact Running Mode - shows only essential status with premium styling
  if (compactMode && anyRunning) {
    const latestLog = streamLogs[streamLogs.length - 1];
    const progressLog = streamLogs.filter(l => l.type === 'progress').pop();

    return (
      <div className="flex flex-col h-full bg-[#0a0a0a]">
        {/* Compact header with pulsing indicator - Glass style */}
        <div className="flex-shrink-0 p-4 border-b border-white/5 bg-gray-900/50 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                <div className="absolute inset-0 w-3 h-3 bg-green-500 rounded-full animate-ping opacity-75" />
              </div>
              <div>
                <div className="text-sm font-semibold text-white">
                  {lastTest?.scenarioName || 'Running Test...'}
                </div>
                <div className="text-xs text-gray-500">{selectedProfile}</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setCompactMode(false)}
              className="text-xs text-gray-400 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg
                hover:bg-white/10 transition-colors"
            >
              Expand
            </button>
          </div>

          {/* Progress bar - Gradient glow */}
          {progressLog && (
            <div className="mt-4">
              <div className="h-1.5 bg-gray-800/50 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#E63946] to-[#d62839] rounded-full
                    shadow-[0_0_10px_rgba(230,57,70,0.5)] transition-all duration-300"
                  style={{
                    width: progressLog.message.includes('%')
                      ? progressLog.message.match(/(\d+)%/)?.[1] + '%'
                      : '50%'
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Latest status line - Centered with animation */}
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center">
            {/* Animated status icon */}
            <div className="relative inline-block mb-6">
              <div className="absolute inset-0 rounded-full bg-gradient-to-r from-[#E63946]/20 to-[#d62839]/20 animate-spin"
                style={{ animationDuration: '4s' }} />
              <div className="relative w-24 h-24 rounded-full bg-gray-900/80 backdrop-blur-sm border border-white/10
                flex items-center justify-center">
                <span className="text-4xl">
                  {latestLog?.type === 'success' ? '✓' :
                   latestLog?.type === 'error' ? '✗' :
                   latestLog?.type === 'warning' ? '⚠' : '◐'}
                </span>
              </div>
            </div>
            <div className="text-sm text-gray-300 font-medium max-w-xs mx-auto line-clamp-2">
              {latestLog?.message || 'Starting evaluation...'}
            </div>
            <div className="flex justify-center gap-1.5 mt-6">
              <span className="w-2 h-2 rounded-full bg-[#E63946]/60 animate-pulse" />
              <span className="w-2 h-2 rounded-full bg-[#E63946]/60 animate-pulse" style={{ animationDelay: '0.2s' }} />
              <span className="w-2 h-2 rounded-full bg-[#E63946]/60 animate-pulse" style={{ animationDelay: '0.4s' }} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Quick Actions Bar - Glass morphism with premium feel */}
      {showQuickActions && hasQuickActions && !anyRunning && !result && !matrixResult && (
        <div className="flex-shrink-0 border-b border-white/5 bg-gradient-to-r from-gray-900/80 via-gray-800/60 to-gray-900/80 backdrop-blur-xl">
          <div className="flex items-center gap-3 p-3 overflow-x-auto scrollbar-hide">
            {/* Re-run Last - Hero button with glow */}
            {lastTest && (
              <button
                type="button"
                onClick={handleRerunLast}
                className="flex-shrink-0 flex items-center gap-2.5 px-5 py-3
                  bg-gradient-to-r from-[#E63946] to-[#d62839] text-white
                  rounded-xl text-sm font-semibold
                  shadow-lg shadow-[#E63946]/25
                  active:scale-[0.98] active:shadow-md
                  transition-all duration-150"
                style={{ minHeight: '48px' }}
              >
                <svg className="w-4 h-4 animate-[spin_3s_linear_infinite]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>Re-run</span>
              </button>
            )}

            {/* Favorites - Refined glass cards */}
            {favorites.map((fav) => (
              <button
                key={fav.id}
                type="button"
                onClick={() => handleRunFavorite(fav)}
                className="flex-shrink-0 flex items-center gap-2.5 px-4 py-3
                  bg-white/5 backdrop-blur-sm border border-white/10
                  text-white rounded-xl text-sm font-medium
                  hover:bg-white/10 hover:border-white/20
                  active:scale-[0.98]
                  transition-all duration-150 group"
                style={{ minHeight: '48px' }}
              >
                <span className="text-amber-400 text-base">★</span>
                <span className="max-w-[100px] truncate">{fav.name}</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveFavorite(fav.id);
                  }}
                  className="ml-1 w-5 h-5 flex items-center justify-center rounded-full
                    text-gray-500 hover:text-white hover:bg-red-500/80
                    opacity-0 group-hover:opacity-100 transition-all"
                >
                  ×
                </button>
              </button>
            ))}

            {/* Collapse - Minimal */}
            <button
              type="button"
              onClick={() => setShowQuickActions(false)}
              className="flex-shrink-0 w-8 h-8 flex items-center justify-center
                rounded-full text-gray-500 hover:text-white hover:bg-white/10
                transition-all"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Show Quick Actions toggle if hidden */}
      {!showQuickActions && hasQuickActions && !anyRunning && !result && !matrixResult && (
        <button
          type="button"
          onClick={() => setShowQuickActions(true)}
          className="flex-shrink-0 flex items-center justify-center gap-2 py-2 text-xs text-gray-500 border-b border-gray-800"
        >
          <span>↓</span> Quick Actions <span>↓</span>
        </button>
      )}

      {/* Configuration Section - Glass panel */}
      <div className="flex-shrink-0 p-4 space-y-5 border-b border-white/5 bg-gradient-to-b from-gray-900/30 to-transparent">
        {/* Mode Toggle - Premium segmented control */}
        <div className="relative flex bg-gray-900/80 backdrop-blur-sm rounded-xl p-1 border border-white/5">
          {/* Animated sliding background */}
          <div
            className="absolute top-1 bottom-1 w-[calc(50%-4px)] bg-gradient-to-r from-[#E63946] to-[#d62839] rounded-lg shadow-lg shadow-[#E63946]/20 transition-all duration-300 ease-out"
            style={{ left: mode === 'quick' ? '4px' : 'calc(50% + 0px)' }}
          />
          <button
            type="button"
            onClick={() => handleModeChange('quick')}
            className={`relative flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all duration-300
              ${mode === 'quick'
                ? 'text-white'
                : 'text-gray-400 hover:text-gray-200'
              }`}
          >
            Quick Test
          </button>
          <button
            type="button"
            onClick={() => handleModeChange('matrix')}
            className={`relative flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all duration-300
              ${mode === 'matrix'
                ? 'text-white'
                : 'text-gray-400 hover:text-gray-200'
              }`}
          >
            Matrix Compare
          </button>
        </div>

        {/* Profile Selection - Premium cards */}
        <div>
          <label className="block text-xs text-gray-500 mb-3 uppercase tracking-wider font-medium">
            {mode === 'matrix' ? 'Compare Profiles (2+)' : 'Tutor Profile'}
          </label>
          {isLoadingData && profiles.length === 0 ? (
            <div className="flex gap-3 pb-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-16 w-28 bg-gray-800/50 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : profiles.length === 0 ? (
            <div className="text-sm text-gray-500 py-4 text-center bg-gray-900/30 rounded-xl border border-white/5">
              No profiles available
            </div>
          ) : (
            <div className="relative">
              {/* Fade edges */}
              <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-[#0a0a0a] to-transparent z-10 pointer-events-none" />
              <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-[#0a0a0a] to-transparent z-10 pointer-events-none" />

              <div className="flex gap-3 overflow-x-auto pb-3 px-1 scrollbar-hide -mx-1">
                {profiles.map((p, idx) => {
                  const isSelected = mode === 'matrix'
                    ? selectedProfiles.has(p.name)
                    : selectedProfile === p.name;

                  // Profile color based on type
                  const colors = [
                    { bg: 'bg-blue-500/20', border: 'border-blue-500/30', dot: 'bg-blue-400' },
                    { bg: 'bg-purple-500/20', border: 'border-purple-500/30', dot: 'bg-purple-400' },
                    { bg: 'bg-green-500/20', border: 'border-green-500/30', dot: 'bg-green-400' },
                    { bg: 'bg-amber-500/20', border: 'border-amber-500/30', dot: 'bg-amber-400' },
                    { bg: 'bg-cyan-500/20', border: 'border-cyan-500/30', dot: 'bg-cyan-400' },
                    { bg: 'bg-pink-500/20', border: 'border-pink-500/30', dot: 'bg-pink-400' },
                  ];
                  const color = colors[idx % colors.length];

                  return (
                    <button
                      key={p.name}
                      type="button"
                      onClick={() => {
                        if (mode === 'matrix') {
                          toggleProfileSelection(p.name);
                        } else {
                          haptics.light();
                          setSelectedProfile(p.name);
                        }
                      }}
                      className={`flex-shrink-0 p-3 rounded-xl text-left transition-all duration-200 active:scale-[0.97]
                        ${isSelected
                          ? 'bg-gradient-to-br from-[#E63946]/20 to-[#d62839]/10 border-2 border-[#E63946]/50 shadow-lg shadow-[#E63946]/10'
                          : `${color.bg} border ${color.border} hover:border-white/20`
                        }`}
                      style={{ minWidth: '120px' }}
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <div className={`w-2.5 h-2.5 rounded-full ${isSelected ? 'bg-[#E63946]' : color.dot}`} />
                        <span className={`text-sm font-semibold truncate ${isSelected ? 'text-white' : 'text-gray-200'}`}>
                          {p.name}
                        </span>
                        {mode === 'matrix' && isSelected && (
                          <svg className="w-4 h-4 text-[#E63946] ml-auto flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                      <p className={`text-[10px] line-clamp-1 ${isSelected ? 'text-gray-300' : 'text-gray-500'}`}>
                        {p.description?.split(' ').slice(0, 4).join(' ')}...
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {mode === 'matrix' && (
            <div className="flex items-center gap-2 mt-2">
              <div className={`text-xs font-medium px-2.5 py-1 rounded-full
                ${selectedProfiles.size >= 2
                  ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                  : 'bg-gray-800/50 text-gray-500 border border-white/5'}`}>
                {selectedProfiles.size} selected
              </div>
              {selectedProfiles.size < 2 && (
                <span className="text-xs text-gray-600">Select at least 2</span>
              )}
            </div>
          )}
        </div>

        {/* Scenario Selection - Enhanced */}
        <div>
          <label className="block text-xs text-gray-500 mb-3 uppercase tracking-wider font-medium">
            {mode === 'matrix' ? 'Scenario (or all)' : 'Test Scenario'}
          </label>
          {isLoadingData && scenarios.length === 0 ? (
            <div className="h-16 bg-gray-800/50 rounded-xl animate-pulse" />
          ) : (
            <div className="relative group">
              <select
                value={selectedScenario}
                onChange={(e) => {
                  haptics.light();
                  setSelectedScenario(e.target.value);
                }}
                disabled={scenarios.length === 0}
                className="w-full appearance-none bg-gray-900/60 backdrop-blur-sm
                  border border-white/10 rounded-xl p-4 pr-14 text-base text-white
                  focus:outline-none focus:border-[#E63946]/50 focus:ring-2 focus:ring-[#E63946]/20
                  disabled:opacity-50 transition-all duration-200
                  hover:border-white/20 hover:bg-gray-900/80"
                style={{ fontSize: '16px' }} // Prevent iOS zoom
              >
                <option value="">
                  {scenarios.length === 0
                    ? 'No scenarios available'
                    : mode === 'matrix'
                      ? '◎ All scenarios'
                      : '○ Select scenario...'}
                </option>
                {Object.entries(scenariosByCategory).map(([category, items]) => (
                  <optgroup key={category} label={`── ${category} ──`}>
                    {items.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} {s.isMultiTurn ? `• ${s.turnCount} turns` : ''}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              {/* Custom dropdown arrow with animation */}
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none
                w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center
                group-hover:bg-white/10 transition-colors">
                <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          )}
          {/* Selected scenario preview */}
          {selectedScenario && currentScenario && (
            <div className="mt-3 p-3 bg-white/5 rounded-xl border border-white/5">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#E63946]/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm">🎯</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white truncate">{currentScenario.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {currentScenario.category || 'General'}
                    {currentScenario.isMultiTurn && ` • ${currentScenario.turnCount} turns`}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Run Button Row */}
        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={mode === 'matrix' ? handleRunMatrix : handleRunTest}
            disabled={
              anyRunning ||
              isLoadingData ||
              (mode === 'quick' && (!selectedScenario || !selectedProfile)) ||
              (mode === 'matrix' && selectedProfiles.size < 2)
            }
            className="flex-1 bg-gradient-to-r from-[#E63946] to-[#d62839] text-white py-4 rounded-2xl text-lg font-bold
              disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none disabled:from-gray-700 disabled:to-gray-600
              active:scale-[0.98] transition-all duration-200
              shadow-xl shadow-[#E63946]/30 hover:shadow-2xl hover:shadow-[#E63946]/40
              flex items-center justify-center gap-3
              relative overflow-hidden group"
            style={{ minHeight: '60px' }}
          >
            {/* Shimmer effect when enabled */}
            {!anyRunning && (selectedScenario || mode === 'matrix') && (
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent
                translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
            )}
            {anyRunning ? (
              <>
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span>{isMatrixRunning ? 'Running Matrix...' : 'Running...'}</span>
              </>
            ) : mode === 'matrix' ? (
              <>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <span>Compare {selectedProfiles.size} Profiles</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Run Test</span>
              </>
            )}
          </button>

          {/* Save as Favorite button - only for quick mode with valid selection */}
          {mode === 'quick' && selectedProfile && selectedScenario && !anyRunning && (
            <button
              type="button"
              onClick={() => {
                haptics.light();
                setShowFavoriteModal(true);
                setNewFavoriteName(currentScenario?.name?.slice(0, 20) || '');
              }}
              className="flex-shrink-0 w-14 bg-gray-900/80 backdrop-blur-sm border border-white/10
                text-amber-400 rounded-xl
                flex items-center justify-center
                active:scale-[0.95] hover:border-amber-400/30 hover:bg-amber-400/5
                transition-all duration-200"
              style={{ minHeight: '58px' }}
              title="Save as favorite"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
            </button>
          )}
        </div>

        {/* Save as Favorite Modal - Glass morphism */}
        {showFavoriteModal && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm"
               onClick={() => setShowFavoriteModal(false)}>
            <div
              className="w-full max-w-lg bg-gray-900/95 backdrop-blur-xl border-t border-white/10
                rounded-t-3xl p-5 space-y-5 animate-slide-up"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-10 h-1 bg-white/20 rounded-full mx-auto" />
              <h3 className="text-xl font-bold text-white text-center">Save as Favorite</h3>

              <div className="space-y-4">
                <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/5">
                  <div className="w-10 h-10 rounded-full bg-[#E63946]/20 flex items-center justify-center">
                    <span className="text-lg">⚙️</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-gray-500 uppercase tracking-wide">Configuration</div>
                    <div className="text-sm text-white truncate">{selectedProfile} → {currentScenario?.name}</div>
                  </div>
                </div>
                <input
                  type="text"
                  value={newFavoriteName}
                  onChange={(e) => setNewFavoriteName(e.target.value)}
                  placeholder="Give it a name..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white
                    placeholder:text-gray-500
                    focus:outline-none focus:border-[#E63946]/50 focus:ring-2 focus:ring-[#E63946]/20
                    transition-all duration-200"
                  style={{ fontSize: '16px' }}
                  autoFocus
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowFavoriteModal(false)}
                  className="flex-1 py-3.5 bg-white/5 border border-white/10 text-gray-300 rounded-xl font-medium
                    active:scale-[0.98] transition-all duration-200"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAddFavorite}
                  disabled={!newFavoriteName.trim()}
                  className="flex-1 py-3.5 bg-gradient-to-r from-[#E63946] to-[#d62839] text-white rounded-xl font-semibold
                    shadow-lg shadow-[#E63946]/25
                    disabled:opacity-40 disabled:shadow-none
                    active:scale-[0.98] transition-all duration-200"
                >
                  Save Favorite
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Results Section */}
      <div className="flex-1 overflow-y-auto">
        {/* Streaming Logs - Always show when running or has logs */}
        <StreamingLogPanel logs={streamLogs} isRunning={anyRunning} />

        {/* Matrix Result Display */}
        {mode === 'matrix' && matrixResult && !isMatrixRunning && (
          <div className="p-4 space-y-4">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-white">Matrix Results</h3>
                <p className="text-sm text-gray-400">
                  {matrixResult.profiles.length} profiles × {matrixResult.scenariosRun} scenarios
                </p>
              </div>
              <button
                type="button"
                onClick={handleClearResult}
                className="p-2 text-gray-400 hover:text-white transition-colors"
                aria-label="Clear result"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Rankings */}
            <div className="bg-gray-800/50 rounded-lg p-4">
              <h4 className="text-sm font-medium text-gray-300 mb-3">Rankings</h4>
              <div className="space-y-2">
                {matrixResult.rankings
                  .sort((a, b) => a.rank - b.rank)
                  .map((ranking, i) => (
                    <div
                      key={ranking.profile}
                      className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <span className={`text-lg font-bold ${i === 0 ? 'text-yellow-400' : i === 1 ? 'text-gray-300' : i === 2 ? 'text-amber-600' : 'text-gray-500'}`}>
                          #{ranking.rank}
                        </span>
                        <span className="text-white font-medium">{ranking.profile}</span>
                      </div>
                      <span className={`text-lg font-semibold ${ranking.avgScore >= 7 ? 'text-green-400' : ranking.avgScore >= 5 ? 'text-yellow-400' : 'text-red-400'}`}>
                        {ranking.avgScore.toFixed(1)}
                      </span>
                    </div>
                  ))}
              </div>
            </div>

            {/* Dimension Averages by Profile */}
            {Object.keys(matrixResult.dimensionAverages).length > 0 && (
              <div className="bg-gray-800/50 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-300 mb-3">Dimension Scores</h4>
                <div className="space-y-4">
                  {Object.entries(matrixResult.dimensionAverages).map(([profile, dims]) => (
                    <div key={profile}>
                      <p className="text-xs text-gray-400 mb-2">{profile}</p>
                      <DimensionBreakdown scores={dims as Record<string, number>} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Quick Test Result Display */}
        {mode === 'quick' && result && !isRunning && (
          <div className="p-4 space-y-6">
            {/* Header with action buttons */}
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold text-white truncate">{result.scenarioName}</h3>
                <p className="text-sm text-gray-400">{result.profile}</p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                {/* Run Again */}
                <button
                  type="button"
                  onClick={handleRerunLast}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#E63946] text-white rounded-lg text-sm font-medium active:bg-[#c1121f] transition-colors"
                  style={{ minHeight: '36px' }}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Again
                </button>
                {/* Clear */}
                <button
                  type="button"
                  onClick={handleClearResult}
                  className="p-2 text-gray-400 hover:text-white transition-colors"
                  aria-label="Clear result"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Score Display */}
            <div className="flex items-center justify-center">
              <ScoreRadial score={result.overallScore} passed={result.passed} size={140} />
            </div>

            {/* Metrics Row */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-gray-800/50 rounded-lg p-3 text-center">
                <div className="text-lg font-semibold text-white">
                  {result.latencyMs ? `${(result.latencyMs / 1000).toFixed(1)}s` : '-'}
                </div>
                <div className="text-xs text-gray-400">Latency</div>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-3 text-center">
                <div className="text-lg font-semibold text-white">
                  {result.totalTokens?.toLocaleString() || '-'}
                </div>
                <div className="text-xs text-gray-400">Tokens</div>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-3 text-center">
                <div className="text-lg font-semibold text-white">
                  {result.dialogueRounds || result.apiCalls || '-'}
                </div>
                <div className="text-xs text-gray-400">Rounds</div>
              </div>
            </div>

            {/* Dimension Scores */}
            {result.scores && (
              <div className="bg-gray-800/30 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-300 mb-3">Dimension Scores</h4>
                <DimensionBreakdown scores={result.scores} />
              </div>
            )}

            {/* Validation */}
            {result.validation && (
              <div className="bg-gray-800/30 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-300 mb-2">Validation</h4>
                <div className="flex gap-4">
                  <div className="flex items-center gap-2">
                    <span className={result.validation.passesRequired ? 'text-green-400' : 'text-red-400'}>
                      {result.validation.passesRequired ? '✓' : '✗'}
                    </span>
                    <span className="text-xs text-gray-400">Required</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={result.validation.passesForbidden ? 'text-green-400' : 'text-red-400'}>
                      {result.validation.passesForbidden ? '✓' : '✗'}
                    </span>
                    <span className="text-xs text-gray-400">Forbidden</span>
                  </div>
                </div>
                {result.validation.requiredMissing.length > 0 && (
                  <div className="mt-2 text-xs text-red-400">
                    Missing: {result.validation.requiredMissing.join(', ')}
                  </div>
                )}
                {result.validation.forbiddenFound.length > 0 && (
                  <div className="mt-2 text-xs text-red-400">
                    Found forbidden: {result.validation.forbiddenFound.join(', ')}
                  </div>
                )}
              </div>
            )}

            {/* Suggestions Toggle */}
            {result.suggestions && result.suggestions.length > 0 && (
              <div className="bg-gray-800/30 rounded-lg overflow-hidden">
                <button
                  type="button"
                  onClick={() => {
                    haptics.light();
                    setShowSuggestions(!showSuggestions);
                  }}
                  className="w-full flex items-center justify-between p-4 hover:bg-gray-800/50 transition-colors"
                >
                  <span className="text-sm font-medium text-gray-300">
                    Suggestions ({result.suggestions.length})
                  </span>
                  <svg
                    className={`w-4 h-4 text-gray-400 transition-transform ${showSuggestions ? 'rotate-180' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {showSuggestions && (
                  <div className="border-t border-gray-800 p-4 space-y-3">
                    {result.suggestions.map((suggestion, i) => (
                      <div key={i} className="bg-gray-900/50 rounded-lg p-3">
                        <div className="flex items-start gap-2">
                          <span
                            className={`text-xs px-2 py-0.5 rounded font-medium flex-shrink-0
                              ${suggestion.priority === 'high'
                                ? 'bg-red-900/50 text-red-400'
                                : suggestion.priority === 'medium'
                                  ? 'bg-yellow-900/50 text-yellow-400'
                                  : 'bg-gray-700 text-gray-400'
                              }`}
                          >
                            {suggestion.type}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-white">
                              {suggestion.title || suggestion.headline}
                            </div>
                            <div className="text-xs text-gray-400 mt-1 line-clamp-3">
                              {suggestion.message || suggestion.body}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Evaluator Reasoning */}
            {result.evaluationReasoning && (
              <div className="bg-gray-800/30 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-300 mb-2">Evaluator Reasoning</h4>
                <p className="text-xs text-gray-400 leading-relaxed">
                  {result.evaluationReasoning}
                </p>
                {result.evaluatorModel && (
                  <p className="text-[10px] text-gray-600 mt-2">
                    Model: {result.evaluatorModel}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Empty State - Premium visual with helpful guidance */}
        {!result && !matrixResult && !anyRunning && streamLogs.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 px-6">
            {/* Animated icon stack */}
            <div className="relative mb-8">
              {/* Outer pulsing ring */}
              <div className="absolute -inset-4 rounded-full bg-gradient-to-r from-[#E63946]/10 via-transparent to-[#E63946]/10 animate-pulse" />
              {/* Middle rotating ring */}
              <div className="absolute -inset-2 rounded-full border border-dashed border-white/10 animate-spin"
                style={{ animationDuration: '20s' }} />
              {/* Icon container */}
              <div className="relative w-24 h-24 rounded-2xl bg-gradient-to-br from-gray-900/80 to-gray-800/50 backdrop-blur-sm
                border border-white/10 flex items-center justify-center shadow-2xl">
                <div className="text-4xl">
                  {mode === 'matrix' ? '⚖️' : '🧪'}
                </div>
              </div>
              {/* Floating accent dots */}
              <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-[#E63946] animate-bounce"
                style={{ animationDelay: '0s', animationDuration: '2s' }} />
              <div className="absolute -bottom-1 -left-1 w-2 h-2 rounded-full bg-blue-400 animate-bounce"
                style={{ animationDelay: '0.5s', animationDuration: '2.5s' }} />
            </div>

            {/* Text content */}
            <h3 className="text-lg font-semibold text-white mb-2">
              {mode === 'matrix' ? 'Compare Profiles' : 'Ready to Test'}
            </h3>
            <p className="text-sm text-gray-400 text-center max-w-xs mb-6">
              {mode === 'matrix'
                ? 'Select 2 or more tutor profiles above to run a side-by-side comparison'
                : 'Choose a tutor profile and scenario to evaluate AI tutor performance'}
            </p>

            {/* Visual checklist */}
            <div className="flex flex-col gap-2 w-full max-w-xs">
              <div className={`flex items-center gap-3 p-3 rounded-xl transition-all duration-300
                ${(mode === 'matrix' ? selectedProfiles.size >= 2 : selectedProfile)
                  ? 'bg-green-500/10 border border-green-500/20'
                  : 'bg-white/5 border border-white/5'}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs
                  ${(mode === 'matrix' ? selectedProfiles.size >= 2 : selectedProfile)
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-white/10 text-gray-500'}`}>
                  {(mode === 'matrix' ? selectedProfiles.size >= 2 : selectedProfile) ? '✓' : '1'}
                </div>
                <span className={`text-sm ${(mode === 'matrix' ? selectedProfiles.size >= 2 : selectedProfile) ? 'text-green-400' : 'text-gray-400'}`}>
                  {mode === 'matrix' ? 'Select profiles to compare' : 'Select a tutor profile'}
                </span>
              </div>
              <div className={`flex items-center gap-3 p-3 rounded-xl transition-all duration-300
                ${selectedScenario
                  ? 'bg-green-500/10 border border-green-500/20'
                  : 'bg-white/5 border border-white/5'}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs
                  ${selectedScenario
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-white/10 text-gray-500'}`}>
                  {selectedScenario ? '✓' : '2'}
                </div>
                <span className={`text-sm ${selectedScenario ? 'text-green-400' : 'text-gray-400'}`}>
                  Choose a test scenario
                </span>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5">
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs bg-white/10 text-gray-500">
                  3
                </div>
                <span className="text-sm text-gray-400">Tap Run Test to begin</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default QuickTestView;
