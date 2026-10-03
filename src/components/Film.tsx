'use client';

import { useEffect, useState, useRef } from 'react';
import dynamic from 'next/dynamic';
import Lenis from 'lenis';
import Stage from './Stage';
import Chapters from './Chapters';
import Navbar from './Navbar';
import ProgressRail from './ProgressRail';
import Preloader from './Preloader';
import Cursor from './Cursor';
import DebugHud from './DebugHud';

import { frameLoader, type ManifestData } from '@/engine/frameLoader';
import { scrollEngine, type ScrollHudData } from '@/engine/scrollEngine';
import { tierManager } from '@/engine/tier';

// Dynamic lazy imports for modal and chapter menu
const ChapterMenu = dynamic(() => import('./lazy/ChapterMenu'), { ssr: false });
const EnquiryModal = dynamic(() => import('./lazy/EnquiryModal'), { ssr: false });

export default function Film() {
  const [manifest, setManifest] = useState<ManifestData | null>(null);
  const [isPreloaderDismissed, setIsPreloaderDismissed] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isEnquiryOpen, setIsEnquiryOpen] = useState(false);
  const [isAtEnd, setIsAtEnd] = useState(false);

  const containerRef = useRef<HTMLElement>(null);
  const stageWrapperRef = useRef<HTMLDivElement>(null);
  const lenisRef = useRef<Lenis | null>(null);

  useEffect(() => {
    let cleanupScrollEngine: (() => void) | null = null;

    // Load manifest and initialize engines
    frameLoader
      .init('/frames/manifest.json')
      .then(m => {
        setManifest(m);

        if (containerRef.current && stageWrapperRef.current) {
          cleanupScrollEngine = scrollEngine.init(
            containerRef.current,
            stageWrapperRef.current,
            m
          );
        }

        // Initialize Lenis smooth scroll for balanced / full tiers
        let lenisRafId: number | null = null;
        const tier = tierManager.getTier();
        if (tier.lenis) {
          const lenis = new Lenis({
            duration: 0.6,
            easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
            smoothWheel: false, // Direct, natural mouse pad / trackpad control
            touchMultiplier: 1.0,
          });

          function raf(time: number) {
            lenis.raf(time);
            lenisRafId = requestAnimationFrame(raf);
          }
          lenisRafId = requestAnimationFrame(raf);
          lenisRef.current = lenis;
        }
      })
      .catch(err => {
        console.error('[Film] Failed to initialize asset manifest:', err);
      });

    // Monitor progress for end-state overlay past 0.985
    const unsubscribeHud = scrollEngine.subscribeHud((data: ScrollHudData) => {
      setIsAtEnd(data.progress >= 0.985);
    });

    // Automated showcase recording runner when ?showcase=1 is present
    let showcaseTimer: NodeJS.Timeout | null = null;
    let showcaseCancelled = false;

    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('showcase') === '1') {
        const runShowcase = async () => {
          // Wait 2.8s for preloader and initial frames to settle
          await new Promise(r => setTimeout(r, 2800));
          if (showcaseCancelled) return;

          const maxScroll = Math.max(1, (containerRef.current?.offsetHeight ?? 8000) - window.innerHeight);

          // Phase 1: Smooth forward scroll through all 12 chapters (0% -> 100% over ~15 seconds)
          const forwardDuration = 15000;
          const forwardStart = performance.now();

          await new Promise<void>(resolve => {
            function forwardStep(now: number) {
              if (showcaseCancelled) return resolve();
              const elapsed = now - forwardStart;
              const t = Math.min(1, elapsed / forwardDuration);
              // Smooth cubic ease in-out
              const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
              window.scrollTo(0, eased * maxScroll);
              if (t < 1) {
                requestAnimationFrame(forwardStep);
              } else {
                resolve();
              }
            }
            requestAnimationFrame(forwardStep);
          });

          // Phase 2: Pause at conclusion screen (2.0 seconds)
          await new Promise(r => setTimeout(r, 2000));
          if (showcaseCancelled) return;

          // Phase 3: High-speed rewind from last to first (100% -> 0% over ~2.4 seconds)
          const rewindDuration = 2400;
          const rewindStart = performance.now();

          await new Promise<void>(resolve => {
            function rewindStep(now: number) {
              if (showcaseCancelled) return resolve();
              const elapsed = now - rewindStart;
              const t = Math.min(1, elapsed / rewindDuration);
              // Fast ease-out back to 0
              const eased = 1 - Math.min(1, t * t * (3 - 2 * t));
              window.scrollTo(0, eased * maxScroll);
              if (t < 1) {
                requestAnimationFrame(rewindStep);
              } else {
                window.scrollTo(0, 0);
                resolve();
              }
            }
            requestAnimationFrame(rewindStep);
          });

          // Phase 4: Settle cleanly at start
          await new Promise(r => setTimeout(r, 1200));
          (window as unknown as { __showcaseFinished?: boolean }).__showcaseFinished = true;
        };

        showcaseTimer = setTimeout(runShowcase, 100);
      }
    }

    return () => {
      showcaseCancelled = true;
      if (showcaseTimer) clearTimeout(showcaseTimer);
      if (cleanupScrollEngine) cleanupScrollEngine();
      if (lenisRef.current) {
        lenisRef.current.destroy();
        lenisRef.current = null;
      }
      unsubscribeHud();
    };
  }, []);

  return (
    <>
      {/* 1. Preloader overlay */}
      <Preloader onDismiss={() => setIsPreloaderDismissed(true)} />

      {/* 2. Custom hardware cursor */}
      <Cursor />

      {/* 3. Navigation Bar */}
      <Navbar
        onOpenMenu={() => setIsMenuOpen(true)}
        onOpenEnquiry={() => setIsEnquiryOpen(true)}
      />

      {/* 4. Progress Rail */}
      <ProgressRail />

      {/* 5. Main Scroll Section (1000svh tall) */}
      <section
        id="film"
        ref={containerRef}
        className="relative w-full h-[1000svh] bg-[var(--bg)]"
      >
        <div id="film-content" ref={stageWrapperRef} className="sticky top-0 w-full h-[100lvh]">
          <Stage>
            <Chapters onOpenEnquiry={() => setIsEnquiryOpen(true)} />
          </Stage>

          {/* End-state fade to background (past 0.985 scroll) */}
          <div
            className={`absolute inset-0 z-30 flex flex-col items-center justify-center p-8 bg-[var(--bg)] transition-opacity duration-600 ease-out pointer-events-none ${
              isAtEnd ? 'opacity-90 pointer-events-auto' : 'opacity-0'
            }`}
          >
            <div className="text-center space-y-4 max-w-lg">
              <span className="text-[10px] font-mono tracking-[0.3em] uppercase text-[var(--gold)]">
                CONCLUSION OF VIEWING
              </span>
              <h3 className="text-2xl sm:text-4xl font-headline tracking-widest uppercase text-[var(--ivory)]">
                AURELIA HOUSE
              </h3>
              <p className="text-xs text-[var(--champagne)] opacity-70">
                A beacon above the night valley.
              </p>
              <div className="pt-6">
                <button
                  onClick={() => scrollEngine.scrollToTop()}
                  data-magnetic
                  data-cursor-label="TOP"
                  className="px-6 py-3 text-xs font-mono tracking-widest uppercase border border-[var(--gold)]/40 text-[var(--gold)] hover:bg-[var(--gold)] hover:text-[var(--bg)] transition-all"
                >
                  &uarr; BACK TO THE BEGINNING
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. Lazy Overlays */}
      {isMenuOpen && <ChapterMenu isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />}
      {isEnquiryOpen && (
        <EnquiryModal isOpen={isEnquiryOpen} onClose={() => setIsEnquiryOpen(false)} />
      )}

      {/* 7. Debug HUD */}
      <DebugHud />

      {/* 8. Noscript fallback */}
      <noscript>
        <div className="fixed inset-0 z-50 bg-[#0A0703] p-12 overflow-y-auto text-white">
          <h1 className="text-3xl font-serif tracking-widest text-[#D4AF37] mb-6">
            AURELIA HOUSE
          </h1>
          <p className="mb-6">
            JavaScript is required for the real-time scroll-driven cinematic journey.
          </p>
          <img
            src="/frames/1080/frame-0001.webp"
            alt="Aurelia House Arrival"
            className="w-full max-w-3xl rounded shadow-2xl mb-8"
          />
          <h2 className="text-xl font-serif text-[#D4AF37] mb-4">Chronicle of Chapters</h2>
          <ul className="space-y-2 text-sm text-gray-300">
            <li>C01: WELCOME TO AURELIA — A house above the mist</li>
            <li>C02: A THRESHOLD OF LIGHT — Bronze, oak and morning stone</li>
            <li>C03: ARCHITECTURE, BREATHING — Travertine, still water and quiet height</li>
            <li>C04: THE ASCENT — Every step, unhurried</li>
            <li>C05: WHERE ROYALTY SLEEPS — Linen, oak and a horizon of glass</li>
            <li>C06: OPEN THE DOORS — The valley, entirely yours</li>
            <li>C07: ABOVE THE CLOUDS — Horizon dissolves into water and sky</li>
            <li>C08: A FEAST OF ART — Stone arches and quiet candlelight</li>
            <li>C09: THE STILL WATER — Stone underfoot, nothing ahead but calm</li>
            <li>C10: SILENCE, PERFECTED — Waterfalls, steam and meditation gardens</li>
            <li>C11: EVERY SUNSET IS PRIVATE — Golden hour, symmetry and dancing fountains</li>
            <li>C12: AN UNFORGETTABLE DESTINATION — A beacon above the night valley</li>
          </ul>
        </div>
      </noscript>
    </>
  );
}
