'use client';

import { useEffect, useState, useRef } from 'react';
import { tierManager } from '@/engine/tier';

interface NavbarProps {
  onOpenMenu: () => void;
  onOpenEnquiry: () => void;
}

export default function Navbar({ onOpenMenu, onOpenEnquiry }: NavbarProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [blurStyle, setBlurStyle] = useState('12px');
  const lastScrollY = useRef(0);

  useEffect(() => {
    const tier = tierManager.getTier();
    setBlurStyle(tier.navBackdropBlur);

    const unsubscribe = tierManager.subscribe(newTier => {
      setBlurStyle(newTier.navBackdropBlur);
    });

    const handleScroll = () => {
      const currentScrollY = window.scrollY || window.pageYOffset;
      if (currentScrollY <= 80) {
        setIsVisible(true);
      } else if (currentScrollY > lastScrollY.current + 10) {
        // Downward scroll
        setIsVisible(false);
      } else if (currentScrollY < lastScrollY.current - 10) {
        // Upward scroll
        setIsVisible(true);
      }
      lastScrollY.current = currentScrollY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      unsubscribe();
    };
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-40 transition-transform duration-500 ease-out ${
        isVisible ? 'translate-y-0' : '-translate-y-full'
      }`}
      style={{ willChange: 'transform' }}
    >
      <nav
        className="glass-nav mx-auto px-6 md:px-12 py-5 flex items-center justify-between"
        style={{ '--nav-blur': blurStyle } as React.CSSProperties}
      >
        {/* Brand Wordmark */}
        <div className="flex items-center gap-3">
          <a
            href="#"
            data-magnetic
            className="text-sm md:text-base font-headline tracking-[0.28em] uppercase text-[var(--ivory)] hover:text-[var(--gold)] transition-colors duration-300"
          >
            AURELIA HOUSE
          </a>
          <span className="hidden sm:inline-block w-2 h-2 rounded-full bg-[var(--gold)] opacity-60" />
          <span className="hidden sm:inline-block text-[10px] tracking-[0.2em] uppercase text-[var(--champagne)] opacity-60">
            SANCTUARY
          </span>
        </div>

        {/* Navigation Actions */}
        <div className="flex items-center gap-4 md:gap-8">
          <button
            onClick={onOpenMenu}
            data-magnetic
            data-cursor-label="MENU"
            className="text-xs tracking-[0.2em] uppercase text-[var(--champagne)] hover:text-[var(--ivory)] transition-colors py-2 px-3 border border-transparent hover:border-hairline"
          >
            CHAPTERS
          </button>

          <button
            onClick={onOpenEnquiry}
            data-magnetic
            data-cursor-label="CONTACT"
            className="text-xs tracking-[0.2em] uppercase font-medium bg-[var(--gold)] text-[var(--bg)] px-5 py-2.5 transition-all duration-300 hover:bg-[var(--champagne)] active:scale-95 shadow-md"
          >
            PRIVATE VIEWING
          </button>
        </div>
      </nav>
    </header>
  );
}
