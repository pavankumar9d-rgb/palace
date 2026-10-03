import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import sharp from 'sharp';

function execCmd(command, args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, { windowsHide: true });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', d => { stdout += d.toString(); });
    proc.stderr.on('data', d => { stderr += d.toString(); });
    proc.on('error', err => reject(err));
    proc.on('close', code => {
      resolve({ code, stdout, stderr });
    });
  });
}

async function probeClip(filePath) {
  const probeArgs = [
    '-v', 'error',
    '-select_streams', 'v:0',
    '-show_entries', 'stream=width,height,color_range,nb_read_frames,nb_frames',
    '-count_frames',
    '-of', 'json',
    filePath
  ];
  const res = await execCmd('ffprobe', probeArgs);
  if (res.code !== 0) throw new Error(`ffprobe failed on ${filePath}: ${res.stderr}`);
  const data = JSON.parse(res.stdout);
  const stream = (data.streams && data.streams[0]) || {};
  return {
    width: stream.width,
    height: stream.height,
    colorRange: stream.color_range || 'unknown',
    frames: parseInt(stream.nb_read_frames || stream.nb_frames || '240', 10)
  };
}

async function main() {
  console.log('=== Aurelia House: Phase B Master Frame Extraction ===\n');

  // 1. Load config
  const rootDir = process.cwd();
  const configPath = path.join(rootDir, 'assets.config.json');
  if (!fs.existsSync(configPath)) {
    console.error(`ERROR: Missing config file '${configPath}'`);
    process.exit(1);
  }

  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const assetsDir = path.resolve(rootDir, config.assetsDir || 'assests');
  const workDir = path.resolve(config.workDir || 'C:\\aurelia-work');
  const exportFps = config.exportFps || 12;
  const targetW = config.targetWidth || 1920;
  const targetH = config.targetHeight || 1080;
  const outputDir = path.join(workDir, 'frames-4k');
  const tmpExtractDir = path.join(workDir, 'tmp_extract');

  console.log(`[Config] Assets Dir: ${assetsDir}`);
  console.log(`[Config] Work Dir:   ${workDir}`);
  console.log(`[Config] Target:     ${targetW}x${targetH} @ ${exportFps} fps (Native 1080p, no upscaling)`);
  console.log(`[Config] Output Dir: ${outputDir}\n`);

  // Ensure workDir and outputDir exist
  if (!fs.existsSync(workDir)) {
    fs.mkdirSync(workDir, { recursive: true });
  }
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  if (!fs.existsSync(tmpExtractDir)) {
    fs.mkdirSync(tmpExtractDir, { recursive: true });
  }

  // 2. Discover clips in assests/
  const entries = fs.readdirSync(assetsDir, { withFileTypes: true });
  const clipPattern = /^C(\d{2})\b/;
  const clips = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const match = entry.name.match(clipPattern);
      if (match) {
        const folderPath = path.join(assetsDir, entry.name);
        const files = fs.readdirSync(folderPath);
        const videoName = files.find(f => /\.(mp4|mov|m4v|webm|mkv)$/i.test(f));
        if (!videoName) {
          console.error(`ERROR: No video found in folder '${entry.name}'`);
          process.exit(1);
        }
        clips.push({
          id: `C${match[1]}`,
          num: parseInt(match[1], 10),
          name: entry.name.replace(/^C\d{2}\s*/, '').trim(),
          folderName: entry.name,
          filePath: path.join(folderPath, videoName)
        });
      }
    }
  }

  clips.sort((a, b) => a.num - b.num);
  if (clips.length !== 12) {
    console.error(`ERROR: Expected exactly 12 clips, found ${clips.length}`);
    process.exit(1);
  }

  // 3. Pre-flight Disk Space Check
  console.log('[1/4] Checking free disk space on drive...');
  const driveRoot = path.parse(workDir).root;
  const stats = fs.statfsSync(driveRoot);
  const freeBytes = stats.bsize * stats.bfree;
  const freeGB = freeBytes / (1024 ** 3);

  // Measure 1 test frame to estimate exact size
  console.log('Measuring sample 1080p frame size...');
  const sampleFramePath = path.join(tmpExtractDir, 'sample_measure.png');
  const sampleProc = spawn('ffmpeg', [
    '-hide_banner', '-y', '-i', clips[0].filePath,
    '-an',
    '-vf', `fps=${exportFps},scale=${targetW}:${targetH}:flags=lanczos,setsar=1,format=rgb24`,
    '-c:v', 'png',
    '-compression_level', '3',
    '-vframes', '1',
    sampleFramePath
  ], { windowsHide: true });

  await new Promise((resolve, reject) => {
    sampleProc.on('close', code => (code === 0 ? resolve() : reject(new Error('Sample extraction failed'))));
  });

  const sampleSize = fs.statSync(sampleFramePath).size;
  fs.unlinkSync(sampleFramePath); // clean up sample

  const expectedTotalFrames = 12 * 120 + 1; // 1441 frames
  const estimatedTotalBytes = sampleSize * expectedTotalFrames;
  const estimatedTotalGB = estimatedTotalBytes / (1024 ** 3);
  const requiredSafetyGB = estimatedTotalGB * 1.2;

  console.log(`- Sample 1080p PNG size: ${(sampleSize / 1024).toFixed(1)} KB`);
  console.log(`- Expected frames:       ${expectedTotalFrames}`);
  console.log(`- Estimated total size:  ${estimatedTotalGB.toFixed(2)} GB`);
  console.log(`- Free space on ${driveRoot}:     ${freeGB.toFixed(2)} GB`);
  console.log(`- Required safety (1.2x): ${requiredSafetyGB.toFixed(2)} GB`);

  if (freeBytes < estimatedTotalBytes * 1.2) {
    console.error(`ERROR: Free disk space (${freeGB.toFixed(2)} GB) is less than 1.2x the estimate (${requiredSafetyGB.toFixed(2)} GB). Stopping.`);
    process.exit(1);
  }
  console.log('=> Disk space check passed successfully.\n');

  // 4. Sequential Extraction per Clip
  console.log('[2/4] Extracting frames clip by clip (fps=12 from t=0)...');
  const clipManifests = [];
  let globalFrameIndex = 1; // 1-based numbering for filenames

  for (let i = 0; i < clips.length; i++) {
    const clip = clips[i];
    const isLastClip = (i === clips.length - 1);
    const clipTmpDir = path.join(tmpExtractDir, clip.id);
    if (!fs.existsSync(clipTmpDir)) {
      fs.mkdirSync(clipTmpDir, { recursive: true });
    }

    // Probe clip color range
    const probe = await probeClip(clip.filePath);
    const rangeFilter = probe.colorRange === 'tv' ? 'in_range=tv:out_range=pc:' : '';
    const filter = `fps=${exportFps},scale=${targetW}:${targetH}:${rangeFilter}flags=lanczos,setsar=1,format=rgb24`;

    console.log(`[${clip.id}] Extracting ${clip.name}...`);
    const extractArgs = [
      '-hide_banner',
      '-loglevel', 'error',
      '-y',
      '-i', clip.filePath,
      '-an',
      '-vf', filter,
      '-c:v', 'png',
      '-compression_level', '3',
      '-start_number', '1',
      path.join(clipTmpDir, 'f-%04d.png')
    ];

    const extractRes = await execCmd('ffmpeg', extractArgs);
    if (extractRes.code !== 0) {
      console.error(`ERROR: ffmpeg failed on ${clip.id}: ${extractRes.stderr}`);
      process.exit(1);
    }

    let clipFiles = fs.readdirSync(clipTmpDir).filter(f => /^f-\d{4}\.png$/.test(f)).sort();
    console.log(`  -> Initial extracted frames: ${clipFiles.length}`);

    if (clipFiles.length !== 120) {
      console.warn(`  WARNING: Expected 120 frames for ${clip.id}, got ${clipFiles.length}`);
    }

    // For C12 (final clip), append true closing frame
    if (isLastClip) {
      console.log(`  -> Appending true closing frame of ${clip.id} (frame index ${probe.frames - 1})...`);
      const lastFrameOut = path.join(clipTmpDir, 'f-0121.png');
      const lastArgs = [
        '-hide_banner',
        '-loglevel', 'error',
        '-y',
        '-i', clip.filePath,
        '-an',
        '-vf', `select=eq(n\\,${probe.frames - 1}),scale=${targetW}:${targetH}:${rangeFilter}flags=lanczos,setsar=1,format=rgb24`,
        '-c:v', 'png',
        '-compression_level', '3',
        '-vframes', '1',
        lastFrameOut
      ];
      const lastRes = await execCmd('ffmpeg', lastArgs);
      if (lastRes.code !== 0) {
        console.error(`ERROR appending last frame to C12: ${lastRes.stderr}`);
        process.exit(1);
      }
      clipFiles = fs.readdirSync(clipTmpDir).filter(f => /^f-\d{4}\.png$/.test(f)).sort();
      console.log(`  -> C12 total frames after closing frame append: ${clipFiles.length}`);
    }

    // Record clip manifest data
    const startIndex = globalFrameIndex - 1; // 0-based inclusive
    for (const f of clipFiles) {
      const srcFile = path.join(clipTmpDir, f);
      const targetFileName = `frame-${String(globalFrameIndex).padStart(4, '0')}.png`;
      const dstFile = path.join(outputDir, targetFileName);
      fs.renameSync(srcFile, dstFile);
      globalFrameIndex++;
    }
    const endIndex = globalFrameIndex - 2; // 0-based inclusive

    clipManifests.push({
      id: clip.id,
      name: clip.name,
      startIndex,
      endIndex,
      frames: clipFiles.length
    });

    console.log(`  -> Saved as frame-${String(startIndex + 1).padStart(4, '0')}.png to frame-${String(endIndex + 1).padStart(4, '0')}.png (${clipFiles.length} frames)`);
  }

  // Clean up tmp_extract
  fs.rmSync(tmpExtractDir, { recursive: true, force: true });

  // 5. Write extract-manifest.json
  console.log('\n[3/4] Writing extract-manifest.json...');
  const totalExtractedFrames = globalFrameIndex - 1;
  const manifest = {
    count: totalExtractedFrames,
    pad: 4,
    exportFps,
    width: targetW,
    height: targetH,
    sourceUpscaled: false,
    clips: clipManifests
  };

  const manifestPath = path.join(outputDir, 'extract-manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
  console.log(`Written manifest to: ${manifestPath}`);

  // 6. Final Validation & Sizing
  console.log('\n[4/4] Validating extracted sequence...');
  const allOutputFiles = fs.readdirSync(outputDir).filter(f => /^frame-\d{4}\.png$/.test(f)).sort();

  if (allOutputFiles.length !== totalExtractedFrames) {
    console.error(`ERROR: File count mismatch! Directory has ${allOutputFiles.length}, expected ${totalExtractedFrames}`);
    process.exit(1);
  }

  // Verify contiguous numbering
  for (let idx = 1; idx <= totalExtractedFrames; idx++) {
    const expectedName = `frame-${String(idx).padStart(4, '0')}.png`;
    if (allOutputFiles[idx - 1] !== expectedName) {
      console.error(`ERROR: Gaps or misalignment detected! Expected ${expectedName}, found ${allOutputFiles[idx - 1]}`);
      process.exit(1);
    }
  }

  // Calculate total size on disk
  let totalSizeBytes = 0;
  for (const f of allOutputFiles) {
    totalSizeBytes += fs.statSync(path.join(outputDir, f)).size;
  }
  const totalSizeMB = totalSizeBytes / (1024 * 1024);
  const totalSizeGB = totalSizeBytes / (1024 ** 3);

  // Validate dimensions of first and last frame with sharp
  const firstFrameMeta = await sharp(path.join(outputDir, allOutputFiles[0])).metadata();
  const lastFrameMeta = await sharp(path.join(outputDir, allOutputFiles[allOutputFiles.length - 1])).metadata();

  console.log(`\n======================================================`);
  console.log(`GATE B: Master Extraction Complete`);
  console.log(`======================================================`);
  console.log(`Total Frames:            ${totalExtractedFrames} (expected ${expectedTotalFrames})`);
  console.log(`First Frame:             ${allOutputFiles[0]} (${firstFrameMeta.width}x${firstFrameMeta.height})`);
  console.log(`Last Frame:              ${allOutputFiles[allOutputFiles.length - 1]} (${lastFrameMeta.width}x${lastFrameMeta.height})`);
  console.log(`Total Size on Disk:      ${totalSizeMB.toFixed(2)} MB (${totalSizeGB.toFixed(2)} GB)`);
  console.log(`Average Size per Frame:  ${(totalSizeMB / totalExtractedFrames).toFixed(2)} MB`);
  console.log(`Location:                ${outputDir}`);
  console.log(`\nPer-Clip Frame Counts:`);
  for (const c of clipManifests) {
    console.log(`- ${c.id} (${c.name}): ${c.frames} frames [Index ${c.startIndex} .. ${c.endIndex}]`);
  }
  console.log(`======================================================\n`);
}

main().catch(err => {
  console.error('\nFATAL ERROR in extract-frames:', err);
  process.exit(1);
});
