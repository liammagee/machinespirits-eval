/**
 * DocsView Component
 *
 * Browse and read evaluation documentation.
 * Displays doc list and renders markdown content.
 */

import React, { useEffect, useState, useCallback } from 'react';
import type { EvalDoc } from '../../types';
import haptics from '../../utils/haptics';

interface DocsViewProps {
  docs: EvalDoc[];
  isLoading: boolean;
  onLoadDocs: () => Promise<void>;
  onLoadDocContent: (name: string) => Promise<string | null>;
}

// Simple markdown renderer for mobile - Premium glass styling
// Handles basic formatting without heavy dependencies
const SimpleMarkdown: React.FC<{ content: string }> = ({ content }) => {
  // Process markdown into HTML-safe segments
  const renderContent = () => {
    const lines = content.split('\n');
    const elements: React.ReactNode[] = [];
    let inCodeBlock = false;
    let codeContent = '';
    let codeLanguage = '';
    let listItems: string[] = [];

    const flushList = () => {
      if (listItems.length > 0) {
        elements.push(
          <ul key={`list-${elements.length}`} className="space-y-2 my-4 ml-4">
            {listItems.map((item, i) => (
              <li key={i} className="text-sm text-gray-300 flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#E63946]/60 mt-2 flex-shrink-0" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        );
        listItems = [];
      }
    };

    lines.forEach((line, i) => {
      // Code block handling - Glass style
      if (line.startsWith('```')) {
        if (inCodeBlock) {
          elements.push(
            <pre key={`code-${i}`} className="bg-gray-900/80 backdrop-blur-sm border border-white/5 rounded-xl p-4 overflow-x-auto my-4">
              <code className="text-xs text-gray-300 font-mono leading-relaxed">{codeContent}</code>
            </pre>
          );
          codeContent = '';
          inCodeBlock = false;
        } else {
          flushList();
          inCodeBlock = true;
          codeLanguage = line.slice(3);
        }
        return;
      }

      if (inCodeBlock) {
        codeContent += (codeContent ? '\n' : '') + line;
        return;
      }

      // Headers - Enhanced styling
      if (line.startsWith('# ')) {
        flushList();
        elements.push(
          <h1 key={i} className="text-xl font-bold text-white mt-8 mb-4 flex items-center gap-2">
            <span className="w-1 h-6 bg-gradient-to-b from-[#E63946] to-[#E63946]/30 rounded-full" />
            {line.slice(2)}
          </h1>
        );
        return;
      }
      if (line.startsWith('## ')) {
        flushList();
        elements.push(
          <h2 key={i} className="text-lg font-semibold text-white mt-6 mb-3 flex items-center gap-2">
            <span className="w-0.5 h-5 bg-[#E63946]/60 rounded-full" />
            {line.slice(3)}
          </h2>
        );
        return;
      }
      if (line.startsWith('### ')) {
        flushList();
        elements.push(
          <h3 key={i} className="text-base font-medium text-gray-200 mt-5 mb-2">{line.slice(4)}</h3>
        );
        return;
      }

      // List items
      if (line.match(/^[-*]\s/)) {
        listItems.push(line.slice(2));
        return;
      }
      if (line.match(/^\d+\.\s/)) {
        listItems.push(line.replace(/^\d+\.\s/, ''));
        return;
      }

      // Empty line - flush list
      if (line.trim() === '') {
        flushList();
        return;
      }

      // Regular paragraph
      flushList();

      // Process inline formatting - Premium styling
      let processedLine = line
        // Bold
        .replace(/\*\*(.+?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>')
        // Italic
        .replace(/\*(.+?)\*/g, '<em class="italic text-gray-200">$1</em>')
        // Inline code - Glass style
        .replace(/`([^`]+)`/g, '<code class="bg-gray-800/60 px-1.5 py-0.5 rounded-md text-[#E63946] text-xs font-mono border border-white/5">$1</code>')
        // Links
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-[#E63946] hover:text-[#d62839] underline underline-offset-2 transition-colors" target="_blank" rel="noopener">$1</a>');

      elements.push(
        <p
          key={i}
          className="text-sm text-gray-300 my-3 leading-relaxed"
          dangerouslySetInnerHTML={{ __html: processedLine }}
        />
      );
    });

    flushList();
    return elements;
  };

  return <div className="prose-mobile">{renderContent()}</div>;
};

// Format file size
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const DocsView: React.FC<DocsViewProps> = ({
  docs,
  isLoading,
  onLoadDocs,
  onLoadDocContent
}) => {
  const [selectedDoc, setSelectedDoc] = useState<EvalDoc | null>(null);
  const [docContent, setDocContent] = useState<string | null>(null);
  const [isLoadingContent, setIsLoadingContent] = useState(false);

  // Load docs on mount
  useEffect(() => {
    if (docs.length === 0) {
      onLoadDocs();
    }
  }, [docs.length, onLoadDocs]);

  // Load doc content when selected
  const handleSelectDoc = useCallback(async (doc: EvalDoc) => {
    haptics.light();
    setSelectedDoc(doc);
    setIsLoadingContent(true);
    const content = await onLoadDocContent(doc.name);
    setDocContent(content);
    setIsLoadingContent(false);
  }, [onLoadDocContent]);

  // Go back to list
  const handleBack = useCallback(() => {
    haptics.light();
    setSelectedDoc(null);
    setDocContent(null);
  }, []);

  // Document content view - Premium glass styling
  if (selectedDoc) {
    return (
      <div className="h-full flex flex-col overflow-hidden">
        {/* Header - Glass */}
        <div className="flex-shrink-0 p-4 border-b border-white/5 bg-gray-900/30 backdrop-blur-sm">
          <button
            type="button"
            onClick={handleBack}
            className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors mb-3
              active:scale-[0.98]"
          >
            <div className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </div>
            Back to docs
          </button>
          <h2 className="text-lg font-semibold text-white">{selectedDoc.title}</h2>
          <p className="text-xs text-gray-500 mt-1 font-mono">{selectedDoc.filename}</p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoadingContent && (
            <div className="flex items-center justify-center h-48">
              <div className="flex flex-col items-center gap-4">
                <div className="relative">
                  <div className="absolute inset-0 rounded-full bg-gradient-to-r from-[#E63946]/20 to-[#d62839]/20 animate-spin"
                    style={{ animationDuration: '3s' }} />
                  <div className="relative w-14 h-14 rounded-full bg-gray-900/80 backdrop-blur-sm border border-white/10
                    flex items-center justify-center">
                    <svg className="w-6 h-6 text-[#E63946] animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  </div>
                </div>
                <span className="text-sm text-gray-400 font-medium">Loading document...</span>
              </div>
            </div>
          )}

          {!isLoadingContent && docContent && (
            <SimpleMarkdown content={docContent} />
          )}

          {!isLoadingContent && !docContent && (
            <div className="flex flex-col items-center justify-center h-48">
              <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <p className="text-sm text-gray-400 font-medium">Failed to load document</p>
              <button
                type="button"
                onClick={() => handleSelectDoc(selectedDoc)}
                className="mt-3 px-4 py-2 text-xs bg-white/5 border border-white/10 rounded-lg text-gray-300
                  hover:bg-white/10 active:scale-[0.98] transition-all"
              >
                Try again
              </button>
            </div>
          )}

          {/* Bottom padding */}
          <div className="h-8" />
        </div>
      </div>
    );
  }

  // Document list view - Premium glass styling
  return (
    <div className="h-full overflow-y-auto">
      {/* Loading state - Premium animated */}
      {isLoading && docs.length === 0 && (
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-gradient-to-r from-[#E63946]/20 to-[#d62839]/20 animate-spin"
                style={{ animationDuration: '3s' }} />
              <div className="relative w-16 h-16 rounded-full bg-gray-900/80 backdrop-blur-sm border border-white/10
                flex items-center justify-center">
                <svg className="w-8 h-8 text-[#E63946] animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
            </div>
            <span className="text-sm text-gray-400 font-medium">Loading docs...</span>
          </div>
        </div>
      )}

      {/* Empty state - Enhanced with animation */}
      {!isLoading && docs.length === 0 && (
        <div className="flex flex-col items-center justify-center h-64 text-gray-500 px-4">
          <div className="relative mb-6">
            <div className="absolute inset-0 rounded-full bg-gradient-to-r from-gray-600/20 via-transparent to-gray-600/20 animate-spin"
              style={{ animationDuration: '8s' }} />
            <div className="relative w-20 h-20 rounded-full bg-gray-900/50 backdrop-blur-sm border border-white/5
              flex items-center justify-center">
              <svg className="w-10 h-10 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
          </div>
          <p className="text-sm font-medium text-gray-400">No documentation available</p>
          <p className="text-xs text-gray-600 mt-1">Add docs to the evaluation folder</p>
        </div>
      )}

      {/* Doc list - Glass cards */}
      {docs.length > 0 && (
        <div className="p-3 space-y-2">
          {docs.map((doc) => (
            <button
              key={doc.name}
              type="button"
              onClick={() => handleSelectDoc(doc)}
              className="w-full p-4 text-left bg-gray-900/60 backdrop-blur-sm border border-white/5
                rounded-xl active:scale-[0.99] active:bg-gray-800/80 transition-all duration-150"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  {/* Icon and title */}
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-xl bg-[#E63946]/10 border border-[#E63946]/20
                      flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-[#E63946]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <span className="text-sm font-medium text-white line-clamp-1 block">
                        {doc.title}
                      </span>
                      {/* Filename */}
                      <span className="text-xs text-gray-500 font-mono line-clamp-1 block mt-0.5">
                        {doc.filename}
                      </span>
                    </div>
                  </div>

                  {/* Size badge */}
                  <div className="flex items-center gap-2 text-xs">
                    <span className="px-2 py-0.5 bg-white/5 border border-white/10 rounded-full text-gray-400">
                      {formatSize(doc.size)}
                    </span>
                  </div>
                </div>

                {/* Chevron */}
                <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Bottom padding */}
      <div className="h-4" />
    </div>
  );
};

export default DocsView;
