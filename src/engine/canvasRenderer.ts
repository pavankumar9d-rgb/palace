import { type TierConfig } from '@/config/tiers';
import { FILM_CONFIG } from '@/config/film';
import { frameLoader, type DecodedImage } from './frameLoader';
import { tierManager } from './tier';

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

export class CanvasRenderer {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private tier: TierConfig = tierManager.getTier();

  private cssWidth = 0;
  private cssHeight = 0;
  private backingWidth = 0;
  private backingHeight = 0;

  private lastDrawnFloor = -1;
  private lastDrawnFracQuant = -1;
  private hasEverDrawn = false;
  private lastDrawnImage: DecodedImage | null = null;

  constructor() {
    tierManager.subscribe(newTier => {
      this.tier = newTier;
      if (this.ctx) {
        this.ctx.imageSmoothingQuality = newTier.name === 'lite' ? 'medium' : 'high';
      }
      this.resize();
    });
  }

  public setCanvas(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d', {
      alpha: false,
      desynchronized: true,
    });
    if (!ctx) throw new Error('Could not acquire 2D canvas context.');
    this.ctx = ctx;
    this.ctx.imageSmoothingQuality = this.tier.name === 'lite' ? 'medium' : 'high';

    this.resize();
  }

  public resize(): void {
    if (!this.canvas || !this.ctx) return;

    const rect = this.canvas.getBoundingClientRect();
    this.cssWidth = rect.width;
    this.cssHeight = rect.height;

    if (this.cssWidth <= 0 || this.cssHeight <= 0) return;

    const dpr = Math.min(window.devicePixelRatio || 1, this.tier.dprCap);

    let targetWidth = Math.round(this.cssWidth * dpr);
    let targetHeight = Math.round(this.cssHeight * dpr);

    // Clamp backing store to tier max canvas size while preserving aspect
    if (targetWidth > this.tier.maxCanvasWidth || targetHeight > this.tier.maxCanvasHeight) {
      const scale = Math.min(
        this.tier.maxCanvasWidth / targetWidth,
        this.tier.maxCanvasHeight / targetHeight
      );
      targetWidth = Math.round(targetWidth * scale);
      targetHeight = Math.round(targetHeight * scale);
    }

    if (this.canvas.width !== targetWidth || this.canvas.height !== targetHeight) {
      this.canvas.width = targetWidth;
      this.canvas.height = targetHeight;
      this.backingWidth = targetWidth;
      this.backingHeight = targetHeight;

      // Re-apply smoothing after dimension resize
      this.ctx.imageSmoothingQuality = this.tier.name === 'lite' ? 'medium' : 'high';

      // Redraw immediately in same tick to prevent blanking
      if (this.lastDrawnFloor >= 0) {
        this.renderFrame(this.lastDrawnFloor + (this.lastDrawnFracQuant / 32), true);
      }
    }
  }

  /**
   * Renders the current frame target cleanly with zero ghosting and zero lag.
   */
  public renderFrame(currentValue: number, forceRedraw = false): boolean {
    if (!this.ctx || !this.canvas) return false;

    const targetIdx = Math.max(0, Math.round(currentValue));

    // Only draw if target integer frame changed or forced
    if (!forceRedraw && targetIdx === this.lastDrawnFloor) {
      return false;
    }

    frameLoader.setProtectedFrames(targetIdx, targetIdx);

    const frame = frameLoader.getFrame(targetIdx) ?? this.lastDrawnImage;

    if (frame) {
      this.drawSingleImage(frame);
      this.lastDrawnImage = frame;
      this.lastDrawnFloor = targetIdx;
      this.hasEverDrawn = true;
      return true;
    } else if (!this.hasEverDrawn) {
      this.ctx.fillStyle = FILM_CONFIG.colors.bg;
      this.ctx.fillRect(0, 0, this.backingWidth, this.backingHeight);
    }

    return false;
  }

  /**
   * High-DPI Cover fit drawing math with focal point and subtle cinematic overscan
   */
  private drawSingleImage(img: DecodedImage): void {
    if (!this.ctx) return;

    const cw = this.backingWidth;
    const ch = this.backingHeight;
    const iw = img.width;
    const ih = img.height;

    if (cw <= 0 || ch <= 0 || iw <= 0 || ih <= 0) return;

    // Cover scale factor: fill stage fully with subtle 1.035x cinematic overscan
    // This pushes outer-margin video watermarks safely offscreen while preserving true 16:9 framing
    const overscan = 1.035;
    const scale = Math.max(cw / iw, ch / ih) * overscan;
    const sw = iw * scale;
    const sh = ih * scale;

    const isPortrait = ch > cw;
    const fp = isPortrait ? FILM_CONFIG.portraitFocalPoint : FILM_CONFIG.focalPoint;

    // Focal point alignment
    let dx = (cw - sw) * fp.x;
    let dy = (ch - sh) * fp.y;

    // Clamp to canvas edges so no black bars leak
    dx = Math.min(0, Math.max(cw - sw, dx));
    dy = Math.min(0, Math.max(ch - sh, dy));

    // Round to whole pixels to avoid hairline seams
    this.ctx.drawImage(img, Math.round(dx), Math.round(dy), Math.round(sw), Math.round(sh));
  }

  public getLastDrawnIndex(): number {
    return this.lastDrawnFloor;
  }
}

export const canvasRenderer = new CanvasRenderer();
