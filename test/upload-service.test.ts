import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { google } from 'googleapis';
import { uploadToYouTube, type YouTubeUploadProgress } from '../src/upload-youtube.ts';
import { uploadToFacebook, type FacebookUploadProgress } from '../src/upload-facebook.ts';
import { uploadReelToFacebook, type FacebookReelUploadProgress } from '../src/upload-facebook-reel.ts';
import type { ResolvedMeta } from '../src/manifest.ts';

const meta: ResolvedMeta = {
  title: 'Test Title',
  description: 'Test description',
  tags: ['tag1'],
  categoryId: '22',
  publishAtUTC: '2026-11-14T10:00:00.000Z',
  publishAtUnix: 1763114400,
  madeForKids: false,
  playlistId: null,
  format: 'video',
};

const shortMeta: ResolvedMeta = { ...meta, format: 'short' };

function tempVideo(size = 128): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qfat-upload-'));
  const file = path.join(dir, 'clip.mp4');
  fs.writeFileSync(file, Buffer.alloc(size, 1));
  return file;
}

import http from 'node:http';

describe('QFAT-015 upload service boundary', () => {
  it('YouTube immediate publish uses public status, omits publishAt, and reports progress', async () => {
    const originalYoutube = google.youtube;
    const progress: YouTubeUploadProgress[] = [];
    let insertArgs: any;
    const thumbnailError = new Error('thumbnail failed');

    google.youtube = (() => ({
      videos: {
        insert: async (_args: any, opts: any) => {
          opts?.onUploadProgress?.({ bytesRead: 64 });
          opts?.onUploadProgress?.({ bytesRead: 128 });
          insertArgs = _args;
          return { data: { id: 'yt-123' } };
        },
      },
      thumbnails: { set: async () => { throw thumbnailError; } },
      playlistItems: { insert: async () => ({}) },
    })) as any;

    try {
      const video = tempVideo();
      const thumbnail = video.replace(/\.mp4$/, '.jpg');
      fs.writeFileSync(thumbnail, Buffer.alloc(4, 2));

      const result = await uploadToYouTube(video, meta, { refresh_token: 'refresh-token' }, {
        googleClient: { client_id: 'client-id', client_secret: 'client-secret' },
        immediate: true,
        quiet: true,
        progress: (p) => progress.push(p),
      });

      assert.equal(result.videoId, 'yt-123');
      assert.equal(result.url, 'https://www.youtube.com/watch?v=yt-123');
      assert.equal(result.thumbnailSet, false);
      assert.match(result.thumbnailError ?? '', /thumbnail failed/);
      assert.equal(insertArgs.requestBody.status.privacyStatus, 'public');
      assert.equal('publishAt' in insertArgs.requestBody.status, false);
      assert.deepEqual(progress, [
        { bytesSent: 64, totalBytes: 128 },
        { bytesSent: 128, totalBytes: 128 },
      ]);
    } finally {
      google.youtube = originalYoutube;
    }
  });

  it('YouTube scheduled path preserves legacy private + publishAt semantics', async () => {
    const originalYoutube = google.youtube;
    let insertArgs: any;
    google.youtube = (() => ({
      videos: { insert: async (args: any) => { insertArgs = args; return { data: { id: 'yt-456' } }; } },
      thumbnails: { set: async () => ({}) },
      playlistItems: { insert: async () => ({}) },
    })) as any;
    try {
      await uploadToYouTube(tempVideo(), meta, { refresh_token: 'refresh-token' }, {
        googleClient: { client_id: 'client-id', client_secret: 'client-secret' },
        quiet: true,
      });
      assert.equal(insertArgs.requestBody.status.privacyStatus, 'private');
      assert.equal(insertArgs.requestBody.status.publishAt, meta.publishAtUTC);
    } finally {
      google.youtube = originalYoutube;
    }
  });

  it('Facebook video immediate publish sends published=true and no schedule', async () => {
    const originalFetch = global.fetch;
    const calls: any[] = [];
    global.fetch = (async (url: any, init: any) => {
      calls.push({ url: String(url), body: init?.body });
      const phase = String(init?.body?.get?.('upload_phase') ?? '');
      if (phase === 'start') {
        return new Response(JSON.stringify({ upload_session_id: 'sess', video_id: 'fb-1', start_offset: '0', end_offset: '128' }), { status: 200 });
      }
      if (phase === 'transfer') {
        return new Response(JSON.stringify({ start_offset: '128', end_offset: '128' }), { status: 200 });
      }
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    }) as any;

    try {
      const progress: FacebookUploadProgress[] = [];
      const result = await uploadToFacebook(tempVideo(), meta, { page_id: 'page-1', page_token: 'page-token' }, {
        immediate: true,
        quiet: true,
        progress: (p) => progress.push(p),
      });
      assert.equal(result.videoId, 'fb-1');
      const finishCall = calls.find((c) => String(c.body?.get?.('upload_phase')) === 'finish');
      assert.ok(finishCall);
      assert.equal(finishCall.body.get('published'), 'true');
      assert.equal(finishCall.body.has('scheduled_publish_time'), false);
      assert.ok(progress.length >= 1);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('Facebook Reels immediate publish uses PUBLISHED and bounded stream', async () => {
    const originalFetch = global.fetch;
    let capturedBody: any;
    global.fetch = (async (url: any, init: any) => {
      if (String(url).includes('video_reels')) {
        const phase = new URLSearchParams(init?.body as any).get('upload_phase');
        if (phase === 'start') {
          return new Response(JSON.stringify({ video_id: 'reel-1', upload_url: 'https://upload.example/reel' }), { status: 200 });
        }
        return new Response(JSON.stringify({ success: true }), { status: 200 });
      }
      capturedBody = init?.body;
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    }) as any;

    try {
      const progress: FacebookReelUploadProgress[] = [];
      const result = await uploadReelToFacebook(tempVideo(1024), shortMeta, { page_id: 'page-1', page_token: 'page-token' }, {
        immediate: true,
        quiet: true,
        progress: (p) => progress.push(p),
      });
      assert.equal(result.videoId, 'reel-1');
      assert.ok(capturedBody && typeof capturedBody.pipe === 'function', 'Reels upload body should be a stream, not a Buffer');
      assert.equal(Buffer.isBuffer(capturedBody), false);
      const finishCalls = (global.fetch as any).mock?.calls ?? [];
      assert.ok(progress.length >= 1);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('provider errors are sanitized', async () => {
    const originalFetch = global.fetch;
    global.fetch = (async () => new Response('bad token access_token=secret', { status: 400 })) as any;
    try {
      await assert.rejects(
        uploadToFacebook(tempVideo(), meta, { page_id: 'page-1', page_token: 'page-token' }, { quiet: true }),
        /Facebook API error during start phase \(HTTP 400\): bad token access_token=<redacted>/
      );
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('quiet mode does not write CLI progress output', async () => {
    const originalFetch = global.fetch;
    const originalLog = console.log;
    const originalWrite = process.stdout.write.bind(process.stdout);
    let output = false;
    console.log = () => { output = true; return undefined as any; };
    process.stdout.write = () => { output = true; return true; };
    global.fetch = (async (_url: any, init: any) => {
      const phase = String(init?.body?.get?.('upload_phase') ?? '');
      if (phase === 'start') return new Response(JSON.stringify({ upload_session_id: 's', video_id: 'v', start_offset: '0', end_offset: '128' }), { status: 200 });
      if (phase === 'transfer') return new Response(JSON.stringify({ start_offset: '128', end_offset: '128' }), { status: 200 });
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    }) as any;
    try {
      await uploadToFacebook(tempVideo(), meta, { page_id: 'page-1', page_token: 'page-token' }, { immediate: true, quiet: true, progress: () => {} });
      assert.equal(output, false);
    } finally {
      global.fetch = originalFetch;
      console.log = originalLog;
      process.stdout.write = originalWrite as any;
    }
  });


  it('Reels uses Node fetch streaming against a real local HTTP server', async () => {
    const video = tempVideo(100000);
    const received: Buffer[] = [];
    let finishBody = '';
    const server = http.createServer((req, res) => {
      const url = new URL(req.url ?? '/', 'http://127.0.0.1');
      if (url.pathname.endsWith('/video_reels')) {
        const phase = url.searchParams.get('upload_phase');
        if (phase === 'start') {
          const uploadUrl = `http://127.0.0.1:${(server.address() as any).port}/upload`;
          res.setHeader('content-type', 'application/json');
          res.end(JSON.stringify({ video_id: 'reel-real', upload_url: uploadUrl }));
          return;
        }
        if (phase === 'finish') {
          let body = '';
          req.setEncoding('utf8');
          req.on('data', (chunk) => { body += chunk; });
          req.on('end', () => {
            finishBody = body;
            res.setHeader('content-type', 'application/json');
            res.end(JSON.stringify({ success: true }));
          });
          return;
        }
      }
      req.on('data', (chunk) => { received.push(Buffer.from(chunk)); });
      req.on('end', () => {
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({ success: true }));
      });
    });

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = (server.address() as any).port;
    const originalFetch = global.fetch;
    global.fetch = (async (url: any, init: any) => {
      if (String(url).includes('video_reels')) {
        const bodyPhase = init?.body instanceof URLSearchParams ? init.body.get('upload_phase') : null;
        const urlPhase = new URL(String(url)).searchParams.get('upload_phase');
        const phase = bodyPhase ?? urlPhase;
        if (phase === 'start') {
          const uploadUrl = `http://127.0.0.1:${port}/upload`;
          return new Response(JSON.stringify({ video_id: 'reel-real', upload_url: uploadUrl }), { status: 200 });
        }
        if (phase === 'finish') {
          finishBody = String(init?.body ?? '');
          return new Response(JSON.stringify({ success: true }), { status: 200 });
        }
      }
      return originalFetch(url, init);
    }) as any;

    const progress: { bytesSent: number; totalBytes: number }[] = [];
    try {
      const result = await uploadReelToFacebook(video, shortMeta, { page_id: 'page-1', page_token: 'page-token' }, {
        immediate: true,
        quiet: true,
        progress: (p) => progress.push(p),
      });
      assert.equal(result.videoId, 'reel-real');
      const totalReceived = received.reduce((n, b) => n + b.length, 0);
      assert.equal(totalReceived, 100000);
      assert.ok(progress.length > 0);
      assert.equal(progress.at(-1)?.bytesSent, 100000);
      assert.match(finishBody, /video_state=PUBLISHED/);
      assert.doesNotMatch(finishBody, /scheduled_publish_time/);
    } finally {
      server.close();
    }
  });

});
