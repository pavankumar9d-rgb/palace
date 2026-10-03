'use client';

import { useEffect, useRef, useState } from 'react';
import { tierManager } from '@/engine/tier';

export default function Cursor() {
  const [enabled, setEnabled] = useState(false);
  const [cursorLabel, setCursorLabel] = useState<string | null>(null);
  const [isHovered, setIsHovered] = useState(false);

  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);

  const mousePos = useRef({ x: -100, y: -100 });
  const ringPos = useRef({ x: -100, y: -100 });
  const rafId = useRef<number | null>(null);

  useEffect(() => {
    // Check if fine pointer device and tier allows custom cursor
    const hasFinePointer = window.matchMedia('(pointer: fine)').matches;
    const tier = tierManager.getTier();

    const shouldEnable = hasFinePointer && tier.customCursor;
    setEnabled(shouldEnable);

    const unsubscribe = tierManager.subscribe(newTier => {
      setEnabled(hasFinePointer && newTier.customCursor);
    });

    if (!shouldEnable) return () => unsubscribe();

    const handleMouseMove = (e: MouseEvent) => {
      mousePos.current = { x: e.clientX, y: e.clientY };

      if (dotRef.current) {
        dotRef.current.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
      }

      // Check for magnetic targets
      const target = (e.target as HTMLElement).closest('[data-magnetic]') as HTMLElement | null;
      if (target) {
        setIsHovered(true);
        const label = target.getAttribute('data-cursor-label');
        setCursorLabel(label);

        // Subtle magnetic pull on the target
        const rect = target.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const pullX = (e.clientX - centerX) * 0.15;
        const pullY = (e.clientY - centerY) * 0.15;
        target.style.transform = `translate3d(${Math.max(-10, Math.min(10, pullX))}px, ${Math.max(
          -10,
          Math.min(10, pullY)
        )}px, 0)`;
      } else {
        setIsHovered(false);
        setCursorLabel(null);
      }
    };

    const handleMouseLeave = () => {
      mousePos.current = { x: -100, y: -100 };
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    document.addEventListener('mouseleave', handleMouseLeave);

    // Smooth trailing ring loop (lerp 0.18)
    const animateRing = () => {
      const lerp = 0.18;
      ringPos.current.x += (mousePos.current.x - ringPos.current.x) * lerp;
      ringPos.current.y += (mousePos.current.y - ringPos.current.y) * lerp;

      if (ringRef.current) {
        ringRef.current.style.transform = `translate3d(${ringPos.current.x}px, ${ringPos.current.y}px, 0)`;
      }
      rafId.current = requestAnimationFrame(animateRing);
    };

    rafId.current = requestAnimationFrame(animateRing);

    return () => {
      unsubscribe();
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
      if (rafId.current !== null) cancelAnimationFrame(rafId.current);
    };
  }, []);

  if (!enabled) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden select-none">
      {/* 1. Precision Center Dot (6px) */}
      <div
        ref={dotRef}
        className="fixed top-0 left-0 -ml-[3px] -mt-[3px] w-[6px] h-[6px] rounded-full bg-[var(--gold)] will-change-transform transition-opacity duration-200"
      />

      {/* 2. Inertial Trailing Ring (32px, expands on magnetic hover) */}
      <div
        ref={ringRef}
        className={`fixed top-0 left-0 flex items-center justify-center rounded-full border transition-all duration-300 will-change-transform ${
          isHovered
            ? '-ml-6 -mt-6 w-12 h-12 border-[var(--gold)] bg-[var(--gold)]/10 shadow-[0_0_15px_rgba(212,175,55,0.4)]'
            : '-ml-4 -mt-4 w-8 h-8 border-white/20'
        }`}
      >
        {cursorLabel && (
          <span className="text-[8px] font-mono tracking-widest text-[var(--gold)] uppercase -mt-8 font-medium">
            {cursorLabel}
          </span>
        )}
      </div>
    </div>
  );
}
