import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import sharp from 'sharp';

const PROJECT_ROOT = process.cwd();
const MANIFEST_PATH = path.join(PROJECT_ROOT, 'public', 'frames', 'manifest.json');
const OUTPUT_DIR = 'C:\\Users\\saipa\\.gemini\\antigravity-ide\\brain\\18bc98f4-87bf-4007-be41-6e07c1015efc';

// Media Assets
const AUDIO_TRACK = path.join(PROJECT_ROOT, 'AudioTranscriberAI_Oh La La Amour – Julio Iglesias (1982) Romantic Classic Lyrics #lyricsvideo #julioiglesias.mp3');
const GREEN_SCREEN_1_PNG = path.join(PROJECT_ROOT, 'Cozy Green Screen Workspace.png');
const GREEN_SCREEN_2_PNG = path.join(PROJECT_ROOT, 'ChatGPT Image Oct 2, 2026, 06_05_10 PM.png');

// Video 1: 4K Showcase (No audio)
const OUTPUT_MP4 = path.join(OUTPUT_DIR, 'aurelia_showcase_16x9.mp4');
const OUTPUT_WEBP = path.join(OUTPUT_DIR, 'aurelia_showcase_16x9.webp');
const DESKTOP_MP4 = 'C:\\Users\\saipa\\OneDrive\\Desktop\\aurelia_showcase_16x9.mp4';
const LOCAL_MP4 = path.join(PROJECT_ROOT, 'aurelia_showcase_16x9.mp4');
const LOCAL_WEBP = path.join(PROJECT_ROOT, 'aurelia_showcase_16x9.webp');

// Video 2: Cozy Workspace Mockup (With Julio Iglesias soundtrack)
const MOCKUP_1_MP4 = path.join(OUTPUT_DIR, 'aurelia_cozy_workspace_mockup.mp4');
const MOCKUP_1_WEBP = path.join(OUTPUT_DIR, 'aurelia_cozy_workspace_mockup.webp');
const DESKTOP_MOCKUP_1_MP4 = 'C:\\Users\\saipa\\OneDrive\\Desktop\\aurelia_cozy_workspace_mockup.mp4';
const LOCAL_MOCKUP_1_MP4 = path.join(PROJECT_ROOT, 'aurelia_cozy_workspace_mockup.mp4');
const LOCAL_MOCKUP_1_WEBP = path.join(PROJECT_ROOT, 'aurelia_cozy_workspace_mockup.webp');

// Video 3: Studio Workspace Mockup (With Julio Iglesias soundtrack)
const MOCKUP_2_MP4 = path.join(OUTPUT_DIR, 'aurelia_studio_workspace_mockup.mp4');
const MOCKUP_2_WEBP = path.join(OUTPUT_DIR, 'aurelia_studio_workspace_mockup.webp');
const DESKTOP_MOCKUP_2_MP4 = 'C:\\Users\\saipa\\OneDrive\\Desktop\\aurelia_studio_workspace_mockup.mp4';
const LOCAL_MOCKUP_2_MP4 = path.join(PROJECT_ROOT, 'aurelia_studio_workspace_mockup.mp4');
const LOCAL_MOCKUP_2_WEBP = path.join(PROJECT_ROOT, 'aurelia_studio_workspace_mockup.webp');

sharp.concurrency(8);
sharp.cache(false);

const CHAPTER_METRICS = {
  C01: 'ELEVATION: 2,450M • ORIENTATION: SOUTH-WEST • ARRIVAL PORTAL',
  C02: 'BRONZE FACADE • MORNING SUNRISE • TRAVERTINE THRESHOLD',
  C03: 'GALLERY HEIGHT: 8.4M • WATER MIRROR • ARCHITECTURAL CORE',
  C04: 'FLOATING MONOLITH • OAK RUNNERS • UNHURRIED VERTICAL ASCENT',
  C05: 'MASTER SANCTUARY • 360° GLASS PANORAMA • LINEN &amp; TIMBER',
  C06: 'CANTILEVER TERRACE • VALLEY OVERLOOK • PRIVATE RIDGELINE',
  C07: 'INFINITY HORIZON • THERMAL WATERS • ABOVE THE CLOUD INVERSION',
  C08: 'GRAND BANQUET • CELLAR VAULT • QUIET SCULPTURAL ARCHES',
  C09: 'MEDITATION POOL • JAPANESE CEDAR • REFLECTING GROVE',
  C10: 'WELLNESS ATELIER • STEAM CAVE • MOUNTAIN WATERFALLS',
  C11: 'GOLDEN HOUR PROMENADE • DANCING FOUNTAINS • GEOMETRIC LAWN',
  C12: 'EVENING ILLUMINATION • ASTRONOMICAL DECK • PRIVATE ESTATE APEX',
};

function escapeXml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

const CHAPTER_COPY = {
  C01: { id: 'C01', num: '01', headline: 'WELCOME TO AURELIA', subline: 'A house above the mist', align: 'center' },
  C02: { id: 'C02', num: '02', headline: 'A THRESHOLD OF LIGHT', subline: 'Bronze, oak and morning stone', align: 'left' },
  C03: { id: 'C03', num: '03', headline: 'ARCHITECTURE, BREATHING', subline: 'Travertine, still water and quiet height', align: 'right' },
  C04: { id: 'C04', num: '04', headline: 'THE ASCENT', subline: 'Every step, unhurried', align: 'left' },
  C05: { id: 'C05', num: '05', headline: 'WHERE ROYALTY SLEEPS', subline: 'Linen, oak and a horizon of glass', align: 'right' },
  C06: { id: 'C06', num: '06', headline: 'OPEN THE DOORS', subline: 'The valley, entirely yours', align: 'center' },
  C07: { id: 'C07', num: '07', headline: 'ABOVE THE CLOUDS', subline: 'Horizon dissolves into water and sky', align: 'left' },
  C08: { id: 'C08', num: '08', headline: 'A FEAST OF ART', subline: 'Stone arches and quiet candlelight', align: 'right' },
  C09: { id: 'C09', num: '09', headline: 'THE STILL WATER', subline: 'Stone underfoot, nothing ahead but calm', align: 'left' },
  C10: { id: 'C10', num: '10', headline: 'SILENCE, PERFECTED', subline: 'Waterfalls, steam and meditation gardens', align: 'right' },
  C11: { id: 'C11', num: '11', headline: 'EVERY SUNSET IS PRIVATE', subline: 'Golden hour, symmetry and dancing fountains', align: 'center' },
  C12: { id: 'C12', num: '12', headline: 'AN UNFORGETTABLE DESTINATION', subline: 'A beacon above the night valley', align: 'center' },
};

function getChapterState(frameIdx, totalFrames, clips) {
  const progress = frameIdx / (totalFrames - 1);
  let activeChapter = CHAPTER_COPY.C01;
  let activeMetric = CHAPTER_METRICS.C01;
  let chapterOpacity = 1;

  for (let c = 0; c < clips.length; c++) {
    const clip = clips[c];
    if (frameIdx >= clip.startIndex && frameIdx <= clip.endIndex) {
      activeChapter = CHAPTER_COPY[clip.id] || CHAPTER_COPY.C01;
      activeMetric = CHAPTER_METRICS[clip.id] || CHAPTER_METRICS.C01;
      const span = clip.endIndex - clip.startIndex || 1;
      const localP = (frameIdx - clip.startIndex) / span;

      if (c === 0) {
        chapterOpacity = localP <= 0.85 ? 1 : Math.max(0, (1 - localP) / 0.15);
      } else if (c === clips.length - 1) {
        chapterOpacity = localP >= 0.15 ? 1 : localP / 0.15;
      } else {
        if (localP <= 0.15) chapterOpacity = localP / 0.15;
        else if (localP <= 0.85) chapterOpacity = 1;
        else chapterOpacity = (1 - localP) / 0.15;
      }
      break;
    }
  }

  return { activeChapter, activeMetric, chapterOpacity, progress };
}

function buildSvgOverlay(activeChapter, activeMetric, chapterOpacity, progress, isConclusion) {
  const pct = Math.round(progress * 100);

  return `
  <svg width="1920" height="1080" viewBox="0 0 1920 1080" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="vignette" cx="50%" cy="50%" r="50%">
        <stop offset="40%" stop-color="#0A0703" stop-opacity="0" />
        <stop offset="75%" stop-color="#0A0703" stop-opacity="0.32" />
        <stop offset="100%" stop-color="#0A0703" stop-opacity="0.55" />
      </radialGradient>
      <linearGradient id="edgeTop" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#0A0703" stop-opacity="0.85" />
        <stop offset="100%" stop-color="#0A0703" stop-opacity="0" />
      </linearGradient>
      <linearGradient id="edgeBottom" x1="0" y1="1" x2="0" y2="0">
        <stop offset="0%" stop-color="#0A0703" stop-opacity="0.85" />
        <stop offset="100%" stop-color="#0A0703" stop-opacity="0" />
      </linearGradient>
      <radialGradient id="cornerShade" cx="100%" cy="100%" r="100%">
        <stop offset="15%" stop-color="#0A0703" stop-opacity="0.95" />
        <stop offset="45%" stop-color="#0A0703" stop-opacity="0.75" />
        <stop offset="85%" stop-color="#0A0703" stop-opacity="0" />
      </radialGradient>
    </defs>

    <!-- Vignettes & Framing -->
    <rect width="1920" height="1080" fill="url(#vignette)" />
    <rect x="0" y="0" width="1920" height="130" fill="url(#edgeTop)" />
    <rect x="0" y="950" width="1920" height="130" fill="url(#edgeBottom)" />
    <!-- Watermark Concealer -->
    <rect x="1450" y="840" width="470" height="240" fill="url(#cornerShade)" />

    <!-- Top Navbar -->
    <g opacity="0.95">
      <text x="60" y="48" font-family="serif" font-size="16" letter-spacing="6" fill="#F9F8F5" font-weight="600">A U R E L I A   H O U S E</text>
      <circle cx="280" cy="42" r="3" fill="#D4AF37" />
      <text x="296" y="46" font-family="sans-serif" font-size="11" letter-spacing="3" fill="#D4AF37" opacity="0.9">SANCTUARY</text>
      <text x="440" y="46" font-family="monospace" font-size="11" letter-spacing="2" fill="#EFE7DA" opacity="0.6">${activeChapter.num} / 12</text>

      <text x="1560" y="46" font-family="sans-serif" font-size="11" letter-spacing="3" fill="#EFE7DA" opacity="0.85">CHAPTERS</text>
      <rect x="1680" y="24" width="180" height="38" rx="2" fill="#D4AF37" />
      <text x="1770" y="48" font-family="sans-serif" font-size="11" letter-spacing="2" fill="#0A0703" font-weight="700" text-anchor="middle">PRIVATE VIEWING</text>
    </g>

    <!-- Right-Hand Progress Rail -->
    <g opacity="0.92">
      ${Array.from({ length: 12 }).map((_, idx) => {
        const y = 330 + idx * 34;
        const isCurr = activeChapter.num === String(idx + 1).padStart(2, '0');
        return `
          <line x1="1870" y1="${y}" x2="${isCurr ? 1852 : 1865}" y2="${y}" stroke="${isCurr ? '#D4AF37' : '#F9F8F5'}" stroke-width="${isCurr ? 2.5 : 1}" opacity="${isCurr ? 1 : 0.25}" />
          ${isCurr ? `<text x="1844" y="${y + 4}" font-family="monospace" font-size="10" fill="#D4AF37" text-anchor="end" font-weight="bold">${activeChapter.num}</text>` : ''}
        `;
      }).join('')}
      <text x="1875" y="760" font-family="monospace" font-size="12" fill="#EFE7DA" opacity="0.8" text-anchor="end">${pct}%</text>
    </g>

    <!-- Bottom Left Monogram & Architecture Metrics -->
    <g transform="translate(60, 985)">
      <circle cx="20" cy="20" r="18" fill="#120D05" stroke="#D4AF37" stroke-width="1" opacity="0.7" />
      <text x="20" y="25" font-family="serif" font-size="12" fill="#D4AF37" text-anchor="middle" font-weight="bold">AH</text>
      <text x="56" y="24" font-family="monospace" font-size="10" letter-spacing="2" fill="#EFE7DA" opacity="0.6">${escapeXml(activeMetric)}</text>
    </g>

    <!-- Editorial Chapter Card -->
    ${!isConclusion && chapterOpacity > 0.05 ? `
    <g opacity="${chapterOpacity.toFixed(2)}">
      <text x="${activeChapter.align === 'center' ? 960 : activeChapter.align === 'left' ? 120 : 1800}" y="660" 
            font-family="sans-serif" font-size="11" letter-spacing="4" fill="#D4AF37" 
            text-anchor="${activeChapter.align === 'center' ? 'middle' : activeChapter.align === 'left' ? 'start' : 'end'}">
        CHAPTER ${activeChapter.num} —— ${activeChapter.id}
      </text>

      <text x="${activeChapter.align === 'center' ? 960 : activeChapter.align === 'left' ? 120 : 1800}" y="730" 
            font-family="serif" font-size="52" letter-spacing="6" fill="#F9F8F5" font-weight="400"
            text-anchor="${activeChapter.align === 'center' ? 'middle' : activeChapter.align === 'left' ? 'start' : 'end'}">
        ${escapeXml(activeChapter.headline)}
      </text>

      <text x="${activeChapter.align === 'center' ? 960 : activeChapter.align === 'left' ? 120 : 1800}" y="775" 
            font-family="sans-serif" font-size="16" letter-spacing="2" fill="#EFE7DA" opacity="0.75"
            text-anchor="${activeChapter.align === 'center' ? 'middle' : activeChapter.align === 'left' ? 'start' : 'end'}">
        ${escapeXml(activeChapter.subline)}
      </text>
    </g>
    ` : ''}

    <!-- Conclusion Phase Overlay -->
    ${isConclusion ? `
    <g opacity="0.96">
      <rect x="0" y="0" width="1920" height="1080" fill="#0A0703" opacity="0.82" />
      <text x="960" y="430" font-family="sans-serif" font-size="12" letter-spacing="5" fill="#D4AF37" text-anchor="middle">CONCLUSION OF VIEWING</text>
      <text x="960" y="505" font-family="serif" font-size="64" letter-spacing="10" fill="#F9F8F5" text-anchor="middle">AURELIA HOUSE</text>
      <text x="960" y="555" font-family="sans-serif" font-size="16" letter-spacing="3" fill="#EFE7DA" opacity="0.75" text-anchor="middle">A beacon above the night valley.</text>
      
      <rect x="850" y="605" width="220" height="46" fill="none" stroke="#D4AF37" stroke-width="1" opacity="0.8" />
      <text x="960" y="633" font-family="sans-serif" font-size="12" letter-spacing="3" fill="#D4AF37" text-anchor="middle">↑ BACK TO THE BEGINNING</text>
    </g>
    ` : ''}
  </svg>
  `;
}

async function renderFrame(frameIdx, totalFrames, clips, isConclusion = false) {
  const padStr = String(frameIdx + 1).padStart(4, '0');
  const framePath = path.join(PROJECT_ROOT, 'public', 'frames', '1080', `frame-${padStr}.webp`);

  const { activeChapter, activeMetric, chapterOpacity, progress } = getChapterState(frameIdx, totalFrames, clips);
  const svg = buildSvgOverlay(activeChapter, activeMetric, chapterOpacity, progress, isConclusion);

  return sharp(framePath)
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .raw()
    .toBuffer();
}

async function main() {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  const totalFrames = manifest.count; // 1441
  const clips = manifest.clips;

  const FPS = 24;
  const HOLD_START_SEC = 1.0;   // 24 frames
  const FWD_SEC = 11.5;          // 276 frames (matched to reverse speed)
  const HOLD_CONCL_SEC = 1.0;   // 24 frames
  const REV_SEC = 11.5;          // 276 frames
  const HOLD_END_SEC = 1.0;     // 24 frames
  const totalDurationSec = HOLD_START_SEC + FWD_SEC + HOLD_CONCL_SEC + REV_SEC + HOLD_END_SEC; // 26.0s

  console.log(`=======================================================`);
  console.log(`[1/3] Rendering Video 1: 4K UHD 16:9 Showcase Recording`);
  console.log(`Duration: ${totalDurationSec}s total (Forward: ${FWD_SEC}s, Reverse: ${REV_SEC}s)`);
  console.log(`Resolution: 3840x2160 (4K UHD) at ${FPS} fps (Silent / No Audio)`);
  console.log(`=======================================================`);

  const ffmpeg = spawn(
    'ffmpeg',
    [
      '-y',
      '-f', 'rawvideo',
      '-pix_fmt', 'rgba',
      '-s', '1920x1080',
      '-r', String(FPS),
      '-i', '-',
      '-vf', 'scale=3840:2160:flags=bicubic,unsharp=5:5:0.5:5:5:0.0',
      '-c:v', 'libx264',
      '-pix_fmt', 'yuv420p',
      '-preset', 'veryfast',
      '-crf', '17',
      OUTPUT_MP4,
    ],
    { stdio: ['pipe', 'inherit', 'inherit'] }
  );

  ffmpeg.on('error', err => {
    console.error('FFmpeg error:', err);
  });

  const writeRawBuffer = (buf) => {
    return new Promise(resolve => {
      if (!ffmpeg.stdin.write(buf)) {
        ffmpeg.stdin.once('drain', resolve);
      } else {
        process.nextTick(resolve);
      }
    });
  };

  const startTime = Date.now();
  const BATCH_SIZE = 10;

  // 1. Initial Opening Hold at Chapter 01 (1.0s = 24 ticks)
  console.log(`Rendering Opening Hold (${HOLD_START_SEC}s)...`);
  const firstFrameBuf = await renderFrame(0, totalFrames, clips, false);
  const startTicks = Math.round(HOLD_START_SEC * FPS);
  for (let k = 0; k < startTicks; k++) {
    await writeRawBuffer(firstFrameBuf);
  }

  // 2. Forward Walkthrough (11.5s = 276 ticks)
  console.log(`Rendering Forward Walkthrough (${FWD_SEC}s, 276 frames)...`);
  const fwdTicks = Math.round(FWD_SEC * FPS);
  const fwdFrameIndices = [];
  for (let i = 0; i < fwdTicks; i++) {
    const t = i / (fwdTicks - 1);
    const eased = t * t * (3 - 2 * t);
    const frameIdx = Math.max(0, Math.min(totalFrames - 1, Math.round(eased * (totalFrames - 1))));
    fwdFrameIndices.push(frameIdx);
  }

  for (let i = 0; i < fwdFrameIndices.length; i += BATCH_SIZE) {
    const slice = fwdFrameIndices.slice(i, i + BATCH_SIZE);
    const batchBuffers = await Promise.all(slice.map(idx => renderFrame(idx, totalFrames, clips, false)));
    for (const buf of batchBuffers) {
      await writeRawBuffer(buf);
    }
    if (i % 60 === 0 || i + BATCH_SIZE >= fwdFrameIndices.length) {
      const pct = Math.round(((i + slice.length) / fwdFrameIndices.length) * 100);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`Forward progress: ${pct}% (${i + slice.length}/${fwdFrameIndices.length} frames, ${elapsed}s elapsed)`);
    }
  }

  // 3. Conclusion Hold at Chapter 12 / Private Viewing (1.0s = 24 ticks)
  console.log(`Rendering Conclusion Screen Hold (${HOLD_CONCL_SEC}s)...`);
  const lastFrameBuf = await renderFrame(totalFrames - 1, totalFrames, clips, true);
  const conclTicks = Math.round(HOLD_CONCL_SEC * FPS);
  for (let k = 0; k < conclTicks; k++) {
    await writeRawBuffer(lastFrameBuf);
  }

  // 4. Reverse Rewind at matched speed (11.5s = 276 ticks)
  console.log(`Rendering Reverse Rewind (${REV_SEC}s, 276 frames)...`);
  const revTicks = Math.round(REV_SEC * FPS);
  const revFrameIndices = [];
  for (let i = 0; i < revTicks; i++) {
    const t = i / (revTicks - 1);
    const eased = t * t * (3 - 2 * t);
    const frameIdx = Math.max(0, Math.min(totalFrames - 1, Math.round((1 - eased) * (totalFrames - 1))));
    revFrameIndices.push(frameIdx);
  }

  for (let i = 0; i < revFrameIndices.length; i += BATCH_SIZE) {
    const slice = revFrameIndices.slice(i, i + BATCH_SIZE);
    const batchBuffers = await Promise.all(slice.map(idx => renderFrame(idx, totalFrames, clips, false)));
    for (const buf of batchBuffers) {
      await writeRawBuffer(buf);
    }
    if (i % 60 === 0 || i + BATCH_SIZE >= revFrameIndices.length) {
      const revPct = Math.round(((i + slice.length) / revFrameIndices.length) * 100);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`Reverse progress: ${revPct}% (${i + slice.length}/${revFrameIndices.length} frames, ${elapsed}s elapsed)`);
    }
  }

  // 5. Final Settle on Chapter 01 (1.0s = 24 ticks)
  console.log(`Rendering Final Settle (${HOLD_END_SEC}s)...`);
  const endTicks = Math.round(HOLD_END_SEC * FPS);
  for (let k = 0; k < endTicks; k++) {
    await writeRawBuffer(firstFrameBuf);
  }

  ffmpeg.stdin.end();

  await new Promise((resolve, reject) => {
    ffmpeg.on('close', code => {
      if (code === 0) resolve();
      else reject(new Error(`FFmpeg exited with code ${code}`));
    });
  });

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\nVideo 1 (4K Showcase) rendered in ${totalTime}s: ${OUTPUT_MP4}`);

  // Copy Video 1 to Desktop and Project Root
  fs.copyFileSync(OUTPUT_MP4, DESKTOP_MP4);
  fs.copyFileSync(OUTPUT_MP4, LOCAL_MP4);
  console.log(`Copied Video 1 to Desktop: ${DESKTOP_MP4}`);
  console.log(`Copied Video 1 to Workspace: ${LOCAL_MP4}`);

  // Generate Video 1 WebP preview
  console.log(`Generating Video 1 animated WebP preview...`);
  const webpChild1 = spawn(
    'ffmpeg',
    [
      '-y',
      '-i', OUTPUT_MP4,
      '-vf', 'fps=10,scale=960:540:flags=lanczos',
      '-loop', '0',
      OUTPUT_WEBP,
    ],
    { stdio: 'inherit' }
  );

  await new Promise((resolve, reject) => {
    webpChild1.on('close', code => {
      if (code === 0) resolve();
      else reject(new Error(`FFmpeg webp generation exited with code ${code}`));
    });
  });
  fs.copyFileSync(OUTPUT_WEBP, LOCAL_WEBP);

  // =========================================================================
  // VIDEO 2: Cozy Green Screen Workspace Mockup + Julio Iglesias Music
  // =========================================================================
  console.log(`\n=======================================================`);
  console.log(`[2/3] Rendering Video 2: Cozy Green Screen Workspace Mockup`);
  console.log(`With Julio Iglesias - Oh La La Amour soundtrack (26.0s duration)`);
  console.log(`=======================================================`);

  const mockup1Child = spawn(
    'ffmpeg',
    [
      '-y',
      '-loop', '1',
      '-i', GREEN_SCREEN_1_PNG,
      '-i', OUTPUT_MP4,
      '-i', AUDIO_TRACK,
      '-filter_complex',
      '[1:v]scale=940:1672,perspective=x0=64:y0=638:x1=512:y1=657:x2=152:y2=1126:x3=575:y3=993:interpolation=cubic:sense=destination[warped];[0:v]chromakey=0x05F814:0.25:0.1[keyed];[warped][keyed]overlay=0:0,format=yuv420p[v]',
      '-map', '[v]',
      '-map', '2:a',
      '-af', `afade=t=in:st=0:d=1.0,afade=t=out:st=${totalDurationSec - 1.5}:d=1.5`,
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-crf', '18',
      '-c:a', 'aac',
      '-b:a', '192k',
      '-t', String(totalDurationSec),
      MOCKUP_1_MP4,
    ],
    { stdio: 'inherit' }
  );

  await new Promise((resolve, reject) => {
    mockup1Child.on('close', code => {
      if (code === 0) resolve();
      else reject(new Error(`FFmpeg mockup 1 exited with code ${code}`));
    });
  });

  fs.copyFileSync(MOCKUP_1_MP4, DESKTOP_MOCKUP_1_MP4);
  fs.copyFileSync(MOCKUP_1_MP4, LOCAL_MOCKUP_1_MP4);
  console.log(`Copied Video 2 to Desktop: ${DESKTOP_MOCKUP_1_MP4}`);
  console.log(`Copied Video 2 to Workspace: ${LOCAL_MOCKUP_1_MP4}`);

  // Generate Video 2 WebP preview
  console.log(`Generating Video 2 animated WebP preview...`);
  const webpChild2 = spawn(
    'ffmpeg',
    [
      '-y',
      '-i', MOCKUP_1_MP4,
      '-vf', 'fps=10,scale=470:836:flags=lanczos',
      '-loop', '0',
      MOCKUP_1_WEBP,
    ],
    { stdio: 'inherit' }
  );

  await new Promise((resolve, reject) => {
    webpChild2.on('close', code => {
      if (code === 0) resolve();
      else reject(new Error(`FFmpeg mockup 1 webp exited with code ${code}`));
    });
  });
  fs.copyFileSync(MOCKUP_1_WEBP, LOCAL_MOCKUP_1_WEBP);

  // =========================================================================
  // VIDEO 3: Studio Green Screen Workspace Mockup + Julio Iglesias Music
  // =========================================================================
  console.log(`\n=======================================================`);
  console.log(`[3/3] Rendering Video 3: Studio Workspace Mockup (Image 2)`);
  console.log(`With Julio Iglesias - Oh La La Amour soundtrack (26.0s duration)`);
  console.log(`=======================================================`);

  const mockup2Child = spawn(
    'ffmpeg',
    [
      '-y',
      '-loop', '1',
      '-i', GREEN_SCREEN_2_PNG,
      '-i', OUTPUT_MP4,
      '-i', AUDIO_TRACK,
      '-filter_complex',
      '[1:v]scale=941:1672,perspective=x0=134:y0=549:x1=863:y1=526:x2=154:y2=980:x3=872:y3=960:interpolation=cubic:sense=destination[warped];[0:v]chromakey=0x04FA04:0.25:0.1[keyed];[warped][keyed]overlay=0:0,format=yuv420p[v]',
      '-map', '[v]',
      '-map', '2:a',
      '-af', `afade=t=in:st=0:d=1.0,afade=t=out:st=${totalDurationSec - 1.5}:d=1.5`,
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-crf', '18',
      '-c:a', 'aac',
      '-b:a', '192k',
      '-t', String(totalDurationSec),
      MOCKUP_2_MP4,
    ],
    { stdio: 'inherit' }
  );

  await new Promise((resolve, reject) => {
    mockup2Child.on('close', code => {
      if (code === 0) resolve();
      else reject(new Error(`FFmpeg mockup 2 exited with code ${code}`));
    });
  });

  fs.copyFileSync(MOCKUP_2_MP4, DESKTOP_MOCKUP_2_MP4);
  fs.copyFileSync(MOCKUP_2_MP4, LOCAL_MOCKUP_2_MP4);
  console.log(`Copied Video 3 to Desktop: ${DESKTOP_MOCKUP_2_MP4}`);
  console.log(`Copied Video 3 to Workspace: ${LOCAL_MOCKUP_2_MP4}`);

  // Generate Video 3 WebP preview
  console.log(`Generating Video 3 animated WebP preview...`);
  const webpChild3 = spawn(
    'ffmpeg',
    [
      '-y',
      '-i', MOCKUP_2_MP4,
      '-vf', 'fps=10,scale=470:836:flags=lanczos',
      '-loop', '0',
      MOCKUP_2_WEBP,
    ],
    { stdio: 'inherit' }
  );

  await new Promise((resolve, reject) => {
    webpChild3.on('close', code => {
      if (code === 0) resolve();
      else reject(new Error(`FFmpeg mockup 2 webp exited with code ${code}`));
    });
  });
  fs.copyFileSync(MOCKUP_2_WEBP, LOCAL_MOCKUP_2_WEBP);

  console.log(`\n=======================================================`);
  console.log(`ALL 3 VIDEOS SUCCESSFULLY GENERATED & SAVED!`);
  console.log(`=======================================================`);
}

main().catch(err => {
  console.error('Fatal render error:', err);
  process.exit(1);
});
