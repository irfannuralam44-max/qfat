/**
 * YouTube video upload adapter.
 *
 * Uses the Data API v3 `videos.insert` endpoint with a resumable upload
 * (googleapis handles the chunked transfer and retry internally).
 *
 * After a successful video upload it optionally:
 *   - Sets a custom thumbnail (thumbnails.set).
 *   - Adds the video to a playlist (playlistItems.insert).
 */

import fs from 'node:fs';
import path from 'node:path';
import { google } from 'googleapis';
import { videoMimeType } from './video.js';
import { loadGoogleClient, type YouTubeAccount } from './tokens.js';
import type { ResolvedMeta } from './manifest.js';

export interface YouTubeUploadCredentials {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}

export interface YouTubeUploadProgress {
  bytesSent: number;
  totalBytes: number;
}

export interface YouTubeUploadOptions {
  /** Explicit Google OAuth client credentials. When omitted, Spoolcast's google-client.json is used for CLI compatibility. */
  googleClient?: {
    client_id: string;
    client_secret: string;
    redirect_uris?: string[];
  };
  /** Explicit refresh token. Overrides account.refresh_token when provided. */
  refreshToken?: string;
  /** Publish immediately instead of using meta.publishAtUTC. */
  immediate?: boolean;
  /** Optional progress callback receiving measured upload bytes. */
  progress?: (progress: YouTubeUploadProgress) => void;
  /** Suppress CLI progress/console output for service callers. */
  quiet?: boolean;
}

export interface YouTubeUploadResult {
  videoId: string;
  url: string;
  thumbnailSet?: boolean;
  thumbnailError?: string;
  playlistAdded?: boolean;
  playlistError?: string;
}

/**
 * Upload a video to YouTube.
 *
 * Legacy CLI callers use the default scheduled mode and Spoolcast's client file.
 * QFAT service callers pass explicit credentials/options and immediate=true.
 */

/**
 * Upload a video to YouTube as a private scheduled post.
 *
 * @param videoPath - Absolute path to the video file to upload.
 * @param meta      - Resolved manifest for the YouTube target.
 * @param account   - The authorized channel to upload to (holds the refresh token).
 * @returns         Video ID and canonical URL.
 */
export async function uploadToYouTube(
  videoPath: string,
  meta: ResolvedMeta,
  account: YouTubeAccount,
  options: YouTubeUploadOptions = {},
): Promise<YouTubeUploadResult> {
  const thumbnailPath = resolveThumbnail(videoPath);

  const creds = options.googleClient ?? await loadGoogleClient();
  const refreshToken = options.refreshToken ?? account.refresh_token;

  const oauth2Client = new google.auth.OAuth2(creds.client_id, creds.client_secret);
  oauth2Client.setCredentials({ refresh_token: refreshToken });

  const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

  const isShort = meta.format === 'short';
  if (!options.quiet) {
    console.log(`  [youtube] Uploading "${meta.title}"${isShort ? ' (Short)' : ''}…`);
  }

  const description = isShort ? appendShortsTag(meta.description) : meta.description;

  const videoStat = fs.statSync(videoPath);
  const immediate = options.immediate === true;

  const response = await youtube.videos.insert({
    part:          ['snippet', 'status'],
    notifySubscribers: false,
    requestBody: {
      snippet: {
        title:       meta.title,
        description,
        tags:        meta.tags,
        categoryId:  meta.categoryId,
      },
      status: {
        privacyStatus:             immediate ? 'public' : 'private',
        ...(immediate ? {} : { publishAt: meta.publishAtUTC }),
        selfDeclaredMadeForKids:   meta.madeForKids,
      },
    },
    media: {
      mimeType: videoMimeType(videoPath),
      body:     fs.createReadStream(videoPath),
    },
  }, {
    onUploadProgress: (evt: { bytesRead: number }) => {
      options.progress?.({ bytesSent: evt.bytesRead, totalBytes: videoStat.size });
      if (!options.quiet) {
        const pct = Math.round((evt.bytesRead / videoStat.size) * 100);
        process.stdout.write(`\r  [youtube] Upload progress: ${pct}%  `);
      }
    },
  });

  if (!options.quiet) {
    process.stdout.write('\n');
  }

  const videoId = response.data.id;
  if (!videoId) throw new Error('YouTube API did not return a video ID.');

  const url = `https://www.youtube.com/watch?v=${videoId}`;
  if (!options.quiet) {
    console.log(`  [youtube] Uploaded: ${url}${immediate ? '' : ` (scheduled ${meta.publishAtUTC})`}`);
  }

  const result: YouTubeUploadResult = { videoId, url };

  if (thumbnailPath) {
    if (!options.quiet) console.log('  [youtube] Setting thumbnail…');
    try {
      await youtube.thumbnails.set({
        videoId,
        media: {
          mimeType: 'image/jpeg',
          body:     fs.createReadStream(thumbnailPath),
        },
      });
      result.thumbnailSet = true;
      if (!options.quiet) console.log('  [youtube] Thumbnail set ✓');
    } catch (err) {
      result.thumbnailSet = false;
      result.thumbnailError = sanitizeProviderError(err);
      if (!options.quiet) console.warn(`  [youtube] Thumbnail failed: ${result.thumbnailError}`);
    }
  }

  if (meta.playlistId) {
    if (!options.quiet) console.log(`  [youtube] Adding to playlist ${meta.playlistId}…`);
    try {
      await youtube.playlistItems.insert({
        part: ['snippet'],
        requestBody: {
          snippet: {
            playlistId: meta.playlistId,
            resourceId: {
              kind:    'youtube#video',
              videoId,
            },
          },
        },
      });
      result.playlistAdded = true;
      if (!options.quiet) console.log('  [youtube] Added to playlist ✓');
    } catch (err) {
      result.playlistAdded = false;
      result.playlistError = sanitizeProviderError(err);
      if (!options.quiet) console.warn(`  [youtube] Playlist failed: ${result.playlistError}`);
    }
  }

  return result;
}

function sanitizeProviderError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  return message.replace(/(access_token|refresh_token|client_secret)=[^&\s]+/gi, '$1=<redacted>');
}

/**
 * Resolve the JPEG thumbnail for a video: prefer one named after the video's stem
 * (`clip.mp4` ⇒ `clip.jpg`) so per-video thumbnails work when a folder holds several
 * videos, then fall back to a shared sibling `thumbnail.jpg`. Returns null if neither
 * exists.
 */
function resolveThumbnail(videoPath: string): string | null {
  const dir  = path.dirname(videoPath);
  const stem = path.basename(videoPath, path.extname(videoPath));
  const named  = path.join(dir, `${stem}.jpg`);
  if (fs.existsSync(named)) return named;
  const shared = path.join(dir, 'thumbnail.jpg');
  if (fs.existsSync(shared)) return shared;
  return null;
}

/** Append a "#Shorts" hashtag to the description if not already present (case-insensitive). */
function appendShortsTag(description: string): string {
  if (/#shorts\b/i.test(description)) return description;
  return description.trim().length > 0 ? `${description}\n\n#Shorts` : '#Shorts';
}
