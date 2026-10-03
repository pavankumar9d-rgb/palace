export interface ToneData {
  lum: number[];
  warm: number[];
}

export class ToneEngine {
  private toneData: ToneData | null = null;
  private lastUpdateTimestamp = 0;
  private currentLum = 128;
  private currentWarm = 128;
  private rootElement: HTMLElement | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.rootElement = document.documentElement;
      this.loadToneData();
    }
  }

  public async loadToneData(): Promise<void> {
    try {
      const res = await fetch('/frames/tone.json');
      if (res.ok) {
        this.toneData = (await res.json()) as ToneData;
      }
    } catch (err) {
      console.warn('[ToneEngine] Could not load tone.json, using neutral default lighting.', err);
    }
  }

  /**
   * Called each frame draw. Throttled to 10 Hz (every 100ms) and checks delta > 0.01.
   */
  public updateToneForFrame(frameIndex: number, now: number): void {
    if (!this.toneData || !this.rootElement) return;

    if (now - this.lastUpdateTimestamp < 100) return; // 10 Hz throttle

    const targetLum = this.toneData.lum[frameIndex] ?? 128;
    const targetWarm = this.toneData.warm[frameIndex] ?? 128;

    const deltaLum = Math.abs(targetLum - this.currentLum);
    const deltaWarm = Math.abs(targetWarm - this.currentWarm);

    if (deltaLum > 0.01 || deltaWarm > 0.01) {
      this.currentLum = targetLum;
      this.currentWarm = targetWarm;
      this.lastUpdateTimestamp = now;

      this.rootElement.style.setProperty('--ui-lum', targetLum.toFixed(2));
      this.rootElement.style.setProperty('--ui-warm', targetWarm.toFixed(2));
    }
  }

  public getCurrentValues(): { lum: number; warm: number } {
    return { lum: this.currentLum, warm: this.currentWarm };
  }
}

export const toneEngine = new ToneEngine();
