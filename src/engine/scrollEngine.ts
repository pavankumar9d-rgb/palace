import { frameLoader, type ManifestData } from './frameLoader';
import { canvasRenderer } from './canvasRenderer';
import { tierManager } from './tier';
import { toneEngine } from './tone';
import { type TierConfig } from '@/config/tiers';

export interface ScrollHudData {
  progress: number;
  target: number;
  current: number;
  drawnIndex: number;
  readyFrames: number;
  decodedMB: number;
  tier: string;
  fps: number;
}

export class ScrollEngine {
  private isRunning = false;
  private rafId: number | null = null;
  private lastTime = 0;
  private isVisible = true;
  private isInViewport = true;

  private containerEl: HTMLElement | null = null;
  private stageEl: HTMLElement | null = null;
  private chapterElements: Map<string, HTMLElement> = new Map();

  private sectionTop = 0;
  private scrollableLength = 1;
  private count = 1441;

  // Smoothing states
  private target = 0;
  private current = 0;
  private progress = 0;
  private tier: TierConfig = tierManager.getTier();

  // Watchdog state: detects if animation gets stuck
  private lastDrawnTime = 0;
  private watchdogAlertCount = 0;

  // FPS calculation for HUD
  private frameCount = 0;
  private fpsLastTime = 0;
  private measuredFps = 60;

  // Subscriptions for Debug HUD
  private hudSubscribers: Array<(data: ScrollHudData) => void> = [];

  constructor() {
    tierManager.subscribe(newTier => {
      this.tier = newTier;
    });

    frameLoader.onFrameDecoded(() => {
      // Trigger redraw when a newly decoded frame arrives
      canvasRenderer.renderFrame(this.current, true);
    });
  }

  public init(
    container: HTMLElement,
    stage: HTMLElement,
    manifest: ManifestData
  ): () => void {
    this.containerEl = container;
    this.stageEl = stage;
    this.count = manifest.count;

    this.measureLayout();

    // Resize observer
    const ro = new ResizeObserver(() => {
      this.measureLayout();
      canvasRenderer.resize();
    });
    ro.observe(container);
    ro.observe(stage);

    // Event listeners to guarantee immediate resume
    const onScroll = () => {
      tierManager.recordScrollActivity();
      this.readScroll();
      if (!this.isRunning) {
        this.startLoop();
      }
    };
    const onVisibilityChange = () => {
      this.isVisible = document.visibilityState === 'visible';
      if (this.isVisible && !this.isRunning) this.startLoop();
    };
    const onFocus = () => {
      if (!this.isRunning) this.startLoop();
    };
    const onPageShow = () => {
      if (!this.isRunning) this.startLoop();
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('focus', onFocus);
    window.addEventListener('pageshow', onPageShow);

    // Viewport intersection observer: pauses loop only when far outside viewport
    const io = new IntersectionObserver(
      entries => {
        const entry = entries[0];
        this.isInViewport = entry.isIntersecting;
        if (this.isInViewport && !this.isRunning) this.startLoop();
      },
      { rootMargin: '100% 0px 100% 0px' }
    );
    io.observe(container);

    this.startLoop();

    return () => {
      this.stopLoop();
      ro.disconnect();
      io.disconnect();
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('pageshow', onPageShow);
    };
  }

  public registerChapterElement(id: string, el: HTMLElement | null): void {
    if (!el) {
      this.chapterElements.delete(id);
    } else {
      this.chapterElements.set(id, el);
    }
  }

  public subscribeHud(cb: (data: ScrollHudData) => void): () => void {
    this.hudSubscribers.push(cb);
    return () => {
      this.hudSubscribers = this.hudSubscribers.filter(s => s !== cb);
    };
  }

  private measureLayout(): void {
    if (!this.containerEl || !this.stageEl) return;
    const containerRect = this.containerEl.getBoundingClientRect();
    const scrollY = window.scrollY || window.pageYOffset;
    this.sectionTop = containerRect.top + scrollY;
    const stageHeight = this.stageEl.offsetHeight || window.innerHeight;
    this.scrollableLength = Math.max(1, this.containerEl.offsetHeight - stageHeight);
  }

  private startLoop(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTime = performance.now();
    this.fpsLastTime = this.lastTime;
    this.lastDrawnTime = this.lastTime;
    this.rafId = requestAnimationFrame(this.tick);
  }

  private stopLoop(): void {
    this.isRunning = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private readScroll(): void {
    const scrollY = window.scrollY || window.pageYOffset;
    const rawProgress = (scrollY - this.sectionTop) / this.scrollableLength;
    this.progress = Math.max(0, Math.min(1, rawProgress));
    this.target = this.progress * (this.count - 1);
  }

  private tick = (timestamp: number): void => {
    if (!this.isRunning) return;

    // Check if loop should sleep when invisible or completely outside viewport
    if (!this.isVisible || !this.isInViewport) {
      this.rafId = requestAnimationFrame(this.tick);
      return;
    }

    const dt = this.lastTime > 0 ? Math.max(1, Math.min(64, timestamp - this.lastTime)) : 16.6;
    this.lastTime = timestamp;

    // 1. Read scroll every single tick
    this.readScroll();

    // 2. Reduced motion check: instantaneous snap with zero smoothing
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      this.current = this.target;
    } else {
      // Butter-smooth responsive momentum easing:
      // Tracks the mouse pad directly with silky organic weight, zero overshoot, zero rubber-banding
      const k = 14;
      const factor = Math.min(1, 1 - Math.exp(-dt * 0.001 * k));
      this.current += (this.target - this.current) * factor;

      // Settle cleanly
      if (Math.abs(this.target - this.current) < 0.01) {
        this.current = this.target;
      }
    }

    // 3. Inform frame loader of current scrub position
    frameLoader.updateScrollPosition(this.current, window.scrollY);

    // 4. Render to canvas
    canvasRenderer.renderFrame(this.current);
    this.lastDrawnTime = timestamp;

    // 5. Update chapter local CSS progress variables
    this.updateChapterDOM();

    // 6. Update dynamic root lighting from tone.json (10 Hz throttle)
    toneEngine.updateToneForFrame(Math.round(this.current), timestamp);

    // 7. Adaptive quality performance measurement
    tierManager.recordTick(timestamp);

    // 8. Measure FPS and update HUD subscribers
    this.frameCount++;
    if (timestamp - this.fpsLastTime >= 500) {
      this.measuredFps = Math.round((this.frameCount * 1000) / (timestamp - this.fpsLastTime));
      this.frameCount = 0;
      this.fpsLastTime = timestamp;

      if (this.hudSubscribers.length > 0) {
        const hudData: ScrollHudData = {
          progress: Number(this.progress.toFixed(4)),
          target: Number(this.target.toFixed(1)),
          current: Number(this.current.toFixed(1)),
          drawnIndex: canvasRenderer.getLastDrawnIndex(),
          readyFrames: frameLoader.getDecodedCount(),
          decodedMB: frameLoader.getMemoryUsageMB(),
          tier: this.tier.name,
          fps: this.measuredFps,
        };
        this.hudSubscribers.forEach(cb => cb(hudData));
      }
    }

    this.rafId = requestAnimationFrame(this.tick);
  };

  /**
   * Derive local chapter progress `--p` (0 to 1) for each chapter.
   * Section 5.8: Enter 0..15%, hold, exit 85..100%.
   */
  private updateChapterDOM(): void {
    const manifest = frameLoader.getManifest();
    if (!manifest) return;

    const clips = manifest.clips;
    const totalCount = manifest.count;

    for (let i = 0; i < clips.length; i++) {
      const clip = clips[i];
      const el = this.chapterElements.get(clip.id);
      if (!el) continue;

      const clipStartProgress = clip.startIndex / (totalCount - 1);
      const clipEndProgress = clip.endIndex / (totalCount - 1);
      const span = clipEndProgress - clipStartProgress || 1;

      // Local progress within this clip window: 0 to 1
      const localP = (this.progress - clipStartProgress) / span;

      // Only write styles to active chapter and immediate neighbors to avoid overhead
      if (localP >= -0.2 && localP <= 1.2) {
        const pClamped = Math.max(0, Math.min(1, localP));
        el.style.setProperty('--p', pClamped.toFixed(4));

        let opacity = 0;
        let translateY = 20;

        // C01 starts visible; C12 never exits
        const isFirst = i === 0;
        const isLast = i === clips.length - 1;

        if (isFirst) {
          if (localP <= 0.85) {
            opacity = 1;
            translateY = 0;
          } else {
            // Exit: 0.85 -> 1.0
            const exitP = (localP - 0.85) / 0.15;
            opacity = Math.max(0, 1 - exitP);
            translateY = -20 * exitP;
          }
        } else if (isLast) {
          if (localP >= 0.15) {
            opacity = 1;
            translateY = 0;
          } else {
            // Enter: 0 -> 0.15
            const enterP = Math.max(0, localP / 0.15);
            opacity = enterP;
            translateY = 20 * (1 - enterP);
          }
        } else {
          // Standard chapter: enter 0..0.15, hold, exit 0.85..1.0
          if (localP < 0) {
            opacity = 0;
            translateY = 20;
          } else if (localP <= 0.15) {
            const enterP = localP / 0.15;
            opacity = enterP;
            translateY = 20 * (1 - enterP);
          } else if (localP <= 0.85) {
            opacity = 1;
            translateY = 0;
          } else if (localP <= 1.0) {
            const exitP = (localP - 0.85) / 0.15;
            opacity = 1 - exitP;
            translateY = -20 * exitP;
          } else {
            opacity = 0;
            translateY = -20;
          }
        }

        el.style.setProperty('--chapter-opacity', opacity.toFixed(3));
        el.style.setProperty('--chapter-y', `${translateY.toFixed(1)}px`);
        if (opacity > 0.05) {
          el.classList.add('is-active');
        } else {
          el.classList.remove('is-active');
        }
      } else {
        el.style.setProperty('--chapter-opacity', '0');
        el.classList.remove('is-active');
      }
    }
  }

  public scrollToChapter(id: string): void {
    const manifest = frameLoader.getManifest();
    if (!manifest) return;
    const clip = manifest.clips.find(c => c.id === id);
    if (!clip) return;

    const targetProgress = clip.startIndex / (this.count - 1);
    const targetScrollY = this.sectionTop + targetProgress * this.scrollableLength;

    window.scrollTo({
      top: targetScrollY,
      behavior: this.tier.lenis ? 'smooth' : 'auto',
    });
  }

  public scrollToTop(): void {
    window.scrollTo({
      top: 0,
      behavior: this.tier.lenis ? 'smooth' : 'auto',
    });
  }
}

export const scrollEngine = new ScrollEngine();
