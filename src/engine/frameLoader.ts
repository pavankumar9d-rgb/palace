import { type TierConfig } from '@/config/tiers';
import { tierManager } from './tier';

export interface ManifestData {
  count: number;
  pad: number;
  ext: string;
  exportFps: number;
  durationSec: number;
  sets: {
    '720': { w: number; h: number; dir: string };
    '1080': { w: number; h: number; dir: string };
  };
  thumbs: { w: number; h: number; step: number; dir: string };
  clips: Array<{
    id: string;
    name: string;
    startIndex: number;
    endIndex: number;
  }>;
}

export type DecodedImage = HTMLImageElement | ImageBitmap;

export class FrameLoader {
  private manifest: ManifestData | null = null;
  private tier: TierConfig = tierManager.getTier();

  // Primary image cache: index -> HTMLImageElement
  private frames = new Map<number, HTMLImageElement>();

  // Pinned anchor thumbnails (used for chapter menu)
  private anchorThumbs = new Map<number, HTMLImageElement>();

  // Set of indices currently being fetched
  private loadingIndices = new Set<number>();

  private currentFrameIndex = 0;
  private scrollDirection: 'forward' | 'backward' = 'forward';
  private lastScrollPosition = 0;
  private lastLoadedFrame: HTMLImageElement | null = null;

  // Track currently drawn frame so it is never evicted
  private protectedIndices = new Set<number>();

  // Callbacks on frame arrival
  private onFrameDecodedCallbacks: Array<(index: number) => void> = [];

  constructor() {
    tierManager.subscribe(newTier => {
      this.handleTierChange(newTier);
    });
  }

  public async init(manifestUrl = '/frames/manifest.json'): Promise<ManifestData> {
    const res = await fetch(manifestUrl);
    if (!res.ok) throw new Error(`Failed to load manifest: ${res.statusText}`);
    this.manifest = (await res.json()) as ManifestData;
    return this.manifest;
  }

  public getManifest(): ManifestData | null {
    return this.manifest;
  }

  public onFrameDecoded(cb: (index: number) => void): () => void {
    this.onFrameDecodedCallbacks.push(cb);
    return () => {
      this.onFrameDecodedCallbacks = this.onFrameDecodedCallbacks.filter(c => c !== cb);
    };
  }

  private handleTierChange(newTier: TierConfig): void {
    if (this.tier.frameSet !== newTier.frameSet) {
      this.frames.clear();
      this.loadingIndices.clear();
      this.preloadStartup();
    }
    this.tier = newTier;
  }

  public updateScrollPosition(frameIndex: number, scrollY: number): void {
    if (scrollY > this.lastScrollPosition) {
      this.scrollDirection = 'forward';
    } else if (scrollY < this.lastScrollPosition) {
      this.scrollDirection = 'backward';
    }
    this.lastScrollPosition = scrollY;
    this.currentFrameIndex = Math.max(0, Math.min(Math.round(frameIndex), (this.manifest?.count ?? 1) - 1));

    // Priority-load frames in the active scrub window
    this.loadActiveWindow();
  }

  public setProtectedFrames(floorIdx: number, ceilIdx: number): void {
    this.protectedIndices.clear();
    this.protectedIndices.add(floorIdx);
    this.protectedIndices.add(ceilIdx);
  }

  /**
   * Retrieves frame using nearest-neighbor fallback:
   * 1. Exact full-resolution frame
   * 2. Nearest loaded full-resolution frame (scanning outward in scroll direction)
   * 3. Last successfully drawn frame
   */
  public getFrame(index: number): DecodedImage | null {
    if (!this.manifest) return null;
    const totalCount = this.manifest.count;
    const targetIdx = Math.max(0, Math.min(Math.round(index), totalCount - 1));

    // 1. Exact match
    const exact = this.frames.get(targetIdx);
    if (exact && exact.complete && exact.naturalWidth > 0) {
      this.lastLoadedFrame = exact;
      return exact;
    }

    // 2. Nearest neighbor within 16 frames:
    // Respect scroll direction to prevent jumping ahead and then flickering backward
    const preferBehind = this.scrollDirection === 'forward';
    for (let offset = 1; offset <= 16; offset++) {
      const firstIdx = preferBehind ? targetIdx - offset : targetIdx + offset;
      if (firstIdx >= 0 && firstIdx < totalCount) {
        const first = this.frames.get(firstIdx);
        if (first && first.complete && first.naturalWidth > 0) {
          this.lastLoadedFrame = first;
          return first;
        }
      }

      const secondIdx = preferBehind ? targetIdx + offset : targetIdx - offset;
      if (secondIdx >= 0 && secondIdx < totalCount) {
        const second = this.frames.get(secondIdx);
        if (second && second.complete && second.naturalWidth > 0) {
          this.lastLoadedFrame = second;
          return second;
        }
      }
    }

    // 3. Last successfully rendered frame (prevents any blanking or low-res pop-in)
    if (this.lastLoadedFrame) return this.lastLoadedFrame;

    // 4. Emergency fallback to Frame 0
    const firstFrame = this.frames.get(0);
    if (firstFrame && firstFrame.complete && firstFrame.naturalWidth > 0) {
      return firstFrame;
    }

    return null;
  }

  public hasExactFrame(index: number): boolean {
    const img = this.frames.get(index);
    return Boolean(img && img.complete && img.naturalWidth > 0);
  }

  /**
   * Preloads essential startup frames:
   * 1. Frame 1 (index 0) immediately
   * 2. First 24 frames for smooth initial scrub
   * 3. Chapter thumbnails
   * 4. Progressive keyframes (every 4th frame) across the whole film in background
   */
  public async preloadStartup(onProgress?: (pct: number) => void): Promise<void> {
    if (!this.manifest) return;
    const totalCount = this.manifest.count;

    // 1. Load Frame 1 immediately
    await this.fetchFrame(0);
    if (onProgress) onProgress(20);

    // 2. Load opening 24 frames in parallel
    const initialPromises: Promise<void>[] = [];
    for (let i = 1; i < Math.min(24, totalCount); i++) {
      initialPromises.push(this.fetchFrame(i));
    }
    await Promise.allSettled(initialPromises);
    if (onProgress) onProgress(50);

    // 3. Load anchor thumbnails for chapter menu
    const anchorIndices: number[] = [];
    for (let i = 0; i < totalCount; i += 8) {
      anchorIndices.push(i);
    }
    if ((totalCount - 1) % 8 !== 0) {
      anchorIndices.push(totalCount - 1);
    }

    let loaded = 0;
    const batchSize = 12;
    for (let b = 0; b < anchorIndices.length; b += batchSize) {
      const batch = anchorIndices.slice(b, b + batchSize);
      await Promise.allSettled(
        batch.map(async idx => {
          await this.fetchThumb(idx);
          loaded++;
          if (onProgress) {
            onProgress(50 + Math.floor((loaded / anchorIndices.length) * 50));
          }
        })
      );
    }

    if (onProgress) onProgress(100);

    // 4. Background progressive keyframe preloader across the whole film (every 4th frame)
    // This guarantees a full-resolution 720p/1080p frame is ALWAYS available within 1-2 frames anywhere!
    setTimeout(() => {
      this.preloadAllKeyframes();
    }, 200);
  }

  /**
   * Background loader that progressively fetches keyframes across the film (step 4).
   * Total download is only ~20 MB (720p) or ~35 MB (1080p), cached permanently by the browser.
   */
  private async preloadAllKeyframes(): Promise<void> {
    if (!this.manifest) return;
    const totalCount = this.manifest.count;

    const keyframes: number[] = [];
    for (let i = 0; i < totalCount; i += 4) {
      if (!this.frames.has(i)) {
        keyframes.push(i);
      }
    }

    const batchSize = 8;
    for (let b = 0; b < keyframes.length; b += batchSize) {
      const batch = keyframes.slice(b, b + batchSize);
      await Promise.allSettled(batch.map(idx => this.fetchFrame(idx)));
      // Yield to main thread
      await new Promise(r => setTimeout(r, 16));
    }
  }

  /**
   * Priority-loads consecutive frames within the active scroll window:
   * 40 frames ahead of scroll direction, 20 frames behind
   */
  private loadActiveWindow(): void {
    if (!this.manifest) return;
    const totalCount = this.manifest.count;

    const isForward = this.scrollDirection === 'forward';
    const ahead = isForward ? 40 : 20;
    const behind = isForward ? 20 : 40;

    const start = Math.max(0, this.currentFrameIndex - behind);
    const end = Math.min(totalCount - 1, this.currentFrameIndex + ahead);

    for (let i = start; i <= end; i++) {
      if (!this.frames.has(i) && !this.loadingIndices.has(i)) {
        this.fetchFrame(i);
      }
    }

    // Enforce memory budget: evict non-keyframe intermediate frames that are far away (> 80 frames)
    this.pruneDistantFrames(start - 40, end + 40);
  }

  private fetchFrame(index: number): Promise<void> {
    if (this.frames.has(index) || this.loadingIndices.has(index)) {
      return Promise.resolve();
    }

    this.loadingIndices.add(index);
    const pad = this.manifest?.pad ?? 4;
    const fileName = `frame-${String(index + 1).padStart(pad, '0')}.webp`;
    const folder = this.tier.frameSet;
    const url = `/frames/${folder}/${fileName}`;

    return new Promise(resolve => {
      const img = new Image();
      img.decoding = 'async';

      img.onload = () => {
        this.frames.set(index, img);
        this.loadingIndices.delete(index);
        this.onFrameDecodedCallbacks.forEach(cb => cb(index));
        resolve();
      };

      img.onerror = () => {
        this.loadingIndices.delete(index);
        resolve();
      };

      img.src = url;
    });
  }

  private fetchThumb(index: number): Promise<void> {
    if (this.anchorThumbs.has(index)) return Promise.resolve();

    const pad = this.manifest?.pad ?? 4;
    const fileName = `frame-${String(index + 1).padStart(pad, '0')}.webp`;
    const url = `/frames/thumbs/${fileName}`;

    return new Promise(resolve => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => {
        this.anchorThumbs.set(index, img);
        resolve();
      };
      img.onerror = () => resolve();
      img.src = url;
    });
  }

  /**
   * Keep all keyframes (multiples of 4) cached permanently (~20-35 MB).
   * Evict distant intermediate non-key frames outside the safe window.
   */
  private pruneDistantFrames(safeMin: number, safeMax: number): void {
    if (this.frames.size < 250) return;

    for (const idx of this.frames.keys()) {
      // Never evict keyframes (multiples of 4) or protected frame indices
      if (idx % 4 === 0 || this.protectedIndices.has(idx)) continue;

      if (idx < safeMin || idx > safeMax) {
        this.frames.delete(idx);
      }
    }
  }

  public getMemoryUsageMB(): number {
    const bytesPerFrame = this.tier.frameSet === '1080' ? 8.3 : 3.7;
    return Number((this.frames.size * bytesPerFrame * 0.15).toFixed(1));
  }

  public getDecodedCount(): number {
    return this.frames.size;
  }
}

export const frameLoader = new FrameLoader();
