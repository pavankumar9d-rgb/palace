'use client';

import { useEffect, useState } from 'react';
import { scrollEngine, type ScrollHudData } from '@/engine/scrollEngine';

const CHAPTER_IDS = [
  'C01', 'C02', 'C03', 'C04', 'C05', 'C06',
  'C07', 'C08', 'C09', 'C10', 'C11', 'C12',
];

export default function ProgressRail() {
  const [activeChapterIndex, setActiveChapterIndex] = useState(0);
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    const unsubscribe = scrollEngine.subscribeHud((data: ScrollHudData) => {
      setScrollProgress(data.progress);
      const chIdx = Math.min(
        11,
        Math.floor(data.progress * 12)
      );
      setActiveChapterIndex(chIdx);
    });

    return () => unsubscribe();
  }, []);

  return (
    <aside
      aria-label="Chapter progress rail"
      className="fixed right-6 md:right-10 top-1/2 -translate-y-1/2 z-30 hidden sm:flex flex-col items-center gap-3 select-none pointer-events-auto"
    >
      {/* Current Chapter Indicator */}
      <span className="text-[10px] font-mono text-[var(--gold)] tracking-widest uppercase mb-2">
        {String(activeChapterIndex + 1).padStart(2, '0')}
      </span>

      {/* 12 Chapter Jump Ticks */}
      <div className="relative flex flex-col items-center gap-2.5 py-2">
        {CHAPTER_IDS.map((id, index) => {
          const isActive = index === activeChapterIndex;
          const isPassed = index < activeChapterIndex;

          return (
            <button
              key={id}
              onClick={() => scrollEngine.scrollToChapter(id)}
              data-magnetic
              data-cursor-label={`CH ${index + 1}`}
              title={`Jump to Chapter ${index + 1} (${id})`}
              className="group relative flex items-center justify-center p-1.5 focus:outline-none"
              aria-label={`Jump to Chapter ${index + 1}`}
            >
              {/* Tick marker line */}
              <span
                className={`transition-all duration-300 rounded-full ${
                  isActive
                    ? 'w-6 h-[2px] bg-[var(--gold)] shadow-[0_0_8px_rgba(212,175,55,0.8)]'
                    : isPassed
                    ? 'w-3 h-[1px] bg-[var(--champagne)] opacity-50 group-hover:w-5 group-hover:opacity-90'
                    : 'w-2 h-[1px] bg-[var(--ivory)] opacity-20 group-hover:w-4 group-hover:opacity-70'
                }`}
              />
            </button>
          );
        })}
      </div>

      {/* Progress percentage readout */}
      <span className="text-[9px] font-mono text-[var(--champagne)] opacity-50 tracking-tighter mt-2">
        {Math.round(scrollProgress * 100)}%
      </span>
    </aside>
  );
}
