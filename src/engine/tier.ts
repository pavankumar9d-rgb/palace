import { TIERS, TIER_THRESHOLDS, type TierConfig, type TierName } from '@/config/tiers';

export class TierManager {
  private currentTierName: TierName = 'balanced';
  private currentTier: TierConfig = TIERS.balanced;
  private tickIntervals: number[] = [];
  private lastTickTime: number = 0;
  private isScrolling: boolean = false;
  private scrollTimeout: number | null = null;
  private listeners: Array<(tier: TierConfig) => void> = [];

  constructor() {
    if (typeof window !== 'undefined') {
      this.currentTierName = this.detectInitialTier();
      this.currentTier = TIERS[this.currentTierName];
    }
  }

  public getTier(): TierConfig {
    return this.currentTier;
  }

  public subscribe(cb: (tier: TierConfig) => void): () => void {
    this.listeners.push(cb);
    return () => {
      this.listeners = this.listeners.filter(l => l !== cb);
    };
  }

  public detectInitialTier(): TierName {
    if (typeof window === 'undefined') return 'balanced';

    // 1. URL override: ?tier=lite|balanced|full
    const urlParams = new URLSearchParams(window.location.search);
    const tierParam = urlParams.get('tier') as TierName | null;
    if (tierParam && TIERS[tierParam]) {
      sessionStorage.setItem('aurelia_tier', tierParam);
      return tierParam;
    }

    // 2. SessionStorage cache
    const savedTier = sessionStorage.getItem('aurelia_tier') as TierName | null;
    if (savedTier && TIERS[savedTier]) {
      return savedTier;
    }

    // 3. Hardware heuristics
    const nav = navigator as unknown as {
      deviceMemory?: number;
      hardwareConcurrency?: number;
      connection?: { saveData?: boolean; effectiveType?: string };
    };

    const deviceMemory = nav.deviceMemory ?? 8;
    const cores = nav.hardwareConcurrency ?? 4;
    const saveData = nav.connection?.saveData ?? false;
    const effectiveType = nav.connection?.effectiveType ?? '4g';
    const isSlowConn = ['slow-2g', '2g', '3g'].includes(effectiveType);

    // Lite tier rule: <=4 GB RAM OR <=4 cores OR Save-Data OR slow connection
    if (deviceMemory <= 4 || cores <= 4 || saveData || isSlowConn) {
      return 'lite';
    }

    // Full tier rule: >=8 GB RAM AND >=8 cores AND fast connection
    if (deviceMemory >= 8 && cores >= 8 && !saveData) {
      return 'full';
    }

    return 'balanced';
  }

  public recordScrollActivity(): void {
    this.isScrolling = true;
    if (this.scrollTimeout) {
      window.clearTimeout(this.scrollTimeout);
    }
    this.scrollTimeout = window.setTimeout(() => {
      this.isScrolling = false;
      this.tickIntervals = []; // reset measurement window when idle
    }, 150);
  }

  public recordTick(timestamp: number): void {
    if (!this.lastTickTime) {
      this.lastTickTime = timestamp;
      return;
    }

    const dt = timestamp - this.lastTickTime;
    this.lastTickTime = timestamp;

    if (!this.isScrolling) return;

    this.tickIntervals.push(dt);
    if (this.tickIntervals.length >= TIER_THRESHOLDS.downgradeWindowTicks) {
      this.checkAdaptiveDowngrade();
      this.tickIntervals = [];
    }
  }

  private checkAdaptiveDowngrade(): void {
    if (this.currentTierName === 'lite') return; // Cannot downgrade past lite

    const sorted = [...this.tickIntervals].sort((a, b) => a - b);
    const medianDt = sorted[Math.floor(sorted.length / 2)];

    if (medianDt > TIER_THRESHOLDS.downgradeLatencyMs) {
      // Median latency exceeds 22ms (<45 fps), downgrade one tier live
      const nextTierName: TierName = this.currentTierName === 'full' ? 'balanced' : 'lite';
      console.warn(`[TierManager] Adaptive downgrade triggered: median rAF ${medianDt.toFixed(1)}ms. Switching ${this.currentTierName} -> ${nextTierName}`);
      this.setTier(nextTierName);
    }
  }

  public setTier(name: TierName): void {
    if (!TIERS[name]) return;
    this.currentTierName = name;
    this.currentTier = TIERS[name];
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('aurelia_tier', name);
    }
    this.listeners.forEach(cb => cb(this.currentTier));
  }
}

export const tierManager = new TierManager();
