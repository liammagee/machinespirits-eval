/**
 * RecognitionView Component
 *
 * Recognition metrics dashboard for the evaluation system.
 * Visualizes recognition engine data: moments, memory layers, learner events.
 */

import React, { useState, useEffect, useCallback } from 'react';
import haptics from '../../../utils/haptics';
import { PsychodynamicQuadrant } from './PsychodynamicQuadrant';
import { RecognitionTypeChart } from './RecognitionTypeChart';
import { SynthesisStrategyChart } from './SynthesisStrategyChart';

// Sub-view type
type SubView = 'overview' | 'moments' | 'memory' | 'events' | 'quadrant';

interface LearnerOption {
  id: string;
  name: string;
}

interface RecognitionStats {
  total_recognition_moments: number;
  dialectical_depth: number;
  mutual_transformation_score: number;
  pedagogical_attunement: number;
  // Extended stats for visualizations
  recognition_types?: {
    pedagogical: number;
    metacognitive: number;
    existential: number;
  };
  synthesis_strategies?: {
    ghost_dominates: number;
    learner_dominates: number;
    dialectical_synthesis: number;
  };
  average_compliance?: number;
  average_recognition_seeking?: number;
}

interface RecognitionMoment {
  id: string;
  writing_pad_id: string;
  session_id: string;
  created_at: string;
  ghostDemand: {
    voice?: string;
    principle?: string;
    intensity?: number;
  };
  learnerNeed: {
    need?: string;
    intensity?: number;
  };
  synthesis_strategy: string;
  transformative: boolean;
  persistence_layer: 'conscious' | 'preconscious' | 'unconscious';
  consolidated_at?: string;
}

interface WritingPad {
  id: string;
  learnerId: string;
  createdAt: string;
  updatedAt: string;
  metrics: {
    totalRecognitionMoments: number;
    dialecticalDepth: number;
    mutualTransformationScore: number;
    pedagogicalAttunement: number;
  };
  conscious: {
    workingThoughts: string[];
    ephemeralNotes: Record<string, unknown>;
    lastCleared: string;
  };
  preconscious: {
    recentPatterns: Array<{ pattern: string; confidence: number }>;
    provisionalRules: string[];
    fadeThreshold: number;
  };
  unconscious: {
    permanentTraces: Array<{ type: string; content: string }>;
    learnerArchetype: {
      preferredLearningStyle: string | null;
      commonStruggles: string[];
      breakthroughPatterns: string[];
    };
    conflictPatterns: string[];
    superegoTraces: string[];
  };
}

interface LearnerEvent {
  id: string;
  learner_id: string;
  event_type: 'resistance' | 'breakthrough' | 'demand';
  created_at: string;
  interpretation?: string;
  strength?: number;
  details?: Record<string, unknown>;
}

export const RecognitionView: React.FC = () => {
  const [activeSubView, setActiveSubView] = useState<SubView>('overview');
  const [learners, setLearners] = useState<LearnerOption[]>([]);
  const [selectedLearnerId, setSelectedLearnerId] = useState<string>('');
  const [stats, setStats] = useState<RecognitionStats | null>(null);
  const [moments, setMoments] = useState<RecognitionMoment[]>([]);
  const [writingPad, setWritingPad] = useState<WritingPad | null>(null);
  const [events, setEvents] = useState<LearnerEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedMomentId, setExpandedMomentId] = useState<string | null>(null);
  const [filterLayer, setFilterLayer] = useState<string>('all');

  // Load learners with recognition data
  const loadLearners = useCallback(async () => {
    try {
      const res = await fetch('/api/tutor/recognition-moments?limit=100');
      if (!res.ok) throw new Error('Failed to load recognition data');
      const data = await res.json();

      // Handle various response formats defensively
      let momentsList: RecognitionMoment[] = [];
      if (Array.isArray(data)) {
        momentsList = data;
      } else if (data && Array.isArray(data.moments)) {
        momentsList = data.moments;
      }

      const learnerMap = new Map<string, string>();
      for (const moment of momentsList) {
        if (moment && moment.learner_id && !learnerMap.has(moment.learner_id)) {
          learnerMap.set(moment.learner_id, moment.learner_name || moment.learner_id);
        }
      }

      const learnerList = Array.from(learnerMap.entries()).map(([id, name]) => ({
        id,
        name,
      }));
      setLearners(learnerList);

      if (learnerList.length > 0 && !selectedLearnerId) {
        setSelectedLearnerId(learnerList[0].id);
      }
    } catch (err) {
      console.error('Failed to load learners:', err);
      setError(err instanceof Error ? err.message : 'Failed to load learners');
    }
  }, [selectedLearnerId]);

  // Load all data for selected learner
  const loadLearnerData = useCallback(async () => {
    if (!selectedLearnerId) return;

    setIsLoading(true);
    setError(null);

    try {
      const [statsRes, momentsRes, padRes, eventsRes] = await Promise.all([
        fetch(`/api/tutor/writing-pad/${selectedLearnerId}/stats`),
        fetch(`/api/tutor/writing-pad/${selectedLearnerId}/moments?limit=50`),
        fetch(`/api/tutor/writing-pad/${selectedLearnerId}`),
        fetch(`/api/tutor/learner-events/${selectedLearnerId}?limit=50`),
      ]);

      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data);
      }

      if (momentsRes.ok) {
        const data = await momentsRes.json();
        const momentsList = Array.isArray(data) ? data : (Array.isArray(data?.moments) ? data.moments : []);
        setMoments(momentsList);
      }

      if (padRes.ok) {
        const data = await padRes.json();
        setWritingPad(data?.writingPad || data || null);
      }

      if (eventsRes.ok) {
        const data = await eventsRes.json();
        const eventsList = Array.isArray(data) ? data : (Array.isArray(data?.events) ? data.events : []);
        setEvents(eventsList);
      }
    } catch (err) {
      console.error('Failed to load learner data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  }, [selectedLearnerId]);

  useEffect(() => {
    loadLearners();
  }, [loadLearners]);

  useEffect(() => {
    if (selectedLearnerId) {
      loadLearnerData();
    }
  }, [selectedLearnerId, loadLearnerData]);

  const handleRefresh = () => {
    haptics.medium();
    loadLearners();
    if (selectedLearnerId) {
      loadLearnerData();
    }
  };

  const handleSubViewChange = (view: SubView) => {
    haptics.light();
    setActiveSubView(view);
  };

  const toggleMomentExpand = (id: string) => {
    haptics.light();
    setExpandedMomentId(expandedMomentId === id ? null : id);
  };

  const subViews: { id: SubView; label: string; icon: string }[] = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'moments', label: 'Moments', icon: '💡' },
    { id: 'memory', label: 'Memory', icon: '🧠' },
    { id: 'events', label: 'Events', icon: '📅' },
    { id: 'quadrant', label: 'Quadrant', icon: '🎯' },
  ];

  const filteredMoments = filterLayer === 'all'
    ? moments
    : moments.filter(m => m.persistence_layer === filterLayer);

  const getLayerColor = (layer: string) => {
    switch (layer) {
      case 'conscious': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'preconscious': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'unconscious': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const getEventColor = (type: string, interpretation?: string) => {
    if (type === 'breakthrough') return 'border-l-yellow-500 bg-yellow-500/10';
    if (type === 'demand') return 'border-l-blue-500 bg-blue-500/10';
    if (type === 'resistance') {
      if (interpretation === 'productive') return 'border-l-green-500 bg-green-500/10';
      if (interpretation === 'confused') return 'border-l-yellow-500 bg-yellow-500/10';
      return 'border-l-red-500 bg-red-500/10';
    }
    return 'border-l-gray-500 bg-gray-500/10';
  };

  return (
    <div className="space-y-4">
      {/* Header with Learner Selector */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1">
          <select
            value={selectedLearnerId}
            onChange={(e) => {
              haptics.light();
              setSelectedLearnerId(e.target.value);
            }}
            className="w-full bg-gray-900/60 backdrop-blur-sm border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#E63946]/50"
          >
            {learners.length === 0 ? (
              <option value="">No learners with recognition data</option>
            ) : (
              <>
                <option value="">Select learner...</option>
                {learners.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </>
            )}
          </select>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={isLoading}
          className="px-3 py-2 bg-gray-900/60 backdrop-blur-sm border border-white/10 rounded-lg text-sm text-white hover:bg-gray-800/60 active:scale-[0.98] transition-all disabled:opacity-50"
        >
          {isLoading ? '...' : '🔄'}
        </button>
      </div>

      {/* Sub-Navigation */}
      <div className="flex gap-1 p-1 bg-gray-900/40 backdrop-blur-sm rounded-xl border border-white/5">
        {subViews.map((sv) => (
          <button
            key={sv.id}
            type="button"
            onClick={() => handleSubViewChange(sv.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all active:scale-[0.98] ${
              activeSubView === sv.id
                ? 'bg-[#E63946]/20 text-[#E63946] border border-[#E63946]/30'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <span>{sv.icon}</span>
            <span className="hidden sm:inline">{sv.label}</span>
          </button>
        ))}
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Content Area */}
      {!selectedLearnerId ? (
        <div className="bg-gray-900/60 backdrop-blur-sm border border-white/5 rounded-xl p-8 text-center">
          <div className="text-4xl mb-3">🔍</div>
          <h3 className="text-white font-medium mb-2">Select a Learner</h3>
          <p className="text-sm text-gray-400">
            Choose a learner from the dropdown to view their recognition metrics.
          </p>
        </div>
      ) : (
        <>
          {/* Overview Sub-View */}
          {activeSubView === 'overview' && (
            <div className="space-y-4">
              {stats ? (
                <>
                  {/* Core metrics grid */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-gray-900/60 backdrop-blur-sm border border-white/5 rounded-xl p-4">
                      <div className="text-xs text-gray-400 mb-1">Recognition Moments</div>
                      <div className="text-2xl font-bold text-white">
                        {stats.total_recognition_moments || 0}
                      </div>
                    </div>

                    <div className="bg-gray-900/60 backdrop-blur-sm border border-white/5 rounded-xl p-4">
                      <div className="text-xs text-gray-400 mb-1">Dialectical Depth</div>
                      <div className="text-2xl font-bold text-white">
                        {((stats.dialectical_depth || 0) * 100).toFixed(0)}%
                      </div>
                      <div className="mt-2 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-[#E63946] to-[#E63946]/60 rounded-full transition-all"
                          style={{ width: `${(stats.dialectical_depth || 0) * 100}%` }}
                        />
                      </div>
                    </div>

                    <div className="bg-gray-900/60 backdrop-blur-sm border border-white/5 rounded-xl p-4">
                      <div className="text-xs text-gray-400 mb-1">Mutual Transform</div>
                      <div className="text-2xl font-bold text-white">
                        {((stats.mutual_transformation_score || 0) * 100).toFixed(0)}%
                      </div>
                      <div className="mt-2 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-blue-500 to-blue-500/60 rounded-full transition-all"
                          style={{ width: `${(stats.mutual_transformation_score || 0) * 100}%` }}
                        />
                      </div>
                    </div>

                    <div className="bg-gray-900/60 backdrop-blur-sm border border-white/5 rounded-xl p-4">
                      <div className="text-xs text-gray-400 mb-1">Pedagogical Attunement</div>
                      <div className="text-2xl font-bold text-white">
                        {((stats.pedagogical_attunement || 0) * 100).toFixed(0)}%
                      </div>
                      <div className="mt-2 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-green-500 to-green-500/60 rounded-full transition-all"
                          style={{ width: `${(stats.pedagogical_attunement || 0) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Recognition Type Distribution */}
                  <RecognitionTypeChart
                    counts={stats.recognition_types || { pedagogical: 0, metacognitive: 0, existential: 0 }}
                  />

                  {/* Synthesis Strategy Distribution */}
                  <SynthesisStrategyChart
                    counts={stats.synthesis_strategies || { ghost_dominates: 0, learner_dominates: 0, dialectical_synthesis: 0 }}
                  />
                </>
              ) : isLoading ? (
                <div className="bg-gray-900/60 backdrop-blur-sm border border-white/5 rounded-xl p-8 text-center">
                  <div className="animate-pulse text-gray-400">Loading stats...</div>
                </div>
              ) : (
                <div className="bg-gray-900/60 backdrop-blur-sm border border-white/5 rounded-xl p-8 text-center">
                  <div className="text-gray-400">No stats available for this learner</div>
                </div>
              )}
            </div>
          )}

          {/* Moments Sub-View */}
          {activeSubView === 'moments' && (
            <div className="space-y-3">
              {/* Filter Chips */}
              <div className="flex gap-2 flex-wrap">
                {['all', 'conscious', 'preconscious', 'unconscious'].map((layer) => (
                  <button
                    key={layer}
                    type="button"
                    onClick={() => {
                      haptics.light();
                      setFilterLayer(layer);
                    }}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-all active:scale-[0.98] ${
                      filterLayer === layer
                        ? 'bg-[#E63946]/20 text-[#E63946] border border-[#E63946]/30'
                        : 'bg-gray-800/50 text-gray-400 border border-white/5 hover:text-white'
                    }`}
                  >
                    {layer === 'all' ? 'All' : layer.charAt(0).toUpperCase() + layer.slice(1)}
                  </button>
                ))}
              </div>

              {/* Moments List */}
              {filteredMoments.length > 0 ? (
                <div className="space-y-2">
                  {filteredMoments.map((moment) => (
                    <div
                      key={moment.id}
                      className="bg-gray-900/60 backdrop-blur-sm border border-white/5 rounded-xl overflow-hidden"
                    >
                      <button
                        type="button"
                        onClick={() => toggleMomentExpand(moment.id)}
                        className="w-full p-4 text-left active:scale-[0.99] transition-all"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`px-2 py-0.5 rounded-full text-xs border ${getLayerColor(moment.persistence_layer)}`}>
                                {moment.persistence_layer}
                              </span>
                              {moment.transformative && (
                                <span className="px-2 py-0.5 rounded-full text-xs bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                                  ✨ Transformative
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-white truncate">
                              {moment.synthesis_strategy || 'No synthesis recorded'}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              {new Date(moment.created_at).toLocaleString()}
                            </p>
                          </div>
                          <span className="text-gray-500 text-lg">
                            {expandedMomentId === moment.id ? '−' : '+'}
                          </span>
                        </div>
                      </button>

                      {/* Expanded Content */}
                      {expandedMomentId === moment.id && (
                        <div className="px-4 pb-4 pt-2 border-t border-white/5 space-y-3">
                          {/* Ghost Demand (Thesis) */}
                          <div className="bg-gray-800/50 rounded-lg p-3">
                            <div className="text-xs text-gray-400 mb-1 flex items-center gap-1">
                              <span>👻</span> Ghost Demand (Superego)
                            </div>
                            <p className="text-sm text-white">
                              {moment.ghostDemand?.voice || 'No voice recorded'}
                            </p>
                            {moment.ghostDemand?.principle && (
                              <p className="text-xs text-gray-400 mt-1">
                                Principle: {moment.ghostDemand.principle}
                              </p>
                            )}
                          </div>

                          {/* Learner Need (Antithesis) */}
                          <div className="bg-gray-800/50 rounded-lg p-3">
                            <div className="text-xs text-gray-400 mb-1 flex items-center gap-1">
                              <span>🎯</span> Learner Need (Antithesis)
                            </div>
                            <p className="text-sm text-white">
                              {moment.learnerNeed?.need || 'No need recorded'}
                            </p>
                            {moment.learnerNeed?.intensity != null && (
                              <div className="mt-2">
                                <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                                  <span>Intensity</span>
                                  <span>{(moment.learnerNeed.intensity * 100).toFixed(0)}%</span>
                                </div>
                                <div className="h-1 bg-gray-700 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-blue-500 rounded-full"
                                    style={{ width: `${moment.learnerNeed.intensity * 100}%` }}
                                  />
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Synthesis */}
                          <div className="bg-[#E63946]/10 rounded-lg p-3 border border-[#E63946]/20">
                            <div className="text-xs text-[#E63946] mb-1 flex items-center gap-1">
                              <span>⚡</span> Synthesis
                            </div>
                            <p className="text-sm text-white">
                              {moment.synthesis_strategy || 'No synthesis recorded'}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : isLoading ? (
                <div className="bg-gray-900/60 backdrop-blur-sm border border-white/5 rounded-xl p-8 text-center">
                  <div className="animate-pulse text-gray-400">Loading moments...</div>
                </div>
              ) : (
                <div className="bg-gray-900/60 backdrop-blur-sm border border-white/5 rounded-xl p-8 text-center">
                  <div className="text-4xl mb-3">💡</div>
                  <h3 className="text-white font-medium mb-2">No Moments Yet</h3>
                  <p className="text-sm text-gray-400">
                    Recognition moments will appear here as the learner interacts with the tutor.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Memory Sub-View */}
          {activeSubView === 'memory' && (
            <div className="space-y-3">
              {writingPad ? (
                <>
                  {/* Conscious Layer */}
                  <div className="bg-gray-900/60 backdrop-blur-sm border border-yellow-500/20 rounded-xl overflow-hidden">
                    <div className="px-4 py-3 border-b border-yellow-500/20 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
                      <span className="text-sm font-medium text-yellow-400">Conscious</span>
                      <span className="text-xs text-gray-500 ml-auto">Working Memory</span>
                    </div>
                    <div className="p-4 space-y-2">
                      <div className="text-sm text-gray-300">
                        <span className="text-gray-500">Working Thoughts:</span>{' '}
                        {writingPad.conscious.workingThoughts.length || 0}
                      </div>
                      <div className="text-sm text-gray-300">
                        <span className="text-gray-500">Ephemeral Notes:</span>{' '}
                        {Object.keys(writingPad.conscious.ephemeralNotes || {}).length || 0}
                      </div>
                      <div className="text-xs text-gray-500">
                        Last cleared: {new Date(writingPad.conscious.lastCleared).toLocaleString()}
                      </div>
                    </div>
                  </div>

                  {/* Preconscious Layer */}
                  <div className="bg-gray-900/60 backdrop-blur-sm border border-blue-500/20 rounded-xl overflow-hidden">
                    <div className="px-4 py-3 border-b border-blue-500/20 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-blue-500" />
                      <span className="text-sm font-medium text-blue-400">Preconscious</span>
                      <span className="text-xs text-gray-500 ml-auto">Recent Patterns</span>
                    </div>
                    <div className="p-4 space-y-3">
                      {writingPad.preconscious.recentPatterns.length > 0 ? (
                        writingPad.preconscious.recentPatterns.slice(0, 5).map((p, i) => (
                          <div key={i} className="space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-gray-300 truncate flex-1">
                                {typeof p === 'string' ? p : p.pattern || 'Pattern'}
                              </span>
                              <span className="text-xs text-gray-500 ml-2">
                                {typeof p === 'object' && p.confidence
                                  ? `${(p.confidence * 100).toFixed(0)}%`
                                  : '—'}
                              </span>
                            </div>
                            {typeof p === 'object' && p.confidence != null && (
                              <div className="h-1 bg-gray-700 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-blue-500 rounded-full"
                                  style={{ width: `${p.confidence * 100}%` }}
                                />
                              </div>
                            )}
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-gray-500">No patterns recorded yet</p>
                      )}
                      <div className="text-xs text-gray-500 pt-2 border-t border-white/5">
                        Fade threshold: {writingPad.preconscious.fadeThreshold} interactions
                      </div>
                    </div>
                  </div>

                  {/* Unconscious Layer */}
                  <div className="bg-gray-900/60 backdrop-blur-sm border border-purple-500/20 rounded-xl overflow-hidden">
                    <div className="px-4 py-3 border-b border-purple-500/20 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-purple-500" />
                      <span className="text-sm font-medium text-purple-400">Unconscious</span>
                      <span className="text-xs text-gray-500 ml-auto">Permanent Traces</span>
                    </div>
                    <div className="p-4 space-y-3">
                      <div className="text-sm text-gray-300">
                        <span className="text-gray-500">Permanent Traces:</span>{' '}
                        {writingPad.unconscious.permanentTraces.length || 0}
                      </div>

                      {/* Learner Archetype */}
                      <div className="bg-gray-800/50 rounded-lg p-3">
                        <div className="text-xs text-gray-400 mb-2">Learner Archetype</div>
                        <div className="space-y-1 text-sm">
                          <div className="text-gray-300">
                            <span className="text-gray-500">Style:</span>{' '}
                            {writingPad.unconscious.learnerArchetype.preferredLearningStyle || 'Unknown'}
                          </div>
                          <div className="text-gray-300">
                            <span className="text-gray-500">Struggles:</span>{' '}
                            {writingPad.unconscious.learnerArchetype.commonStruggles.length || 0}
                          </div>
                          <div className="text-gray-300">
                            <span className="text-gray-500">Breakthroughs:</span>{' '}
                            {writingPad.unconscious.learnerArchetype.breakthroughPatterns.length || 0}
                          </div>
                        </div>
                      </div>

                      <div className="text-sm text-gray-300">
                        <span className="text-gray-500">Conflict Patterns:</span>{' '}
                        {writingPad.unconscious.conflictPatterns.length || 0}
                      </div>
                      <div className="text-sm text-gray-300">
                        <span className="text-gray-500">Superego Traces:</span>{' '}
                        {writingPad.unconscious.superegoTraces.length || 0}
                      </div>
                    </div>
                  </div>
                </>
              ) : isLoading ? (
                <div className="bg-gray-900/60 backdrop-blur-sm border border-white/5 rounded-xl p-8 text-center">
                  <div className="animate-pulse text-gray-400">Loading memory state...</div>
                </div>
              ) : (
                <div className="bg-gray-900/60 backdrop-blur-sm border border-white/5 rounded-xl p-8 text-center">
                  <div className="text-4xl mb-3">🧠</div>
                  <h3 className="text-white font-medium mb-2">No Memory Data</h3>
                  <p className="text-sm text-gray-400">
                    Writing pad data will appear here once the learner has interactions.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Events Sub-View */}
          {activeSubView === 'events' && (
            <div className="space-y-2">
              {events.length > 0 ? (
                events.map((event) => (
                  <div
                    key={event.id}
                    className={`border-l-4 rounded-r-xl p-4 ${getEventColor(event.event_type, event.interpretation)}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium text-white capitalize">
                            {event.event_type === 'breakthrough' && '✨ '}
                            {event.event_type === 'resistance' && '🛡️ '}
                            {event.event_type === 'demand' && '📢 '}
                            {event.event_type}
                          </span>
                          {event.interpretation && (
                            <span className="text-xs text-gray-400">
                              ({event.interpretation})
                            </span>
                          )}
                        </div>
                        {event.strength != null && (
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-xs text-gray-500">Strength:</span>
                            <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-white/50 rounded-full"
                                style={{ width: `${event.strength * 100}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-400">
                              {(event.strength * 100).toFixed(0)}%
                            </span>
                          </div>
                        )}
                      </div>
                      <span className="text-xs text-gray-500 whitespace-nowrap">
                        {new Date(event.created_at).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                ))
              ) : isLoading ? (
                <div className="bg-gray-900/60 backdrop-blur-sm border border-white/5 rounded-xl p-8 text-center">
                  <div className="animate-pulse text-gray-400">Loading events...</div>
                </div>
              ) : (
                <div className="bg-gray-900/60 backdrop-blur-sm border border-white/5 rounded-xl p-8 text-center">
                  <div className="text-4xl mb-3">📅</div>
                  <h3 className="text-white font-medium mb-2">No Events Yet</h3>
                  <p className="text-sm text-gray-400">
                    Learner events (resistance, breakthroughs, demands) will appear here.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Quadrant Sub-View */}
          {activeSubView === 'quadrant' && (
            <div className="space-y-4">
              {stats ? (
                <>
                  {/* Psychodynamic Quadrant Chart */}
                  <PsychodynamicQuadrant
                    superegoCompliance={stats.average_compliance ?? 0.5}
                    recognitionSeeking={stats.average_recognition_seeking ?? 0.5}
                  />

                  {/* Parameter explanation */}
                  <div className="bg-gray-900/60 backdrop-blur-sm border border-white/5 rounded-xl p-4">
                    <div className="text-xs text-gray-400 mb-3">About the Quadrants</div>
                    <div className="space-y-3 text-xs">
                      <div className="flex items-start gap-2">
                        <span className="text-green-400">●</span>
                        <div>
                          <span className="text-white font-medium">Dialogical Recognition</span>
                          <span className="text-gray-500"> (high compliance + high seeking)</span>
                          <p className="text-gray-400 mt-0.5">
                            Ideal state: tutor balances authority with genuine responsiveness to learner needs.
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-blue-400">●</span>
                        <div>
                          <span className="text-white font-medium">Permissive Responsive</span>
                          <span className="text-gray-500"> (low compliance + high seeking)</span>
                          <p className="text-gray-400 mt-0.5">
                            Highly learner-centered but may lack pedagogical structure.
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-red-400">●</span>
                        <div>
                          <span className="text-white font-medium">Traditional Authoritarian</span>
                          <span className="text-gray-500"> (high compliance + low seeking)</span>
                          <p className="text-gray-400 mt-0.5">
                            Authority-driven instruction with less learner recognition.
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-gray-500">●</span>
                        <div>
                          <span className="text-white font-medium">Disengaged</span>
                          <span className="text-gray-500"> (low compliance + low seeking)</span>
                          <p className="text-gray-400 mt-0.5">
                            Minimal tension or engagement - may indicate passive interactions.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              ) : isLoading ? (
                <div className="bg-gray-900/60 backdrop-blur-sm border border-white/5 rounded-xl p-8 text-center">
                  <div className="animate-pulse text-gray-400">Loading quadrant data...</div>
                </div>
              ) : (
                <div className="bg-gray-900/60 backdrop-blur-sm border border-white/5 rounded-xl p-8 text-center">
                  <div className="text-4xl mb-3">🎯</div>
                  <h3 className="text-white font-medium mb-2">No Quadrant Data</h3>
                  <p className="text-sm text-gray-400">
                    Psychodynamic parameters will appear here after recognition moments are recorded.
                  </p>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default RecognitionView;
