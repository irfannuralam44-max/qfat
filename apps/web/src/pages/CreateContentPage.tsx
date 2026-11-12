import { useState, useCallback, useEffect } from 'react';
import { YouTubeEditor, type YouTubeMetadata } from '../components/YouTubeEditor';
import { FacebookEditor, type FacebookMetadata } from '../components/FacebookEditor';
import { type MediaFile } from '../components/MediaSelector';

export type Platform = 'youtube' | 'facebook';

const initialYouTubeMetadata: YouTubeMetadata = {
  title: '',
  description: '',
  tags: [],
  contentIntent: 'video',
  media: null,
};

const initialFacebookMetadata: FacebookMetadata = {
  caption: '',
  mediaIntent: 'video',
  media: null,
};

function isVideoFile(file: MediaFile | null): boolean {
  return file?.type.startsWith('video/') ?? false;
}

function isImageFile(file: MediaFile | null): boolean {
  return file?.type.startsWith('image/') ?? false;
}

export function CreateContentPage() {
  const [activePlatform, setActivePlatform] = useState<Platform>('youtube');
  const [youtubeMetadata, setYoutubeMetadata] = useState<YouTubeMetadata>(initialYouTubeMetadata);
  const [facebookMetadata, setFacebookMetadata] = useState<FacebookMetadata>(initialFacebookMetadata);
  const [resetKey, setResetKey] = useState(0);

  const handleYouTubeChange = useCallback((metadata: YouTubeMetadata) => {
    setYoutubeMetadata(metadata);
  }, []);

  const handleFacebookChange = useCallback((metadata: FacebookMetadata) => {
    setFacebookMetadata(metadata);
  }, []);

  const handlePlatformChange = (platform: Platform) => {
    setActivePlatform(platform);
  };

  // Handle media compatibility when Facebook media intent changes
  useEffect(() => {
    if (activePlatform !== 'facebook') return;

    const isVideoIntent = facebookMetadata.mediaIntent === 'video' || facebookMetadata.mediaIntent === 'reel';
    const currentMedia = facebookMetadata.media;

    if (!currentMedia) return;

    const currentIsVideo = isVideoFile(currentMedia);
    const currentIsImage = isImageFile(currentMedia);

    // If switching to video/Reels but have an image, or switching to image but have a video
    if ((isVideoIntent && currentIsImage) || (!isVideoIntent && currentIsVideo)) {
      // Don't auto-clear - let the user see the incompatibility and decide
      // The MediaSelector will show an error for incompatible files
    }
  }, [activePlatform, facebookMetadata.mediaIntent, facebookMetadata.media]);

  const hasAnyInput = () => {
    const youtubeHasInput =
      youtubeMetadata.title.trim() !== '' ||
      youtubeMetadata.description.trim() !== '' ||
      youtubeMetadata.tags.length > 0 ||
      youtubeMetadata.media !== null;
    const facebookHasInput =
      facebookMetadata.caption.trim() !== '' ||
      facebookMetadata.media !== null;
    return youtubeHasInput || facebookHasInput;
  };

  const handleReset = () => {
    if (!hasAnyInput()) return;
    if (window.confirm('Discard all entered metadata? This cannot be undone.')) {
      setYoutubeMetadata(initialYouTubeMetadata);
      setFacebookMetadata(initialFacebookMetadata);
      setResetKey((prev) => prev + 1);
    }
  };

  const renderPreview = () => {
    if (activePlatform === 'youtube') {
      return (
        <div className="preview-card youtube-preview">
          <div className="preview-header">
            <div className="preview-platform-icon youtube-icon" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M23.498 6.186a3.166 3.166 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.173 3.173 0 0 0 .504 6.186a33.2 33.2 0 0 0 0 11.628c.003.106.55 1.594 2.125 2.133 1.874.505 9.376.505 9.376.505s7.503 0 9.377-.505a3.159 3.159 0 0 0 2.124-2.133c.003-.106.55-1.594.55-1.594v-1.001a33.326 33.326 0 0 0-.001-11.627ZM9.545 15.568V8.432L15.818 12l-6.273 3.568Z" />
              </svg>
            </div>
            <div className="preview-platform-info">
              <strong>YouTube</strong>
              <span>{youtubeMetadata.contentIntent === 'short' ? 'Shorts' : 'Standard video'}</span>
            </div>
          </div>
          <div className="preview-content">
            <h3 className="preview-title">{youtubeMetadata.title || 'Enter a title…'}</h3>
            <p className="preview-description">{youtubeMetadata.description || 'Enter a description…'}</p>
            {youtubeMetadata.tags.length > 0 && (
              <div className="preview-tags" aria-label="Tags">
                {youtubeMetadata.tags.map((tag: string) => (
                  <span key={tag} className="preview-tag">#{tag}</span>
                ))}
              </div>
            )}
            {youtubeMetadata.media && (
              <div className="preview-media" aria-label="Selected video">
                <div className="media-placeholder media-placeholder--video" aria-hidden="true">
                  <span className="media-placeholder-icon">▭</span>
                  <span>{youtubeMetadata.media.name}</span>
                </div>
              </div>
            )}
          </div>
          <p className="preview-note">Media thumbnail, channel selection, and publishing actions will be available in subsequent phases.</p>
        </div>
      );
    }

    return (
      <div className="preview-card facebook-preview">
        <div className="preview-header">
          <div className="preview-platform-icon facebook-icon" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
            </svg>
          </div>
          <div className="preview-platform-info">
            <strong>Facebook</strong>
            <span>
              {facebookMetadata.mediaIntent === 'reel'
                ? 'Reel'
                : facebookMetadata.mediaIntent === 'image'
                ? 'Single image'
                : 'Video'}
            </span>
          </div>
        </div>
        <div className="preview-media-placeholder" aria-label={`Preview for ${facebookMetadata.mediaIntent}`}>
          {facebookMetadata.mediaIntent === 'reel' && (
            <div className="media-placeholder media-placeholder--reel" aria-hidden="true">
              <span className="media-placeholder-icon">▢</span>
              <span>Vertical 9:16</span>
            </div>
          )}
          {facebookMetadata.mediaIntent === 'image' && (
            <div className="media-placeholder media-placeholder--image" aria-hidden="true">
              <span className="media-placeholder-icon">□</span>
              <span>Single photo</span>
            </div>
          )}
          {facebookMetadata.mediaIntent === 'video' && (
            <div className="media-placeholder media-placeholder--video" aria-hidden="true">
              <span className="media-placeholder-icon">▭</span>
              <span>Standard video</span>
            </div>
          )}
        </div>
        {facebookMetadata.media && (
          <div className="preview-media" aria-label={`Selected ${facebookMetadata.mediaIntent === 'image' ? 'image' : 'video'}`}>
            {facebookMetadata.mediaIntent === 'image' && facebookMetadata.media.previewUrl && (
              <div className="media-placeholder media-placeholder--image" aria-hidden="true">
                <img src={facebookMetadata.media.previewUrl} alt={`Preview of ${facebookMetadata.media.name}`} style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: 'var(--radius-md)' }} />
              </div>
            )}
            {(facebookMetadata.mediaIntent === 'video' || facebookMetadata.mediaIntent === 'reel') && (
              <div className="media-placeholder media-placeholder--video" aria-hidden="true">
                <span className="media-placeholder-icon">▭</span>
                <span>{facebookMetadata.media.name}</span>
              </div>
            )}
          </div>
        )}
        <p className="preview-caption">{facebookMetadata.caption || 'Enter a caption…'}</p>
        <p className="preview-note">Media selection, Page selection, and publishing actions will be available in subsequent phases.</p>
      </div>
    );
  };

  return (
    <div className="create-content-page">
      <nav aria-label="Breadcrumb">
        <ol className="breadcrumb">
          <li><a href="/">Workspace</a></li>
          <li className="breadcrumb-divider" aria-hidden="true">/</li>
          <li aria-current="page">Create Content</li>
        </ol>
      </nav>

      <section className="page-intro" aria-labelledby="page-title">
        <div>
          <p className="section-kicker">PUBLISHING WORKFLOW</p>
          <h1 id="page-title">Create Content</h1>
          <p className="page-description">
            Prepare metadata for your video or image post. Select a platform, enter the details, and preview before publishing.
          </p>
        </div>
        <div className="local-context-pill">
          <span className="local-context-pulse" aria-hidden="true" />
          Local-first — no publishing yet
        </div>
      </section>

      <div className="create-content-layout">
        <div className="editor-pane">
          <div className="platform-switcher" role="tablist" aria-label="Select platform">
            <button
              role="tab"
              id="tab-youtube"
              aria-selected={activePlatform === 'youtube'}
              aria-controls="panel-youtube"
              className={`platform-tab ${activePlatform === 'youtube' ? 'platform-tab--active' : ''}`}
              onClick={() => handlePlatformChange('youtube')}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M23.498 6.186a3.166 3.166 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.173 3.173 0 0 0 .504 6.186a33.2 33.2 0 0 0 0 11.628c.003.106.55 1.594 2.125 2.133 1.874.505 9.376.505 9.376.505s7.503 0 9.377-.505a3.159 3.159 0 0 0 2.124-2.133c.003-.106.55-1.594.55-1.594v-1.001a33.326 33.326 0 0 0-.001-11.627ZM9.545 15.568V8.432L15.818 12l-6.273 3.568Z" />
              </svg>
              <span>YouTube</span>
            </button>
            <button
              role="tab"
              id="tab-facebook"
              aria-selected={activePlatform === 'facebook'}
              aria-controls="panel-facebook"
              className={`platform-tab ${activePlatform === 'facebook' ? 'platform-tab--active' : ''}`}
              onClick={() => handlePlatformChange('facebook')}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
              </svg>
              <span>Facebook</span>
            </button>
          </div>

          <div role="tabpanel" id="panel-youtube" aria-labelledby="tab-youtube" hidden={activePlatform !== 'youtube'}>
            <YouTubeEditor initialMetadata={youtubeMetadata} onChange={handleYouTubeChange} resetKey={resetKey} />
          </div>

          <div role="tabpanel" id="panel-facebook" aria-labelledby="tab-facebook" hidden={activePlatform !== 'facebook'}>
            <FacebookEditor initialMetadata={facebookMetadata} onChange={handleFacebookChange} resetKey={resetKey} />
          </div>

          <div className="editor-actions">
            <button type="button" className="btn btn--secondary" onClick={handleReset} disabled={!hasAnyInput()}>
              Clear form
            </button>
            <button type="button" className="btn btn--primary" disabled>
              Publish — coming soon
            </button>
          </div>

          <div className="phase-notice">
            <p>Account connections, media selection, destination selection, and publishing will be implemented in subsequent phases. This editor manages in-memory draft state only.</p>
          </div>
        </div>

        <aside className="preview-pane" aria-label="Metadata preview">
          <h2 className="preview-pane-title">Preview</h2>
          {renderPreview()}
        </aside>
      </div>
    </div>
  );
}