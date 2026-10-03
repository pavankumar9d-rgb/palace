'use client';

import { useEffect, useRef } from 'react';
import { CHAPTER_COPY, type ChapterCopy } from '@/config/film';
import { scrollEngine } from '@/engine/scrollEngine';

interface ChaptersProps {
  onOpenEnquiry: () => void;
}

export default function Chapters({ onOpenEnquiry }: ChaptersProps) {
  const nodeRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const chapterKeys = [
    'C01', 'C02', 'C03', 'C04', 'C05', 'C06',
    'C07', 'C08', 'C09', 'C10', 'C11', 'C12',
  ];

  useEffect(() => {
    chapterKeys.forEach(id => {
      const el = nodeRefs.current.get(id);
      if (el) {
        scrollEngine.registerChapterElement(id, el);
      }
    });

    return () => {
      chapterKeys.forEach(id => {
        scrollEngine.registerChapterElement(id, null);
      });
    };
  }, []);

  return (
    <div className="relative w-full h-full pointer-events-none">
      {chapterKeys.map((id, index) => {
        const item: ChapterCopy = CHAPTER_COPY[id] ?? {
          id,
          headline: 'AURELIA HOUSE',
          subline: 'The Sanctuary',
          position: 'center',
          vertical: 'lower',
        };

        const isCenter = item.position === 'center';
        const isLeft = item.position === 'left';
        const isRight = item.position === 'right';
        const isMiddle = item.vertical === 'middle';

        return (
          <div
            key={id}
            ref={el => {
              if (el) nodeRefs.current.set(id, el);
              else nodeRefs.current.delete(id);
            }}
            id={`chapter-${id}`}
            className={`chapter-node absolute inset-0 flex flex-col justify-end p-8 md:p-16 lg:p-24 transition-all duration-75 ${
              isMiddle ? '!justify-center items-center text-center' : ''
            } ${
              !isMiddle && isCenter ? 'items-center text-center' : ''
            } ${
              !isMiddle && isLeft ? 'items-start text-left' : ''
            } ${
              !isMiddle && isRight ? 'items-end text-right' : ''
            }`}
            style={{
              willChange: 'transform, opacity',
            }}
          >
            <div className="max-w-3xl space-y-4">
              {/* Micro-label index */}
              <div className="flex items-center gap-3 text-xs tracking-[0.3em] uppercase text-[var(--gold)] font-mono">
                <span>CHAPTER {String(index + 1).padStart(2, '0')}</span>
                <span className="w-8 h-[1px] bg-[var(--gold)] opacity-40" />
                <span>{id}</span>
              </div>

              {/* Real heading: H1 for C01, H2 for rest */}
              {index === 0 ? (
                <h1 className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-headline tracking-[0.12em] uppercase text-[var(--ivory)] leading-[1.1] drop-shadow-lg">
                  {item.headline}
                </h1>
              ) : (
                <h2 className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-headline tracking-[0.12em] uppercase text-[var(--ivory)] leading-[1.1] drop-shadow-lg">
                  {item.headline}
                </h2>
              )}

              {/* Poetic Subline */}
              <p className="text-sm sm:text-base md:text-lg text-[var(--champagne)] font-light tracking-[0.05em] opacity-90 max-w-xl">
                {item.subline}
              </p>

              {/* C12 Final Call to Action button */}
              {item.hasCta && (
                <div className="pt-8 pointer-events-auto">
                  <button
                    onClick={onOpenEnquiry}
                    data-magnetic
                    data-cursor-label="VIEWING"
                    className="group relative inline-flex items-center gap-4 px-8 py-4 text-xs tracking-[0.25em] uppercase font-medium bg-[var(--gold)] text-[var(--bg)] rounded-none border border-[var(--gold)] transition-all duration-300 hover:bg-transparent hover:text-[var(--gold)] shadow-2xl hover:shadow-[0_0_30px_rgba(212,175,55,0.3)] active:scale-95"
                  >
                    <span>REQUEST A PRIVATE VIEWING</span>
                    <svg
                      className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M17 8l4 4m0 0l-4 4m4-4H3"
                      />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
