'use client';

import { useEffect, useState } from 'react';
import { frameLoader } from '@/engine/frameLoader';
import { TIER_THRESHOLDS } from '@/config/tiers';

interface PreloaderProps {
  onDismiss: () => void;
}

export default function Preloader({ onDismiss }: PreloaderProps) {
  const [percent, setPercent] = useState(0);
  const [isFading, setIsFading] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    // Lock scroll during preloader
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const startTime = Date.now();
    let isDismissed = false;

    const finishPreloader = () => {
      if (isDismissed) return;
      isDismissed = true;

      const elapsed = (Date.now() - startTime) / 1000;
      const remainingTimeMs = Math.max(0, (TIER_THRESHOLDS.minDisplayPreloaderSec - elapsed) * 1000);

      setTimeout(() => {
        setIsFading(true);
        setTimeout(() => {
          setIsComplete(true);
          document.body.style.overflow = prevOverflow;
          onDismiss();
        }, 1200); // 1.2s dissolve into frame 1
      }, remainingTimeMs);
    };

    // Preload startup assets
    frameLoader
      .preloadStartup(pct => {
        setPercent(prev => Math.max(prev, pct));
      })
      .then(() => {
        setPercent(100);
        finishPreloader();
      })
      .catch(err => {
        console.warn('[Preloader] Error during preload:', err);
        finishPreloader();
      });

    // Safety timeout: dismiss after 5s max
    const maxTimeout = setTimeout(() => {
      setPercent(100);
      finishPreloader();
    }, TIER_THRESHOLDS.maxPreloaderTimeoutSec * 1000);

    return () => {
      clearTimeout(maxTimeout);
      document.body.style.overflow = prevOverflow;
    };
  }, [onDismiss]);

  if (isComplete) return null;

  return (
    <div
      aria-hidden="true"
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-[var(--bg)] transition-opacity duration-1000 ease-out select-none ${
        isFading ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      <div className="flex flex-col items-center max-w-sm px-6 text-center space-y-6">
        {/* Animated Wordmark */}
        <h1 className="text-xl sm:text-2xl font-headline tracking-[0.35em] uppercase text-[var(--ivory)] animate-pulse">
          AURELIA HOUSE
        </h1>
        <p className="text-[10px] tracking-[0.25em] uppercase text-[var(--champagne)] opacity-60">
          PRIVATE LUXURY MOUNTAIN ESTATE
        </p>

        {/* Hairline Gold Progress Bar */}
        <div className="w-48 sm:w-64 h-[1px] bg-white/10 relative overflow-hidden my-4">
          <div
            className="h-full bg-[var(--gold)] transition-all duration-300 ease-out shadow-[0_0_10px_rgba(212,175,55,0.7)]"
            style={{ width: `${percent}%` }}
          />
        </div>

        {/* Real Percentage Readout */}
        <span className="text-xs font-mono text-[var(--gold)] tracking-widest">
          {percent}%
        </span>
      </div>
    </div>
  );
}
