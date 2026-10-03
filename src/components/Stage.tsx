'use client';

import { useEffect, useRef } from 'react';
import { canvasRenderer } from '@/engine/canvasRenderer';
import { tierManager } from '@/engine/tier';

export default function Stage({ children }: { children: React.ReactNode }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    canvasRenderer.setCanvas(canvasRef.current);
  }, []);

  return (
    <div
      ref={stageRef}
      className="sticky top-0 w-full h-[100lvh] overflow-hidden bg-[var(--bg)] select-none"
    >
      {/* 1. Hardware-accelerated canvas */}
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="Aurelia House cinematic film presentation"
        className="absolute inset-0 w-full h-full block object-cover will-change-transform"
      />

      {/* 2. Pure-CSS Vignette Overlay (melts canvas into background) */}
      <div className="absolute inset-0 vignette-overlay pointer-events-none z-10" />
      <div className="absolute inset-x-0 top-0 h-32 edge-fade-top pointer-events-none z-10" />
      <div className="absolute inset-x-0 bottom-0 h-32 edge-fade-bottom pointer-events-none z-10" />
      {/* Bottom-right watermark diffuser: deep obsidian gradient that melts corner generation marks into the estate tone */}
      <div
        className="absolute bottom-0 right-0 w-80 h-44 pointer-events-none z-10"
        style={{
          background:
            'radial-gradient(ellipse at bottom right, rgba(10, 7, 3, 0.95) 15%, rgba(10, 7, 3, 0.75) 45%, rgba(10, 7, 3, 0) 80%)',
        }}
      />

      {/* 3. Subtle Film Grain (Balanced / Full only) */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none z-15 mix-blend-overlay"
        style={{
          backgroundImage: `radial-gradient(rgba(249, 248, 245, 0.4) 1px, transparent 0)`,
          backgroundSize: '4px 4px',
        }}
      />

      {/* 4. Active Chapter text & overlays */}
      <div className="absolute inset-0 pointer-events-none z-20">
        {children}
      </div>
    </div>
  );
}
