'use client';

import { useEffect, useState } from 'react';
import { scrollEngine, type ScrollHudData } from '@/engine/scrollEngine';

export default function DebugHud() {
  const [showHud, setShowHud] = useState(false);
  const [hudData, setHudData] = useState<ScrollHudData | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('debug') === '1') {
      setShowHud(true);
    }

    const unsubscribe = scrollEngine.subscribeHud(data => {
      setHudData(data);
    });

    return () => unsubscribe();
  }, []);

  if (!showHud || !hudData) return null;

  return (
    <div
      style={{ willChange: 'contents' }}
      className="fixed bottom-4 left-4 z-50 p-4 font-mono text-[11px] bg-black/85 border border-[var(--gold)]/40 rounded text-[var(--champagne)] space-y-1 select-none pointer-events-none shadow-2xl backdrop-blur-md"
    >
      <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-1.5 mb-1.5 text-[var(--gold)] font-bold">
        <span>AURELIA ENGINE HUD</span>
        <span>{hudData.tier.toUpperCase()}</span>
      </div>
      <div>Progress: {hudData.progress.toFixed(4)} ({(hudData.progress * 100).toFixed(1)}%)</div>
      <div>Target Frame: {hudData.target.toFixed(2)}</div>
      <div>Current Frame: {hudData.current.toFixed(2)}</div>
      <div>Drawn Index: {hudData.drawnIndex}</div>
      <div>Ready Frames in Cache: {hudData.readyFrames}</div>
      <div>Decoded Memory: {hudData.decodedMB} MB</div>
      <div className="flex items-center justify-between pt-1 border-t border-white/10 mt-1">
        <span>Engine FPS:</span>
        <span className={hudData.fps < 45 ? 'text-amber-400 font-bold' : 'text-emerald-400 font-bold'}>
          {hudData.fps} FPS
        </span>
      </div>
    </div>
  );
}
