export type TierName = 'lite' | 'balanced' | 'full';

export interface TierConfig {
  name: TierName;
  frameSet: '720' | '1080';
  frameWidth: number;
  frameHeight: number;
  memoryBudgetMB: number;
  maxCanvasWidth: number;
  maxCanvasHeight: number;
  dprCap: number;
  concurrentFetches: number;
  crossfade: boolean;
  smoothingK: number;
  textBlurPx: number;
  navBackdropBlur: string;
  lenis: boolean;
  customCursor: boolean;
  filmGrain: boolean;
}

export const TIERS: Record<TierName, TierConfig> = {
  lite: {
    name: 'lite',
    frameSet: '720',
    frameWidth: 1280,
    frameHeight: 720,
    memoryBudgetMB: 96,
    maxCanvasWidth: 1280,
    maxCanvasHeight: 720,
    dprCap: 1.0,
    concurrentFetches: 3,
    crossfade: true,
    smoothingK: 10,
    textBlurPx: 0,
    navBackdropBlur: 'none',
    lenis: false,
    customCursor: false,
    filmGrain: false,
  },
  balanced: {
    name: 'balanced',
    frameSet: '1080',
    frameWidth: 1920,
    frameHeight: 1080,
    memoryBudgetMB: 160,
    maxCanvasWidth: 1920,
    maxCanvasHeight: 1080,
    dprCap: 1.5,
    concurrentFetches: 4,
    crossfade: true,
    smoothingK: 8,
    textBlurPx: 4,
    navBackdropBlur: '12px',
    lenis: true,
    customCursor: true,
    filmGrain: true,
  },
  full: {
    name: 'full',
    frameSet: '1080',
    frameWidth: 1920,
    frameHeight: 1080,
    memoryBudgetMB: 256,
    maxCanvasWidth: 1920,
    maxCanvasHeight: 1080,
    dprCap: 2.0,
    concurrentFetches: 6,
    crossfade: true,
    smoothingK: 7,
    textBlurPx: 10,
    navBackdropBlur: '18px',
    lenis: true,
    customCursor: true,
    filmGrain: true,
  },
};

export const TIER_THRESHOLDS = {
  downgradeLatencyMs: 22, // >22ms median rAF interval while scrolling (~ <45 fps) triggers downgrade
  downgradeWindowTicks: 90,
  minDisplayPreloaderSec: 2.2,
  maxPreloaderTimeoutSec: 5.0,
  anchorThreshold: 0.70, // 70% of anchor thumbs must be loaded
};
