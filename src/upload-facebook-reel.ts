/**
 * Facebook Page **Reels** upload adapter.
 *
 * Reels use a different protocol from the long-form /videos endpoint
 * (see upload-facebook.ts). The three phases are:
 *   Phase 1 — start:  POST /{page-id}/video_reels?upload_phase=start  → video_id + upload_url
 *   Phase 2 — upload: POST the binary to the rupload host with offset/file_size headers
 *   Phase 3 — finish: POST /{page-id}/video_reels?upload_phase=finish with video_state + schedule
 *
 * Scheduling: video_state=SCHEDULED + scheduled_publish_time (Unix seconds).
 *
 * Reel requirements (enforced by Facebook, not validated here): 9:16 aspect,
 * 1080×1920 recommended, 3–90 s duration, .mp4.
 *
 * The file is streamed to the rupload host in bounded memory. Reels are short,
 * but the implementation does not read the entire file into one Buffer.
 */

import fs from 'node:fs';
import { Transform } from 'node:stream';
import { FB_GRAPH_BASE, FB_REELS_RUPLOAD_BASE } from './config.js';
import type { FacebookAccount } from './tokens.js';
import type { ResolvedMeta } from './manifest.js';

export interface FacebookReelUploadResult {
  videoId: string;
}

export interface FacebookReelUploadProgress {
  bytesSent: number;
  totalBytes: number;
}

export interface FacebookReelUploadOptions {
  progress?: (progress: FacebookReelUploadProgress) => void;
  immediate?: boolean;
  quiet?: boolean;
}

/**
 * Upload a video to a Facebook Page as a scheduled **Reel**.
 *
 * @param videoPath - Absolute path to the video file to upload.
 * @param meta      - Resolved manifest for the Facebook target.
 * @param account   - The authorized Page to post to (holds page_id + page_token).
 * @returns         Facebook Reel video ID.
 */
export async function uploadReelToFacebook(
  videoPath: string,
  meta: ResolvedMeta,
  account: FacebookAccount,
  options: FacebookReelUploadOptions = {},
): Promise<FacebookReelUploadResult> {
  const { page_id, page_token } = account;
  const fileSize = fs.statSync(videoPath).size;
  const immediate = options.immediate === true;

  // --------------------------------------------------------------------------
  // Phase 1: Start — initialize the Reel upload session.
  // --------------------------------------------------------------------------
  if (!options.quiet) console.log(`  [facebook/reel] Starting upload session (${fileSize} bytes)…`);

  const startBody = new URLSearchParams({
    upload_phase: 'start',
    access_token: page_token,
  });

  const startResp = await fetch(`${FB_GRAPH_BASE}/${page_id}/video_reels`, {
    method: 'POST',
    body:   startBody,
  });
  await assertOk(startResp, 'reel start phase');

  const startData = (await startResp.json()) as {
    video_id?:   string;
    upload_url?: string;
  };

  const videoId   = startData.video_id;
  if (!videoId) {
    throw new Error(`Facebook reel start phase returned no video_id: ${JSON.stringify(startData)}`);
  }
  // Prefer the upload_url the API hands back; fall back to the documented host.
  const uploadUrl = startData.upload_url ?? `${FB_REELS_RUPLOAD_BASE}/${videoId}`;

  // --------------------------------------------------------------------------
  // Phase 2: Upload — single-shot binary POST to the rupload host.
  // --------------------------------------------------------------------------
  if (!options.quiet) console.log('  [facebook/reel] Uploading video…');

  // Stream the file in bounded memory instead of reading it entirely into one Buffer.
  let bytesSent = 0;
  const uploadBody = fs.createReadStream(videoPath).pipe(new Transform({
    transform(chunk, _encoding, callback) {
      const size = Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(chunk);
      bytesSent += size;
      options.progress?.({ bytesSent, totalBytes: fileSize });
      callback(null, chunk);
    },
  }));

  const uploadResp = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'Authorization': `OAuth ${page_token}`,
      'offset':        '0',
      'file_size':     String(fileSize),
      'Content-Type':  'application/octet-stream',
    },
    body: uploadBody as any,
    duplex: 'half',
  });
  await assertOk(uploadResp, 'reel upload phase');
  options.progress?.({ bytesSent: fileSize, totalBytes: fileSize });

  // --------------------------------------------------------------------------
  // Phase 3: Finish — publish as SCHEDULED with the caption.
  // --------------------------------------------------------------------------
  if (!options.quiet) {
    console.log(immediate ? '  [facebook/reel] Finalising and publishing…' : '  [facebook/reel] Finalising and scheduling…');
  }

  const finishParams: Record<string, string> = {
    upload_phase: 'finish',
    video_id: videoId,
    video_state: immediate ? 'PUBLISHED' : 'SCHEDULED',
    description: meta.description,
    access_token: page_token,
  };
  if (!immediate) {
    finishParams.scheduled_publish_time = String(meta.publishAtUnix);
  }
  const finishBody = new URLSearchParams(finishParams);

  const finishResp = await fetch(`${FB_GRAPH_BASE}/${page_id}/video_reels`, {
    method: 'POST',
    body:   finishBody,
  });
  await assertOk(finishResp, 'reel finish phase');

  if (!options.quiet) {
    console.log(
      immediate
        ? `  [facebook/reel] Published video_id=${videoId}`
        : `  [facebook/reel] Scheduled video_id=${videoId} for Unix=${meta.publishAtUnix} (${meta.publishAtUTC})`
    );
  }

  return { videoId };
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

async function assertOk(resp: Response, phase: string): Promise<void> {
  if (!resp.ok) {
    const body = await resp.text();
    const safeBody = body.replace(/(access_token|page_token)=[^&\s]+/gi, '$1=<redacted>');
    throw new Error(`Facebook API error during ${phase} (HTTP ${resp.status}): ${safeBody}`);
  }
}
