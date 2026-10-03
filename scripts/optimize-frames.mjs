import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

// Keep memory usage bounded for 4 GB RAM constraints
sharp.cache(false);
sharp.concurrency(2);

function getStatsForDir(dirPath, ext = '.webp') {
  const files = fs.readdirSync(dirPath)
    .filter(f => f.endsWith(ext))
    .sort();

  if (files.length === 0) {
    return { count: 0, totalBytes: 0, min: null, max: null, median: null, first: null, last: null };
  }

  const fileSizes = files.map(f => {
    const size = fs.statSync(path.join(dirPath, f)).size;
    return { name: f, size };
  });

  const totalBytes = fileSizes.reduce((sum, item) => sum + item.size, 0);

  // Sort by size to determine min, median, max
  const sortedBySize = [...fileSizes].sort((a, b) => a.size - b.size);
  const min = sortedBySize[0];
  const max = sortedBySize[sortedBySize.length - 1];
  const median = sortedBySize[Math.floor(sortedBySize.length / 2)];

  return {
    count: files.length,
    totalBytes,
    min,
    median,
    max,
    first: files[0],
    last: files[files.length - 1]
  };
}

async function main() {
  console.log('=== Aurelia House: Phase C Web Optimization (Decode-Once) ===\n');

  const rootDir = process.cwd();
  const configPath = path.join(rootDir, 'assets.config.json');
  if (!fs.existsSync(configPath)) {
    console.error(`ERROR: Missing config file '${configPath}'`);
    process.exit(1);
  }

  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const workDir = path.resolve(config.workDir || 'C:\\aurelia-work');
  const inputDir = path.join(workDir, 'frames-4k');
  const exportFps = config.exportFps || 12;

  if (!fs.existsSync(inputDir)) {
    console.error(`ERROR: Master frame directory '${inputDir}' does not exist.`);
    process.exit(1);
  }

  const extractManifestPath = path.join(inputDir, 'extract-manifest.json');
  if (!fs.existsSync(extractManifestPath)) {
    console.error(`ERROR: Missing extract manifest at '${extractManifestPath}'`);
    process.exit(1);
  }
  const extractManifest = JSON.parse(fs.readFileSync(extractManifestPath, 'utf8'));

  const publicFramesDir = path.join(rootDir, 'public', 'frames');
  const dir720 = path.join(publicFramesDir, '720');
  const dir1080 = path.join(publicFramesDir, '1080');
  const dirThumbs = path.join(publicFramesDir, 'thumbs');

  [dir720, dir1080, dirThumbs].forEach(d => {
    if (!fs.existsSync(d)) {
      fs.mkdirSync(d, { recursive: true });
    }
  });

  const force = process.argv.includes('--force');
  const srcFiles = fs.readdirSync(inputDir)
    .filter(f => /^frame-\d{4}\.png$/.test(f))
    .sort();

  const totalFrames = srcFiles.length;
  console.log(`Found ${totalFrames} master frames in ${inputDir}`);
  console.log(`Target 720p:   1280x720, quality 78`);
  console.log(`Target 1080p:  1920x1080, quality 80 (native encode)`);
  console.log(`Target Thumbs: 320x180, quality 60 (step 8 + final frame)`);
  console.log(`Output:        ${publicFramesDir}\n`);

  const lumArray = new Array(totalFrames);
  const warmArray = new Array(totalFrames);
  const startTime = Date.now();
  let processedCount = 0;

  // Process frames sequentially or in pairs of 2 to strictly respect 4 GB RAM
  const batchSize = 2;
  for (let b = 0; b < totalFrames; b += batchSize) {
    const end = Math.min(b + batchSize, totalFrames);
    const batchPromises = [];

    for (let i = b; i < end; i++) {
      const frameIdx = i;
      batchPromises.push((async () => {
        const srcName = srcFiles[frameIdx];
        const baseName = srcName.replace(/\.png$/, '');
        const outName = `${baseName}.webp`;
        const srcPath = path.join(inputDir, srcName);

        const out720Path = path.join(dir720, outName);
        const out1080Path = path.join(dir1080, outName);
        const isThumb = (frameIdx % 8 === 0) || (frameIdx === totalFrames - 1);
        const outThumbPath = isThumb ? path.join(dirThumbs, outName) : null;

        const needs1080 = force || !fs.existsSync(out1080Path);
        const needs720 = force || !fs.existsSync(out720Path);
        const needsThumb = isThumb && (force || !fs.existsSync(outThumbPath));

        const buf = fs.readFileSync(srcPath);

        // Decode source PNG once into raw RGB pixel buffer
        const { data: raw, info } = await sharp(buf)
          .removeAlpha()
          .raw()
          .toBuffer({ resolveWithObject: true });

        const operations = [];

        // 1. 1080p WebP
        if (needs1080) {
          operations.push(
            sharp(raw, { raw: info })
              .webp({ quality: 80, effort: 4 })
              .toFile(out1080Path)
          );
        }

        // 2. 720p WebP
        if (needs720) {
          operations.push(
            sharp(raw, { raw: info })
              .resize(1280, 720, { fit: 'fill' })
              .webp({ quality: 78, effort: 4 })
              .toFile(out720Path)
          );
        }

        // 3. Thumb WebP
        if (needsThumb) {
          operations.push(
            sharp(raw, { raw: info })
              .resize(320, 180, { fit: 'fill' })
              .webp({ quality: 60, effort: 4 })
              .toFile(outThumbPath)
          );
        }

        // 4. Tone calculation from 32x18
        operations.push(
          sharp(raw, { raw: info })
            .resize(32, 18, { fit: 'fill' })
            .raw()
            .toBuffer({ resolveWithObject: true })
            .then(({ data: rawTiny }) => {
              let sumLum = 0;
              let sumWarm = 0;
              const numPixels = 32 * 18;
              for (let p = 0; p < rawTiny.length; p += 3) {
                const r = rawTiny[p];
                const g = rawTiny[p + 1];
                const b = rawTiny[p + 2];
                const lum = 0.299 * r + 0.587 * g + 0.114 * b;
                const warm = ((r - b) + 255) / 2;
                sumLum += lum;
                sumWarm += warm;
              }
              lumArray[frameIdx] = Number((sumLum / numPixels).toFixed(2));
              warmArray[frameIdx] = Number((sumWarm / numPixels).toFixed(2));
            })
        );

        await Promise.all(operations);
      })());
    }

    await Promise.all(batchPromises);
    processedCount += (end - b);

    if (processedCount % 100 === 0 || processedCount === totalFrames) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const fps = (processedCount / (elapsed || 1)).toFixed(1);
      console.log(`[Optimize] Processed ${processedCount}/${totalFrames} frames (${fps} fps, ${elapsed}s elapsed)...`);
    }
  }

  // 5. Write tone.json
  const tonePath = path.join(publicFramesDir, 'tone.json');
  fs.writeFileSync(tonePath, JSON.stringify({ lum: lumArray, warm: warmArray }), 'utf8');
  console.log(`\nWritten tone data: ${tonePath}`);

  // 6. Write manifest.json
  const durationSec = Number((totalFrames / exportFps).toFixed(3));
  const manifest = {
    count: totalFrames,
    pad: 4,
    ext: 'webp',
    exportFps,
    durationSec,
    sets: {
      "720": { "w": 1280, "h": 720, "dir": "/frames/720" },
      "1080": { "w": 1920, "h": 1080, "dir": "/frames/1080" }
    },
    thumbs: {
      "w": 320,
      "h": 180,
      "step": 8,
      "dir": "/frames/thumbs"
    },
    clips: extractManifest.clips.map(c => ({
      id: c.id,
      name: c.name,
      startIndex: c.startIndex,
      endIndex: c.endIndex
    }))
  };

  const manifestPath = path.join(publicFramesDir, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
  console.log(`Written web manifest: ${manifestPath}`);

  // 7. Calculate set statistics
  const stats720 = getStatsForDir(dir720);
  const stats1080 = getStatsForDir(dir1080);
  const statsThumbs = getStatsForDir(dirThumbs);

  console.log('\n======================================================');
  console.log('GATE C: Web Optimization Complete');
  console.log('======================================================');

  console.log(`\n--- 1080p WebP Set (1920x1080, q80) ---`);
  console.log(`File Count:     ${stats1080.count}`);
  console.log(`Total Size:     ${(stats1080.totalBytes / (1024 * 1024)).toFixed(2)} MB`);
  console.log(`Smallest File:  ${stats1080.min.name} (${(stats1080.min.size / 1024).toFixed(1)} KB)`);
  console.log(`Median File:    ${stats1080.median.name} (${(stats1080.median.size / 1024).toFixed(1)} KB)`);
  console.log(`Largest File:   ${stats1080.max.name} (${(stats1080.max.size / 1024).toFixed(1)} KB)`);
  console.log(`First File:     ${stats1080.first}`);
  console.log(`Last File:      ${stats1080.last}`);

  console.log(`\n--- 720p WebP Set (1280x720, q78) ---`);
  console.log(`File Count:     ${stats720.count}`);
  console.log(`Total Size:     ${(stats720.totalBytes / (1024 * 1024)).toFixed(2)} MB`);
  console.log(`Smallest File:  ${stats720.min.name} (${(stats720.min.size / 1024).toFixed(1)} KB)`);
  console.log(`Median File:    ${stats720.median.name} (${(stats720.median.size / 1024).toFixed(1)} KB)`);
  console.log(`Largest File:   ${stats720.max.name} (${(stats720.max.size / 1024).toFixed(1)} KB)`);
  console.log(`First File:     ${stats720.first}`);
  console.log(`Last File:      ${stats720.last}`);

  console.log(`\n--- Thumbs Set (320x180, q60, step 8 + final) ---`);
  console.log(`File Count:     ${statsThumbs.count}`);
  console.log(`Total Size:     ${(statsThumbs.totalBytes / 1024).toFixed(2)} KB (${(statsThumbs.totalBytes / (1024 * 1024)).toFixed(2)} MB)`);
  console.log(`Smallest File:  ${statsThumbs.min.name} (${(statsThumbs.min.size / 1024).toFixed(1)} KB)`);
  console.log(`Median File:    ${statsThumbs.median.name} (${(statsThumbs.median.size / 1024).toFixed(1)} KB)`);
  console.log(`Largest File:   ${statsThumbs.max.name} (${(statsThumbs.max.size / 1024).toFixed(1)} KB)`);
  console.log(`First File:     ${statsThumbs.first}`);
  console.log(`Last File:      ${statsThumbs.last}`);

  console.log(`\n--- Overall Assets Summary ---`);
  const totalWebBytes = stats1080.totalBytes + stats720.totalBytes + statsThumbs.totalBytes;
  console.log(`Total Optimized Web Assets: ${(totalWebBytes / (1024 * 1024)).toFixed(2)} MB`);
  console.log('======================================================\n');
}

main().catch(err => {
  console.error('\nFATAL ERROR in optimize-frames:', err);
  process.exit(1);
});
