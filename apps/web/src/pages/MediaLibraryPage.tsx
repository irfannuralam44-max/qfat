import { useCallback, useEffect, useRef, useState } from 'react';
import { securityClient } from '../security/client';

interface MediaItem {
  id: string;
  originalFilename: string;
  mediaType: 'video' | 'image';
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}

type LoadState =
  | { status: 'loading' }
  | { status: 'loaded'; items: MediaItem[] }
  | { status: 'error'; message: string };

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = bytes / Math.pow(1024, i);
  return `${size.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function MediaLibraryPage() {
  const [loadState, setLoadState] = useState<LoadState>({ status: 'loading' });
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [detail, setDetail] = useState<MediaItem | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<MediaItem | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoadState({ status: 'loading' });
    try {
      const data = await securityClient.requestRead<{ items: MediaItem[] }>('/api/v1/media');
      setLoadState({ status: 'loaded', items: data.items ?? [] });
    } catch (err) {
      setLoadState({ status: 'error', message: err instanceof Error ? err.message : 'Failed to load media.' });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    event.target.value = '';
    if (!file) return;
    setSelectedFile(file);
    setUploadError(null);
    setUploadSuccess(null);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    setUploading(true);
    setUploadError(null);
    setUploadSuccess(null);
    try {
      const csrfToken = await securityClient.getCsrfTokenOrBootstrap();
      const response = await fetch('/api/v1/media', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'X-CSRF-Token': csrfToken,
          'X-File-Name': encodeURIComponent(selectedFile.name),
          'Content-Type': selectedFile.type || 'application/octet-stream',
        },
        body: selectedFile,
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Upload failed.' }));
        throw new Error(err.error || `Upload failed (${response.status}).`);
      }
      const record = (await response.json()) as MediaItem;
      setUploadSuccess(`Uploaded ${record.originalFilename}.`);
      setSelectedFile(null);
      await load();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (item: MediaItem) => {
    setDeletingId(item.id);
    try {
      await securityClient.requestWithCsrf(`/api/v1/media/${item.id}`, { method: 'DELETE' });
      setConfirmDelete(null);
      await load();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Delete failed.');
    } finally {
      setDeletingId(null);
    }
  };

  const items = loadState.status === 'loaded' ? loadState.items : [];

  return (
    <div className="page-content">
      <nav aria-label="Breadcrumb">
        <ol className="breadcrumb">
          <li><a href="/">Workspace</a></li>
          <li className="breadcrumb-divider" aria-hidden="true">/</li>
          <li aria-current="page">Media Library</li>
        </ol>
      </nav>

      <section className="page-intro" aria-labelledby="page-title">
        <div>
          <p className="section-kicker">MEDIA</p>
          <h1 id="page-title">Media Library</h1>
          <p className="page-description">
            Upload, browse, inspect, and delete locally stored media. Records reflect the backend state.
          </p>
        </div>
        <div className="local-context-pill">
          <span className="local-context-pulse" aria-hidden="true" />
          Local-first
        </div>
      </section>

      <section className="card" aria-labelledby="upload-title">
        <h2 id="upload-title">Upload media</h2>
        <div className="field-wrapper">
          <input
            ref={fileInputRef}
            type="file"
            accept="video/mp4,video/quicktime,video/webm,image/jpeg,image/png,image/webp"
            onChange={handleFileChange}
            disabled={uploading}
          />
        </div>
        {selectedFile && (
          <p className="field-helper">
            Selected: {selectedFile.name} ({formatFileSize(selectedFile.size)})
          </p>
        )}
        <div className="editor-actions">
          <button
            type="button"
            className="btn btn--primary"
            onClick={handleUpload}
            disabled={!selectedFile || uploading}
          >
            {uploading ? 'Uploading…' : 'Upload'}
          </button>
        </div>
        {uploading && (
          <p className="field-helper" aria-live="polite">Uploading… please wait.</p>
        )}
        {uploadSuccess && <p className="field-helper" role="status">{uploadSuccess}</p>}
        {uploadError && <p className="field-error" role="alert">{uploadError}</p>}
      </section>

      <section className="card" aria-labelledby="library-title">
        <div className="card-heading-row">
          <h2 id="library-title">Stored media</h2>
          <button type="button" className="retry-button" onClick={() => void load()} disabled={loadState.status === 'loading'}>
            Refresh
          </button>
        </div>

        {loadState.status === 'loading' && <p>Loading media…</p>}

        {loadState.status === 'error' && (
          <div>
            <p className="field-error" role="alert">{loadState.message}</p>
            <button type="button" className="retry-button" onClick={() => void load()}>Retry</button>
          </div>
        )}

        {loadState.status === 'loaded' && items.length === 0 && (
          <div className="empty-state" role="status">
            <p>No media stored yet. Upload a video or image to get started.</p>
          </div>
        )}

        {loadState.status === 'loaded' && items.length > 0 && (
          <ul className="media-list">
            {items.map((item) => (
              <li key={item.id} className="media-list-item">
                <div>
                  <strong>{item.originalFilename}</strong>
                  <p className="field-helper">
                    {item.mediaType} · {item.mimeType} · {formatFileSize(item.sizeBytes)} · {new Date(item.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="editor-actions">
                  <button type="button" className="btn btn--secondary" onClick={() => setDetail(item)}>
                    Details
                  </button>
                  <button
                    type="button"
                    className="btn btn--secondary"
                    onClick={() => setConfirmDelete(item)}
                    disabled={deletingId === item.id}
                  >
                    {deletingId === item.id ? 'Deleting…' : 'Delete'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {detail && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="detail-title">
          <div className="modal-card">
            <h2 id="detail-title">Media details</h2>
            <dl>
              <dt>ID</dt><dd>{detail.id}</dd>
              <dt>Name</dt><dd>{detail.originalFilename}</dd>
              <dt>Type</dt><dd>{detail.mediaType}</dd>
              <dt>MIME</dt><dd>{detail.mimeType}</dd>
              <dt>Size</dt><dd>{formatFileSize(detail.sizeBytes)}</dd>
              <dt>Created</dt><dd>{new Date(detail.createdAt).toLocaleString()}</dd>
            </dl>
            <button type="button" className="btn btn--secondary" onClick={() => setDetail(null)}>Close</button>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
          <div className="modal-card">
            <h2 id="confirm-title">Delete media?</h2>
            <p>This will permanently remove {confirmDelete.originalFilename} from the library.</p>
            <div className="editor-actions">
              <button type="button" className="btn btn--secondary" onClick={() => setConfirmDelete(null)} disabled={deletingId !== null}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => handleDelete(confirmDelete)}
                disabled={deletingId !== null}
              >
                {deletingId ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}