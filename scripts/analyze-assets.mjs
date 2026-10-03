import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import sharp from 'sharp';

// Helper to run a command and capture stdout/stderr with argument array
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

// Helper to extract a single frame as a PNG buffer using ffmpeg
function extractFrameBuffer(videoPath, frameIndex) {
  return new Promise((resolve, reject) => {
    // Escape comma inside filter argument for ffmpeg filtergraph parser: select=eq(n\,idx)
    const filter = `select=eq(n\\,${frameIndex}),scale=480:270:flags=lanczos,format=rgb24`;
    const proc = spawn('ffmpeg', [
      '-hide_banner',
      '-loglevel', 'error',
      '-y',
      '-i', videoPath,
      '-vf', filter,
      '-vframes', '1',
      '-f', 'image2',
      '-c:v', 'png',
      'pipe:1'
    ], { windowsHide: true });

    const chunks = [];
    let errStr = '';
    proc.stdout.on('data', c => chunks.push(c));
    proc.stderr.on('data', d => { errStr += d.toString(); });
    proc.on('error', err => reject(err));
    proc.on('close', code => {
      if (code !== 0) {
        return reject(new Error(`ffmpeg frame extraction failed with code ${code}: ${errStr}`));
      }
      resolve(Buffer.concat(chunks));
    });
  });
}

// Compute Mean Absolute Difference (MAD) between two PNG buffers using sharp
async function computeMeanAbsoluteDifference(bufA, bufB) {
  const { data: rawA, info: infoA } = await sharp(bufA).raw().toBuffer({ resolveWithObject: true });
  const { data: rawB, info: infoB } = await sharp(bufB).raw().toBuffer({ resolveWithObject: true });

  if (rawA.length !== rawB.length) {
    throw new Error(`Buffer length mismatch: ${rawA.length} vs ${rawB.length} (${infoA.width}x${infoA.height} vs ${infoB.width}x${infoB.height})`);
  }

  let totalDiff = 0;
  for (let i = 0; i < rawA.length; i++) {
    totalDiff += Math.abs(rawA[i] - rawB[i]);
  }
  return totalDiff / rawA.length;
}

async function main() {
  console.log('=== Aurelia House: Phase A Asset Analysis ===\n');

  // 1. Preconditions
  console.log('[1/5] Checking preconditions...');
  
  // Check Node version >= 20
  const nodeMajor = parseInt(process.versions.node.split('.')[0], 10);
  console.log(`- Node.js version: ${process.version} (major: ${nodeMajor})`);
  if (nodeMajor < 20) {
    console.error(`ERROR: Node.js 20 or newer is required. Found: ${process.version}`);
    process.exit(1);
  }

  // Check ffmpeg and ffprobe on PATH
  let ffmpegVer = '';
  let ffprobeVer = '';
  try {
    const res = await execCmd('ffmpeg', ['-version']);
    if (res.code !== 0) throw new Error(res.stderr);
    ffmpegVer = res.stdout.split('\n')[0].trim();
    console.log(`- ffmpeg: ${ffmpegVer}`);
  } catch (err) {
    console.error('ERROR: ffmpeg is not installed or not found on PATH.');
    console.error('Please install ffmpeg (for example: `winget install Gyan.FFmpeg`) and add it to PATH.');
    process.exit(1);
  }

  try {
    const res = await execCmd('ffprobe', ['-version']);
    if (res.code !== 0) throw new Error(res.stderr);
    ffprobeVer = res.stdout.split('\n')[0].trim();
    console.log(`- ffprobe: ${ffprobeVer}`);
  } catch (err) {
    console.error('ERROR: ffprobe is not installed or not found on PATH.');
    console.error('Please install ffmpeg/ffprobe and add it to PATH.');
    process.exit(1);
  }

  // 2. Discover and Validate Folders
  console.log('\n[2/5] Inspecting assets directory...');
  const rootDir = process.cwd();
  const assetsDir = path.join(rootDir, 'assests');

  if (!fs.existsSync(assetsDir)) {
    console.error(`ERROR: Assets folder '${assetsDir}' does not exist.`);
    process.exit(1);
  }

  const entries = fs.readdirSync(assetsDir, { withFileTypes: true });
  const clipPattern = /^C(\d{2})\b/;
  const matchedFolders = [];
  const extraItems = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const match = entry.name.match(clipPattern);
      if (match) {
        matchedFolders.push({
          id: `C${match[1]}`,
          num: parseInt(match[1], 10),
          folderName: entry.name,
          folderPath: path.join(assetsDir, entry.name)
        });
      } else {
        extraItems.push({ name: entry.name, type: 'directory' });
      }
    } else {
      extraItems.push({ name: entry.name, type: 'file' });
    }
  }

  matchedFolders.sort((a, b) => a.num - b.num);

  console.log(`- Found ${matchedFolders.length} clip folders matching ^C(\\d{2})\\b`);
  if (extraItems.length > 0) {
    console.log(`- Extra items ignored: ${extraItems.map(x => x.name).join(', ')}`);
  }

  // Check C01 to C12 exist exactly once with no gaps
  const expectedCount = 12;
  const missing = [];
  const duplicates = [];
  const seen = new Set();

  for (let i = 1; i <= expectedCount; i++) {
    const cid = `C${String(i).padStart(2, '0')}`;
    const matches = matchedFolders.filter(f => f.id === cid);
    if (matches.length === 0) {
      missing.push(cid);
    } else if (matches.length > 1) {
      duplicates.push(cid);
    }
  }

  if (missing.length > 0 || duplicates.length > 0) {
    console.error(`ERROR in clip folders: missing [${missing.join(', ')}], duplicates [${duplicates.join(', ')}]`);
    process.exit(1);
  }

  // 3. Probe each video file
  console.log('\n[3/5] Probing clips with ffprobe...');
  const videoExts = new Set(['.mp4', '.mov', '.m4v', '.webm', '.mkv']);
  const clipReports = [];

  for (const item of matchedFolders) {
    const files = fs.readdirSync(item.folderPath, { withFileTypes: true });
    const videoFiles = [];
    const nonVideoFiles = [];

    for (const f of files) {
      if (f.isFile()) {
        const ext = path.extname(f.name).toLowerCase();
        if (videoExts.has(ext)) {
          videoFiles.push(f.name);
        } else {
          nonVideoFiles.push(f.name);
        }
      }
    }

    if (videoFiles.length === 0) {
      console.error(`ERROR: Folder '${item.folderName}' contains no video files.`);
      process.exit(1);
    }
    if (videoFiles.length > 1) {
      console.error(`ERROR: Folder '${item.folderName}' contains multiple video files: ${videoFiles.join(', ')}. Stop and ask user which to use.`);
      process.exit(1);
    }

    const videoName = videoFiles[0];
    const videoPath = path.join(item.folderPath, videoName);
    const stats = fs.statSync(videoPath);

    // Check for OneDrive cloud-only placeholder (0 bytes)
    if (stats.size === 0) {
      console.error(`\nERROR: Video file '${videoName}' has size 0 bytes.`);
      console.error('This appears to be a OneDrive cloud-only placeholder.');
      console.error("Please right-click the 'assests' folder and choose 'Always keep on this device', then re-run.");
      process.exit(1);
    }

    // Run ffprobe with -count_frames
    const probeArgs = [
      '-v', 'error',
      '-select_streams', 'v:0',
      '-show_entries', 'stream=codec_name,width,height,display_aspect_ratio,r_frame_rate,avg_frame_rate,nb_frames,nb_read_frames,pix_fmt,color_range,color_space,color_transfer:stream_tags=rotate:stream_side_data=rotation',
      '-show_entries', 'format=format_name,duration,bit_rate',
      '-count_frames',
      '-of', 'json',
      videoPath
    ];

    const probeRes = await execCmd('ffprobe', probeArgs);
    if (probeRes.code !== 0) {
      console.error(`\nERROR: ffprobe failed on '${videoPath}': ${probeRes.stderr}`);
      console.error("If OneDrive is syncing or this is an unhydrated file, please right-click the 'assests' folder and choose 'Always keep on this device'.");
      process.exit(1);
    }

    let probeData;
    try {
      probeData = JSON.parse(probeRes.stdout);
    } catch (err) {
      console.error(`ERROR: Failed to parse ffprobe JSON for '${videoName}':`, err);
      process.exit(1);
    }

    // Also check if audio stream exists
    const audioProbeArgs = [
      '-v', 'error',
      '-select_streams', 'a:0',
      '-show_entries', 'stream=codec_name',
      '-of', 'json',
      videoPath
    ];
    const audioRes = await execCmd('ffprobe', audioProbeArgs);
    let hasAudio = false;
    let audioCodec = null;
    if (audioRes.code === 0) {
      try {
        const aData = JSON.parse(audioRes.stdout);
        if (aData.streams && aData.streams.length > 0) {
          hasAudio = true;
          audioCodec = aData.streams[0].codec_name;
        }
      } catch (_) {}
    }

    const vStream = (probeData.streams && probeData.streams[0]) || {};
    const fmt = probeData.format || {};

    const width = vStream.width || 0;
    const height = vStream.height || 0;
    const codec = vStream.codec_name || 'unknown';
    const container = fmt.format_name || 'unknown';
    const durationSec = parseFloat(fmt.duration || '0');
    const bitRate = parseInt(fmt.bit_rate || '0', 10);
    const pixFmt = vStream.pix_fmt || 'unknown';
    const colorRange = vStream.color_range || 'unknown';
    const colorSpace = vStream.color_space || 'unknown';
    const colorTransfer = vStream.color_transfer || 'unknown';
    const rFps = vStream.r_frame_rate || 'unknown';
    const avgFps = vStream.avg_frame_rate || 'unknown';

    // Parse numeric frame rate
    let numericFps = 0;
    if (avgFps.includes('/')) {
      const [num, den] = avgFps.split('/').map(Number);
      numericFps = den !== 0 ? num / den : 0;
    } else {
      numericFps = parseFloat(avgFps) || 0;
    }

    // Frame count: use nb_frames or nb_read_frames
    let frameCount = parseInt(vStream.nb_read_frames || vStream.nb_frames || '0', 10);
    if (!frameCount && durationSec > 0 && numericFps > 0) {
      frameCount = Math.round(durationSec * numericFps);
    }

    // Display aspect ratio
    let dar = vStream.display_aspect_ratio;
    if (!dar && width && height) {
      const gcd = (a, b) => (b === 0 ? a : gcd(b, a % b));
      const g = gcd(width, height);
      dar = `${width / g}:${height / g}`;
    }

    // Rotation
    let rotation = 0;
    if (vStream.tags && vStream.tags.rotate) {
      rotation = parseInt(vStream.tags.rotate, 10);
    } else if (vStream.side_data_list) {
      const rotEntry = vStream.side_data_list.find(s => s.rotation !== undefined);
      if (rotEntry) rotation = rotEntry.rotation;
    }

    clipReports.push({
      id: item.id,
      name: item.folderName.replace(/^C\d{2}\s*/, '').trim(),
      folderName: item.folderName,
      fileName: videoName,
      filePath: videoPath,
      fileSizeBytes: stats.size,
      container,
      codec,
      width,
      height,
      dar,
      rotation,
      r_frame_rate: rFps,
      avg_frame_rate: avgFps,
      fps: numericFps,
      frameCount,
      durationSec,
      pixFmt,
      colorRange,
      colorSpace,
      colorTransfer,
      bitRate,
      hasAudio,
      audioCodec,
      nonVideoFiles
    });

    console.log(`- [${item.id}] ${item.folderName}: ${width}x${height} @ ${numericFps.toFixed(2)} fps, ${frameCount} frames, ${durationSec.toFixed(2)}s, audio: ${hasAudio ? audioCodec : 'none'}`);
  }

  // 4. Seam Testing
  console.log('\n[4/5] Running seam tests between adjacent clips (Cn last frame vs Cn+1 first frame)...');
  const seamReports = [];

  for (let i = 0; i < clipReports.length - 1; i++) {
    const cur = clipReports[i];
    const nxt = clipReports[i + 1];
    const pairLabel = `${cur.id} -> ${nxt.id}`;
    const lastFrameIdx = cur.frameCount - 1;

    console.log(`- Testing seam ${pairLabel} (frame ${lastFrameIdx} of ${cur.id} vs frame 0 of ${nxt.id})...`);

    try {
      const lastBuf = await extractFrameBuffer(cur.filePath, lastFrameIdx);
      const firstBuf = await extractFrameBuffer(nxt.filePath, 0);
      const mad = await computeMeanAbsoluteDifference(lastBuf, firstBuf);

      let assessment = '';
      if (mad < 3.0) {
        assessment = 'EXACT MATCH (< 3.0, expected)';
      } else if (mad <= 12.0) {
        assessment = 'SMALL MISMATCH (3.0 to 12.0)';
      } else {
        assessment = 'VISIBLE JUMP (> 12.0)';
      }

      console.log(`  => Seam ${pairLabel} MAD: ${mad.toFixed(3)} [${assessment}]`);
      seamReports.push({
        fromClip: cur.id,
        toClip: nxt.id,
        fromFrame: lastFrameIdx,
        toFrame: 0,
        meanAbsoluteDifference: Number(mad.toFixed(3)),
        assessment
      });
    } catch (err) {
      console.error(`  => ERROR during seam test ${pairLabel}:`, err.message);
      seamReports.push({
        fromClip: cur.id,
        toClip: nxt.id,
        fromFrame: lastFrameIdx,
        toFrame: 0,
        error: err.message,
        meanAbsoluteDifference: null,
        assessment: 'ERROR'
      });
    }
  }

  // Attach seam score to clipReports
  for (let i = 0; i < clipReports.length; i++) {
    if (i < seamReports.length) {
      clipReports[i].seamScoreToNext = seamReports[i].meanAbsoluteDifference;
      clipReports[i].seamAssessmentToNext = seamReports[i].assessment;
    } else {
      clipReports[i].seamScoreToNext = null;
      clipReports[i].seamAssessmentToNext = 'N/A (Final Clip)';
    }
  }

  // 5. Aggregate calculations and warnings
  console.log('\n[5/5] Generating reports and analyzing warnings...');
  const exportFps = 12;
  const totalDurationSec = clipReports.reduce((acc, c) => acc + c.durationSec, 0);
  const totalSourceFrames = clipReports.reduce((acc, c) => acc + c.frameCount, 0);
  
  // Total frames at export rate (each clip sampled at exportFps):
  // For each clip duration * exportFps, minus 1 dropped seam duplicate for each matched seam
  const clipExpectedFramesAt12Fps = clipReports.map(c => Math.round(c.durationSec * exportFps));
  const totalExpectedFramesAt12FpsRaw = clipExpectedFramesAt12Fps.reduce((a, b) => a + b, 0);

  // Warnings check
  const warnings = [];

  // Duration outside 9 to 11s
  for (const c of clipReports) {
    if (c.durationSec < 9.0 || c.durationSec > 11.0) {
      warnings.push(`[${c.id}] Duration ${c.durationSec.toFixed(2)}s is outside the expected 9.0s - 11.0s window.`);
    }
  }

  // Resolution, fps, pixel format differences
  const firstW = clipReports[0].width;
  const firstH = clipReports[0].height;
  const firstFps = clipReports[0].fps;
  const firstPix = clipReports[0].pixFmt;

  for (const c of clipReports) {
    if (c.width !== firstW || c.height !== firstH) {
      warnings.push(`[${c.id}] Resolution ${c.width}x${c.height} differs from C01 (${firstW}x${firstH}).`);
    }
    if (Math.abs(c.fps - firstFps) > 0.01) {
      warnings.push(`[${c.id}] FPS ${c.fps.toFixed(2)} differs from C01 (${firstFps.toFixed(2)}).`);
    }
    if (c.pixFmt !== firstPix) {
      warnings.push(`[${c.id}] Pixel format '${c.pixFmt}' differs from C01 ('${firstPix}').`);
    }
    if (c.dar !== '16:9' && (c.width / c.height).toFixed(3) !== (16 / 9).toFixed(3)) {
      warnings.push(`[${c.id}] Aspect ratio (${c.dar || `${c.width}:${c.height}`}) is not 16:9.`);
    }
    if (c.rotation !== 0) {
      warnings.push(`[${c.id}] Rotation is ${c.rotation} (expected 0).`);
    }
  }

  // Seam differences above 3.0
  for (const s of seamReports) {
    if (s.meanAbsoluteDifference !== null && s.meanAbsoluteDifference >= 3.0) {
      warnings.push(`[Seam ${s.fromClip} -> ${s.toClip}] Seam difference is ${s.meanAbsoluteDifference} (${s.assessment}).`);
    }
  }

  // Audio presence note
  const clipsWithAudio = clipReports.filter(c => c.hasAudio);
  if (clipsWithAudio.length > 0) {
    warnings.push(`Note: Audio stream detected on ${clipsWithAudio.length} clips (${clipsWithAudio.map(c => c.id).join(', ')}). Per specification, audio will be discarded during extraction.`);
  }

  const isUpscaleTo4K = firstW < 3840 || firstH < 2160;

  // Build JSON Report
  const reportJson = {
    generatedAt: new Date().toISOString(),
    environment: {
      node: process.version,
      ffmpeg: ffmpegVer,
      ffprobe: ffprobeVer,
      os: process.platform
    },
    summary: {
      clipCount: clipReports.length,
      totalDurationSec: Number(totalDurationSec.toFixed(3)),
      totalSourceFrames,
      exportFps,
      expectedFramesAtExportFpsRaw: totalExpectedFramesAt12FpsRaw,
      sourceResolution: `${firstW}x${firstH}`,
      isUpscaleTo4K,
      warningsCount: warnings.length
    },
    clips: clipReports,
    seams: seamReports,
    warnings
  };

  // Ensure analysis folder exists
  const analysisDir = path.join(rootDir, 'analysis');
  if (!fs.existsSync(analysisDir)) {
    fs.mkdirSync(analysisDir, { recursive: true });
  }

  const jsonPath = path.join(analysisDir, 'assets-report.json');
  fs.writeFileSync(jsonPath, JSON.stringify(reportJson, null, 2), 'utf8');
  console.log(`\nWritten JSON report: ${jsonPath}`);

  // Build Markdown Report
  let md = `# Aurelia House: Phase A Asset Analysis Report\n\n`;
  md += `**Generated:** ${new Date().toISOString()}  \n`;
  md += `**Environment:** Node ${process.version} | ${ffmpegVer} | ${ffprobeVer}  \n`;
  md += `**Source Resolution:** ${firstW}x${firstH} (${isUpscaleTo4K ? '**Below 3840x2160: Phase B 4K extraction is an UPSCALE**' : 'Native 4K'})  \n`;
  md += `**Total Duration:** ${totalDurationSec.toFixed(2)}s across ${clipReports.length} clips  \n`;
  md += `**Source Frames:** ${totalSourceFrames} frames @ ${firstFps.toFixed(2)} fps  \n`;
  md += `**Expected Frames @ ${exportFps} fps:** ~${totalExpectedFramesAt12FpsRaw} frames (before seam deduplication)  \n\n`;

  md += `## 1. Clips Summary Table\n\n`;
  md += `| Clip | Folder / Title | File | Resolution | FPS | Frames | Duration | Audio | Seam to Next (MAD) | Seam Quality |\n`;
  md += `|---|---|---|---|---|---|---|---|---|---|\n`;

  for (const c of clipReports) {
    const seamScore = c.seamScoreToNext !== null ? c.seamScoreToNext.toFixed(3) : '—';
    const seamQuality = c.seamAssessmentToNext;
    md += `| **${c.id}** | ${c.name} | \`${c.fileName}\` | ${c.width}x${c.height} | ${c.fps.toFixed(0)} | ${c.frameCount} | ${c.durationSec.toFixed(2)}s | ${c.hasAudio ? c.audioCodec : 'No'} | ${seamScore} | ${seamQuality} |\n`;
  }

  md += `\n## 2. Seam Transitions Analysis\n\n`;
  md += `Boundary test: Last frame of $C_n$ compared with First frame of $C_{n+1}$ at 480x270 using Mean Absolute Difference (0 to 255).\n\n`;
  md += `| Transition | From Frame | To Frame | MAD Score | Assessment |\n`;
  md += `|---|---|---|---|---|\n`;
  for (const s of seamReports) {
    md += `| **${s.fromClip} &rarr; ${s.toClip}** | ${s.fromFrame} | ${s.toFrame} | ${s.meanAbsoluteDifference.toFixed(3)} | ${s.assessment} |\n`;
  }

  md += `\n## 3. Warnings and Observations\n\n`;
  if (warnings.length === 0) {
    md += `*No warnings detected. All clips conform to expected constraints.*\n`;
  } else {
    for (const w of warnings) {
      md += `- ${w}\n`;
    }
  }

  md += `\n## 4. Upscale Statement for Phase B\n\n`;
  if (isUpscaleTo4K) {
    md += `> **IMPORTANT NOTE:** The source video clips are **1920x1080 (1080p)**. Extracting to 3840x2160 in Phase B is an upscale using the Lanczos algorithm. Effective visual detail is bounded by the 1080p source material.\n`;
  } else {
    md += `> The source clips are native 4K (3840x2160).\n`;
  }

  const mdPath = path.join(analysisDir, 'assets-report.md');
  fs.writeFileSync(mdPath, md, 'utf8');
  console.log(`Written Markdown report: ${mdPath}`);

  console.log('\n=============================================');
  console.log('Phase A Analysis complete. Ready for GATE A.');
  console.log('=============================================\n');
}

main().catch(err => {
  console.error('\nFATAL ERROR in analyze-assets:', err);
  process.exit(1);
});
