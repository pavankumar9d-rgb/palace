'use client';

import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CHAPTER_COPY } from '@/config/film';
import { scrollEngine } from '@/engine/scrollEngine';

interface ChapterMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ChapterMenu({ isOpen, onClose }: ChapterMenuProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  const chapters = Object.values(CHAPTER_COPY);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8 bg-black/90 backdrop-blur-xl select-none"
          onClick={onClose}
        >
          <motion.div
            ref={containerRef}
            initial={{ scale: 0.95, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 20 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            onClick={e => e.stopPropagation()}
            className="glass-card w-full max-w-4xl max-h-[85vh] overflow-y-auto p-6 sm:p-10 text-[var(--ivory)] relative shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-hairline pb-6 mb-8">
              <div>
                <span className="text-[10px] font-mono tracking-[0.3em] uppercase text-[var(--gold)]">
                  TABLE OF CHAPTERS
                </span>
                <h2 className="text-2xl sm:text-3xl font-headline tracking-widest uppercase mt-1">
                  THE ESTATE CHRONICLE
                </h2>
              </div>
              <button
                onClick={onClose}
                aria-label="Close chapter menu"
                data-magnetic
                className="w-10 h-10 flex items-center justify-center rounded-full border border-hairline hover:border-[var(--gold)] text-[var(--champagne)] hover:text-[var(--gold)] transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Chapters Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              {chapters.map((ch, idx) => (
                <button
                  key={ch.id}
                  onClick={() => {
                    scrollEngine.scrollToChapter(ch.id);
                    onClose();
                  }}
                  data-magnetic
                  data-cursor-label="JUMP"
                  className="group flex items-start gap-4 p-4 text-left border border-white/5 hover:border-[var(--gold)]/40 hover:bg-white/5 transition-all duration-300"
                >
                  <span className="text-xs font-mono text-[var(--gold)] tracking-widest mt-1">
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                  <div>
                    <h3 className="text-sm font-headline tracking-widest uppercase group-hover:text-[var(--gold)] transition-colors">
                      {ch.headline}
                    </h3>
                    <p className="text-xs text-[var(--champagne)] opacity-60 font-light mt-1">
                      {ch.subline}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
