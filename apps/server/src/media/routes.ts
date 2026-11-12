import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createMutationGuard, validateRequestOriginAndHost } from '../security/routes.js';
import { parseSessionCookie, hashSessionId, sessionStore } from '../security/index.js';
import { getMediaRecord, listMediaRecords, storeUploadedImageOrVideo, deleteMedia, MAX_UPLOAD_BYTES, sanitizeFilename } from './storage.js';
import type { Database } from 'better-sqlite3';

interface MediaResponse {
  id: string;
  originalFilename: string;
  mediaType: 'video' | 'image';
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}

function toResponse(row: any): MediaResponse {
  return {
    id: row.id,
    originalFilename: row.originalFilename ?? row.original_filename,
    mediaType: row.mediaType ?? row.media_type,
    mimeType: row.mimeType ?? row.mime_type,
    sizeBytes: row.sizeBytes ?? row.size_bytes,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : new Date(row.createdAt).toISOString(),
  };
}

async function readGuard(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const originValidation = validateRequestOriginAndHost(request);
  if (!originValidation.isValid) {
    reply.status(403).send({ error: originValidation.error || 'Invalid Origin/Host' });
    return;
  }
  const cookieHeader = (request.headers['cookie'] as string | undefined) ?? undefined;
  const sessionId = parseSessionCookie(cookieHeader);
  if (!sessionId) {
    reply.header('Set-Cookie', 'qfat_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');
    reply.status(401).send({ error: 'Missing or malformed authentication cookie' });
    return;
  }
  const session = sessionStore.get(hashSessionId(sessionId));
  if (!session) {
    reply.header('Set-Cookie', 'qfat_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');
    reply.status(401).send({ error: 'Invalid or expired authentication' });
    return;
  }
}

export async function registerMediaRoutes(
  app: FastifyInstance,
  deps: { db: Database; mediaDir: string },
): Promise<void> {
  const { db, mediaDir } = deps;
  const mutationGuard = createMutationGuard();

  // Allow raw streaming bodies without Fastify buffering
  app.addContentTypeParser('*', (_request, _payload, done) => {
    done(null, undefined);
  });

  // List (bounded; default limit 100, max 500)
  app.get('/api/v1/media', { preHandler: readGuard }, async (request, reply) => {
    const query = request.query as { limit?: string; offset?: string };
    const limit = query.limit ? Number(query.limit) : 100;
    const offset = query.offset ? Number(query.offset) : 0;
    if (!Number.isFinite(limit) || !Number.isFinite(offset) || limit < 1 || offset < 0) {
      return reply.status(400).send({ error: 'Invalid pagination parameters' });
    }
    const rows = await listMediaRecords(db, limit, offset);
    return reply.send({ items: rows.map(toResponse), limit: Math.min(Math.max(1, Math.trunc(limit)), 500), offset: Math.max(0, Math.trunc(offset)) });
  });

  // Detail
  app.get<{ Params: { mediaId: string } }>('/api/v1/media/:mediaId', { preHandler: readGuard }, async (request, reply) => {
    const row = await getMediaRecord(db, request.params.mediaId);
    if (!row) {
      return reply.status(404).send({ error: 'Media not found' });
    }
    return reply.send(toResponse(row));
  });

  // Upload (streaming)
  app.post('/api/v1/media', { preHandler: mutationGuard }, async (request, reply) => {
    try {
      const filenameHeader = request.headers['x-file-name'];
      const filename = typeof filenameHeader === 'string' ? decodeURIComponent(filenameHeader) : (request.query as any)?.filename;
      const originalFilename = sanitizeFilename(filename ?? null);

      const stream = request.raw;
      const record = await storeUploadedImageOrVideo(db, mediaDir, stream, originalFilename, request.raw as any);

      return reply.status(201).send(toResponse(record));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed';
      // Map common errors
      if (message.includes('exceeds maximum')) {
        return reply.status(413).send({ error: message });
      }
      if (message.includes('Empty file') || message.includes('Unsupported') || message.includes('unrecognized')) {
        return reply.status(415).send({ error: message });
      }
      if (message.includes('aborted') || message.includes('aborted')) {
        return reply.status(400).send({ error: 'Upload interrupted' });
      }
      return reply.status(500).send({ error: 'Upload failed' });
    }
  });

  // Delete
  app.delete<{ Params: { mediaId: string } }>('/api/v1/media/:mediaId', { preHandler: mutationGuard }, async (request, reply) => {
    try {
      const ok = await deleteMedia(db, mediaDir, request.params.mediaId);
      if (!ok) {
        return reply.status(404).send({ error: 'Media not found' });
      }
      return reply.status(204).send();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Delete failed';
      return reply.status(500).send({ error: 'Delete failed' });
    }
  });
}