# Aurelia House — Private Luxury Mountain Estate

A single-page, scroll-driven cinematic website presentation for Aurelia House. Powered by an HTML5 hardware-accelerated canvas engine, optimized WebP frame sequences, sliding memory budget windows, dynamic tone lighting, and adaptive performance tiers.

---

## 1. Setup & Running Locally

Ensure Node.js 20+ is installed:

```bash
# 1. Install dependencies
npm install

# 2. Run local development server
npm run dev

# Open in browser:
# http://localhost:3000
```

---

## 2. Asset Pipeline Scripts

The asset processing pipeline transforms the 12 drone camera clips into web-optimized responsive frame sequences:

```bash
# Phase A: Analyze the 12 clips and compute seam transitions (read-only)
npm run assets:analyze

# Phase B: Extract the native 1080p master frame sequence (1,441 frames) to external work directory
npm run assets:extract

# Phase C: Optimize master frames into 720p, 1080p, thumbs, tone.json, and manifest.json
npm run assets:optimize

# Run all asset tasks in sequential order
npm run assets:all
```

---

## 3. Storage Architecture & Master Frames Location

To prevent OneDrive sync flooding, large master PNG frames are isolated outside the workspace:
- **Master Frames Directory**: `C:\aurelia-work\frames-4k\` (1,441 frames, 2.11 GB total).
- **Web Optimized Directory**: `public/frames/` (1080p: 146 MB, 720p: 82 MB, thumbs: 0.99 MB).

The website **never** loads or serves master PNGs. All client scrubbing operates on lightweight WebP sets.

---

## 4. Performance Tiers & Overrides

The website adapts its quality, memory budget, canvas resolution, and effects according to client hardware capabilities:

| Feature | Lite (<= 4GB RAM) | Balanced (8GB RAM) | Full (8GB+ RAM, >= 8 cores) |
|---|---|---|---|
| **Frame Set** | 720p (1280x720) | 1080p (1920x1080) | 1080p (1920x1080) |
| **Decoded Memory Budget** | 96 MB (~26 frames) | 160 MB (~19 frames) | 256 MB (~30 frames) |
| **Canvas DPR Cap** | 1.0 (max 1280x720) | 1.5 (max 1920x1080) | 2.0 (max 1920x1080) |
| **Concurrent Fetches** | 3 | 4 | 6 |
| **Smoothing Constant $k$** | 10 | 8 | 7 |
| **Text Blur Filter** | Off | 4px | 10px |
| **Navbar Backdrop Blur** | Off | 12px | 18px |
| **Smooth Lenis Scroll** | Off (native) | On | On |
| **Custom Magnetic Cursor** | Off | On | On |

### URL Overrides:
- **Debug HUD**: Append `?debug=1` to the URL to show live engine telemetry (FPS, progress, memory, cache size, drawn index).
- **Manual Tier Override**: Force a specific tier via `?tier=lite`, `?tier=balanced`, or `?tier=full`.

---

## 5. Verification Commands

```bash
# Type check strict TypeScript
npm run typecheck

# Lint codebase
npm run lint

# Production build bundle
npm run build
```

---

## 6. Open Items (`[[TBD]]`)

1. **Concierge & Booking CRM Destination**:
   - `src/app/api/enquiry/route.ts` contains a 501 Not Implemented stub validating payload integrity.
   - `[[TBD: Connect to estate private concierge CRM or webhook endpoint]]`.
2. **Custom Typography Licenses**:
   - Google Fonts (Playfair Display and Inter) are configured in `src/config/fonts.ts`.
   - `[[TBD: When Canela or PP Editorial font licenses are acquired, replace definitions in fonts.ts]]`.
3. **Estate Contact Details & Pricing**:
   - Per specification, no fictitious contact numbers or booking rates were fabricated.
