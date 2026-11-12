import { useState, useEffect } from 'react';
import { Textarea, RadioGroup, type RadioOption } from './FieldPrimitives';
import { MediaSelector, type MediaFile } from './MediaSelector';

export interface FacebookMetadata {
  caption: string;
  mediaIntent: 'video' | 'reel' | 'image';
  media: MediaFile | null;
}

export interface FacebookEditorProps {
  initialMetadata?: Partial<FacebookMetadata>;
  onChange: (metadata: FacebookMetadata) => void;
  disabled?: boolean;
  resetKey?: number;
}

const FACEBOOK_CAPTION_MAX = 63206;

const mediaIntentOptions: RadioOption[] = [
  { value: 'video', label: 'Video', description: 'Standard Facebook Page video post' },
  { value: 'reel', label: 'Reels', description: 'Vertical short-form (9:16), 3–90 seconds, up to 1080×1920' },
  { value: 'image', label: 'Single image', description: 'Single photo post with caption' },
];

export function FacebookEditor({ initialMetadata = {}, onChange, disabled = false, resetKey = 0 }: FacebookEditorProps) {
  const [caption, setCaption] = useState(initialMetadata.caption || '');
  const [mediaIntent, setMediaIntent] = useState<'video' | 'reel' | 'image'>(initialMetadata.mediaIntent || 'video');
  const [media, setMedia] = useState<MediaFile | null>(initialMetadata.media || null);

  useEffect(() => {
    setCaption(initialMetadata.caption || '');
    setMediaIntent(initialMetadata.mediaIntent || 'video');
    // Note: We don't auto-reset media here - the parent CreateContentPage handles
    // media compatibility when mediaIntent changes
  }, [resetKey, initialMetadata.caption, initialMetadata.mediaIntent]);

  const validateCaption = (value: string) => {
    if (value.length > FACEBOOK_CAPTION_MAX) return `Caption must be ${FACEBOOK_CAPTION_MAX} characters or fewer`;
    return undefined;
  };

  const handleCaptionChange = (value: string) => {
    setCaption(value);
    onChange({ caption: value, mediaIntent, media });
  };

  const handleMediaIntentChange = (value: 'video' | 'reel' | 'image') => {
    setMediaIntent(value);
    onChange({ caption, mediaIntent: value, media });
  };

  const handleMediaChange = (newMedia: MediaFile | null) => {
    setMedia(newMedia);
    onChange({ caption, mediaIntent, media: newMedia });
  };

  const captionError = validateCaption(caption);

  const isValid = !captionError && caption.trim().length > 0;

  const isVideoIntent = mediaIntent === 'video' || mediaIntent === 'reel';
  const mediaType = isVideoIntent ? 'video' : 'image';
  const accept = isVideoIntent ? '.mp4,.mov,video/mp4,video/quicktime' : 'image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp';
  const mediaLabel = isVideoIntent ? 'Video' : 'Image';
  const helperText = isVideoIntent
    ? 'Select a video file (.mp4, .mov). Preliminary validation only; server-side validation applies on upload.'
    : 'Select a single image (JPEG, PNG, WebP). Multiple images not supported in MVP.';

  return (
    <div className="editor-section facebook-editor">
      <div className="editor-header">
        <div className="platform-badge platform-badge--facebook">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
          </svg>
          <span>Facebook</span>
        </div>
        <div className="validation-status" aria-live="polite">
          {isValid ? (
            <span className="validation-status--valid">Ready to review</span>
          ) : (
            <span className="validation-status--invalid">Complete required fields</span>
          )}
        </div>
      </div>

      <div className="editor-fields">
        <RadioGroup
          label="Media intent"
          value={mediaIntent}
          onChange={handleMediaIntentChange}
          options={mediaIntentOptions}
          orientation="horizontal"
          helperText="Video and Reels use the same caption field. Single image posts share this metadata form."
          disabled={disabled}
        />

        <MediaSelector
          label={mediaLabel}
          accept={accept}
          mediaType={mediaType}
          onChange={handleMediaChange}
          currentFile={media}
          helperText={helperText}
          error={media && isVideoIntent && mediaType === 'image' ? 'Selected file is an image, not a video. Please remove or replace it.' : media && !isVideoIntent && mediaType === 'video' ? 'Selected file is a video, not an image. Please remove or replace it.' : undefined}
          disabled={disabled}
        />

        <Textarea
          label="Caption / Message"
          value={caption}
          onChange={handleCaptionChange}
          placeholder="Write your caption..."
          rows={5}
          maxLength={FACEBOOK_CAPTION_MAX}
          showCharCount
          error={captionError}
          helperText={mediaIntent === 'reel' ? 'This caption becomes the Reel description.' : mediaIntent === 'image' ? 'This caption accompanies your photo.' : 'Supports line breaks, mentions, and hashtags.'}
          required
          disabled={disabled}
        />
      </div>
    </div>
  );
}