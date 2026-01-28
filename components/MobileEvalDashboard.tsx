/**
 * Mobile Evaluation Dashboard
 *
 * A mobile-first evaluation dashboard for testing and reviewing AI tutor performance.
 * Features bottom tab navigation, touch-optimized interactions, and offline support.
 *
 * Tabs:
 * - Test: Run quick tests with streaming output
 * - History: Browse past evaluation runs
 * - Logs: View dialogue transcripts
 * - Docs: Read evaluation documentation
 */

import React, { useState, useCallback, useRef } from 'react';
import { useEvalData } from '../../hooks/useEvalData';
import haptics from '../../utils/haptics';
import { QuickTestView } from './mobile/QuickTestView';
import { RunHistoryView } from './mobile/RunHistoryView';
import { LogsView } from './mobile/LogsView';
import { DocsView } from './mobile/DocsView';
import { BottomSheet } from './mobile/BottomSheet';
import { RunDetailView } from './mobile/RunDetailView';
import type { RunDetails } from '../../hooks/useEvalData';

// Tab configuration
type ViewMode = 'test' | 'history' | 'logs' | 'docs';

interface TabConfig {
  id: ViewMode;
  label: string;
  icon: React.ReactNode;
}

// Icons as inline SVG for bundle efficiency
const PlayIcon = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const ClockIcon = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const FileTextIcon = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

const BookIcon = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
  </svg>
);

const tabs: TabConfig[] = [
  { id: 'test', label: 'Test', icon: <PlayIcon /> },
  { id: 'history', label: 'History', icon: <ClockIcon /> },
  { id: 'logs', label: 'Logs', icon: <FileTextIcon /> },
  { id: 'docs', label: 'Docs', icon: <BookIcon /> }
];

export const MobileEvalDashboard: React.FC = () => {
  // View state
  const [activeTab, setActiveTab] = useState<ViewMode>('test');

  // Bottom sheet state
  const [showRunDetail, setShowRunDetail] = useState(false);
  const [selectedRunDetails, setSelectedRunDetails] = useState<RunDetails | null>(null);

  // Swipe navigation state
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);
  const MIN_SWIPE_DISTANCE = 50;

  // Data hook
  const evalData = useEvalData();

  // Tab switching with haptic feedback
  const handleTabChange = useCallback((tab: ViewMode) => {
    if (tab !== activeTab) {
      haptics.light();
      setActiveTab(tab);
    }
  }, [activeTab]);

  // Swipe navigation between tabs
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchEndX.current = null;
    touchStartX.current = e.touches[0].clientX;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (!touchStartX.current || !touchEndX.current) return;

    const distance = touchStartX.current - touchEndX.current;
    const tabOrder: ViewMode[] = ['test', 'history', 'logs', 'docs'];
    const currentIndex = tabOrder.indexOf(activeTab);

    if (Math.abs(distance) > MIN_SWIPE_DISTANCE) {
      if (distance > 0 && currentIndex < tabOrder.length - 1) {
        // Swipe left - go to next tab
        haptics.light();
        setActiveTab(tabOrder[currentIndex + 1]);
      } else if (distance < 0 && currentIndex > 0) {
        // Swipe right - go to previous tab
        haptics.light();
        setActiveTab(tabOrder[currentIndex - 1]);
      }
    }

    touchStartX.current = null;
    touchEndX.current = null;
  }, [activeTab]);

  // Handle run selection from history
  const handleSelectRun = useCallback(async (runId: string) => {
    haptics.light();
    const details = await evalData.loadRunDetails(runId);
    if (details) {
      setSelectedRunDetails(details);
      setShowRunDetail(true);
    }
  }, [evalData]);

  // Handle navigation to logs from run detail
  const handleViewDialogue = useCallback((logDate: string) => {
    setShowRunDetail(false);
    setActiveTab('logs');
    // The LogsView will handle loading the specific date
  }, []);

  return (
    <div
      className="mobile-eval-dashboard flex flex-col h-screen bg-[#0a0a0a] text-white overflow-hidden"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      {/* Header */}
      <header className="flex-shrink-0 px-4 py-3 border-b border-gray-800">
        <h1 className="text-lg font-semibold">Evaluation</h1>
        {evalData.error && (
          <div className="mt-2 px-3 py-2 bg-red-900/30 border border-red-800 rounded-lg text-sm text-red-400 flex items-center justify-between">
            <span>{evalData.error}</span>
            <button
              type="button"
              onClick={evalData.clearError}
              className="ml-2 text-red-400 hover:text-red-300"
            >
              &times;
            </button>
          </div>
        )}
      </header>

      {/* Main content area with swipe support */}
      <main
        className="flex-1 overflow-hidden"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {activeTab === 'test' && (
          <QuickTestView
            profiles={evalData.profiles}
            scenarios={evalData.scenarios}
            onRunTest={evalData.runQuickTest}
            onRunMatrix={evalData.runMatrixTest}
            isRunning={evalData.isTestRunning}
            isMatrixRunning={evalData.isMatrixRunning}
            isLoadingData={evalData.isInitialLoading}
            result={evalData.testResult}
            matrixResult={evalData.matrixResult}
            streamLogs={evalData.streamLogs}
            onClearResult={evalData.clearTestResult}
            onClearMatrixResult={evalData.clearMatrixResult}
          />
        )}

        {activeTab === 'history' && (
          <RunHistoryView
            runs={evalData.runs}
            isLoading={evalData.isLoading}
            onSelectRun={handleSelectRun}
            onRefresh={evalData.loadRuns}
          />
        )}

        {activeTab === 'logs' && (
          <LogsView
            logDates={evalData.logDates}
            isLoading={evalData.isLoading}
            onLoadDates={evalData.loadLogDates}
            onLoadDialogues={evalData.loadDialogues}
            onLoadDialogueById={evalData.loadDialogueById}
          />
        )}

        {activeTab === 'docs' && (
          <DocsView
            docs={evalData.docs}
            isLoading={evalData.isLoading}
            onLoadDocs={evalData.loadDocs}
            onLoadDocContent={evalData.loadDocContent}
          />
        )}
      </main>

      {/* Bottom Tab Bar - Glass morphism */}
      <nav
        className="flex-shrink-0 bg-gray-900/80 backdrop-blur-xl border-t border-white/5"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex justify-around items-center h-14" role="tablist">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`relative flex flex-col items-center justify-center w-full h-full transition-all duration-200
                ${activeTab === tab.id ? 'text-[#E63946]' : 'text-gray-500 hover:text-gray-300'}`}
              style={{ minHeight: '48px' }}
            >
              {/* Active indicator glow */}
              {activeTab === tab.id && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-gradient-to-r from-transparent via-[#E63946] to-transparent" />
              )}
              <div className={`transition-transform duration-200 ${activeTab === tab.id ? 'scale-110' : ''}`}>
                {tab.icon}
              </div>
              <span className={`text-[10px] mt-1 font-medium transition-all duration-200
                ${activeTab === tab.id ? 'text-[#E63946]' : ''}`}>
                {tab.label}
              </span>
            </button>
          ))}
        </div>
      </nav>

      {/* Run Detail Bottom Sheet */}
      <BottomSheet
        isOpen={showRunDetail}
        onClose={() => setShowRunDetail(false)}
        title="Run Details"
      >
        {selectedRunDetails && (
          <RunDetailView
            details={selectedRunDetails}
            onViewDialogue={handleViewDialogue}
            onClose={() => setShowRunDetail(false)}
          />
        )}
      </BottomSheet>
    </div>
  );
};

export default MobileEvalDashboard;
