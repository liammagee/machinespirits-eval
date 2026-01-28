/**
 * BottomSheet Component
 *
 * A premium mobile-native bottom sheet modal with drag-to-dismiss gesture support.
 * Features glass morphism, smooth animations, and haptic feedback.
 * Used for displaying run details, dialogue entries, and other drill-down content.
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import haptics from '../../../utils/haptics';

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  maxHeight?: string;
}

export const BottomSheet: React.FC<BottomSheetProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  maxHeight = '85vh'
}) => {
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const dragStartY = useRef<number | null>(null);
  const velocityY = useRef(0);
  const lastY = useRef(0);
  const lastTime = useRef(Date.now());
  const sheetRef = useRef<HTMLDivElement>(null);

  // Reset drag state when sheet opens
  useEffect(() => {
    if (isOpen) {
      setDragY(0);
      setIsDragging(false);
      setIsClosing(false);
      velocityY.current = 0;
    }
  }, [isOpen]);

  // Prevent body scroll when sheet is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    // Only start drag from the handle area
    const target = e.target as HTMLElement;
    if (target.closest('.bottom-sheet-handle')) {
      dragStartY.current = e.touches[0].clientY;
      lastY.current = e.touches[0].clientY;
      lastTime.current = Date.now();
      setIsDragging(true);
      haptics.light();
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging || dragStartY.current === null) return;

    const currentY = e.touches[0].clientY;
    const deltaY = currentY - dragStartY.current;

    // Calculate velocity for momentum-based closing
    const now = Date.now();
    const dt = now - lastTime.current;
    if (dt > 0) {
      velocityY.current = (currentY - lastY.current) / dt;
    }
    lastY.current = currentY;
    lastTime.current = now;

    // Only allow downward drag with rubber band effect
    if (deltaY > 0) {
      // Add resistance as user drags further
      const resistance = 1 - Math.min(deltaY / 500, 0.5);
      setDragY(deltaY * resistance);
    }
  }, [isDragging]);

  const handleTouchEnd = useCallback(() => {
    if (!isDragging) return;

    // Close if dragged more than 100px down OR with high velocity
    const shouldClose = dragY > 100 || (velocityY.current > 0.5 && dragY > 30);

    if (shouldClose) {
      haptics.medium();
      setIsClosing(true);
      // Wait for animation before calling onClose
      setTimeout(() => {
        onClose();
        setIsClosing(false);
      }, 200);
    } else {
      // Snap back
      haptics.light();
    }

    setDragY(0);
    setIsDragging(false);
    dragStartY.current = null;
    velocityY.current = 0;
  }, [isDragging, dragY, onClose]);

  const handleBackdropClick = useCallback(() => {
    haptics.light();
    setIsClosing(true);
    setTimeout(() => {
      onClose();
      setIsClosing(false);
    }, 200);
  }, [onClose]);

  const handleCloseButton = useCallback(() => {
    haptics.light();
    setIsClosing(true);
    setTimeout(() => {
      onClose();
      setIsClosing(false);
    }, 200);
  }, [onClose]);

  if (!isOpen) return null;

  // Calculate backdrop opacity based on drag
  const backdropOpacity = Math.max(0, 0.7 - (dragY / 300));

  return (
    <>
      {/* Backdrop with blur */}
      <div
        className="fixed inset-0 z-40 transition-all duration-300"
        style={{
          backgroundColor: `rgba(0, 0, 0, ${isClosing ? 0 : backdropOpacity})`,
          backdropFilter: isClosing ? 'none' : `blur(${Math.max(0, 4 - dragY / 50)}px)`,
        }}
        onClick={handleBackdropClick}
      />

      {/* Sheet with glass morphism */}
      <div
        ref={sheetRef}
        className={`fixed left-0 right-0 bottom-0 z-50
          bg-gray-900/95 backdrop-blur-xl
          border-t border-white/10
          rounded-t-3xl shadow-2xl
          ${isClosing ? 'animate-slide-down' : 'animate-slide-up'}`}
        style={{
          maxHeight,
          transform: `translateY(${isClosing ? '100%' : `${dragY}px`})`,
          transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)',
          paddingBottom: 'env(safe-area-inset-bottom)',
          boxShadow: '0 -10px 40px rgba(0, 0, 0, 0.3), 0 0 80px rgba(230, 57, 70, 0.05)'
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Drag handle - Premium styling */}
        <div className="bottom-sheet-handle flex flex-col items-center pt-4 pb-3 cursor-grab active:cursor-grabbing">
          <div className="relative">
            {/* Glow effect on drag */}
            {isDragging && (
              <div className="absolute inset-0 w-12 h-1.5 rounded-full bg-brand-red/30 blur-md" />
            )}
            <div className={`w-12 h-1.5 rounded-full transition-all duration-200
              ${isDragging ? 'bg-brand-red scale-110' : 'bg-white/20'}`}
            />
          </div>
          {/* Drag hint */}
          {dragY > 50 && (
            <span className="mt-2 text-[10px] text-gray-500 font-medium animate-fade-in">
              Release to close
            </span>
          )}
        </div>

        {/* Header with title and close button */}
        {title && (
          <div className="flex items-center justify-between px-5 pb-4 border-b border-white/5">
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-bold text-white truncate">{title}</h3>
              {subtitle && (
                <p className="text-xs text-gray-500 mt-0.5 truncate">{subtitle}</p>
              )}
            </div>
            <button
              type="button"
              onClick={handleCloseButton}
              className="flex-shrink-0 ml-3 w-9 h-9 -mr-1 flex items-center justify-center
                rounded-full bg-white/5 border border-white/10
                text-gray-400 hover:text-white hover:bg-white/10
                active:scale-95 transition-all duration-150"
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Content with scrollbar hidden */}
        <div
          className="overflow-y-auto overscroll-contain scrollbar-hide"
          style={{ maxHeight: title ? 'calc(85vh - 100px)' : 'calc(85vh - 50px)' }}
        >
          {children}
        </div>

        {/* Bottom safe area gradient */}
        <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-gray-900 to-transparent pointer-events-none" />
      </div>
    </>
  );
};

export default BottomSheet;
