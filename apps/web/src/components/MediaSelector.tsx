import { useState, useCallback, useEffect, useId, type ChangeEvent, forwardRef } from 'react';

export type MediaType = 'video' | 'image';

export interface MediaFile {
  file: File;
  name: string;
  size: number;
  type: string;
  previewUrl?: string;
}

export interface MediaSelectionState {
  file: MediaFile | null;
  error: string | undefined;
}

interface MediaSelectorProps {
  label: string;
  accept: string;
  mediaType: MediaType;
  onChange: (file: MediaFile | null) => void;
  disabled?: boolean;
  currentFile?: MediaFile | null;
  helperText?: string;
  error?: string;
  required?: boolean;
  id?: string;
  resetKey?: number;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = bytes / Math.pow(1024, i);
  return `${size.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function isVideoFile(file: File): boolean {
  return file.type.startsWith('video/');
}

function isImageFile(file: File): boolean {
  return file.type.startsWith('image/');
}

function validateFile(file: File | null, accept: string, mediaType: MediaType): string | undefined {
  if (!file) return undefined;

  if (file.size === 0) {
    return 'File is empty (zero bytes). Please select a valid file.';
  }

  const acceptTypes = accept.split(',').map(t => t.trim());
  const extMatch = acceptTypes.some(t => {
    if (t.startsWith('.')) {
      return file.name.toLowerCase().endsWith(t.toLowerCase());
    }
    return file.type.startsWith(t.replace('*', ''));
  });

  if (!extMatch) {
    const allowed = acceptTypes.filter(t => t.startsWith('.')).join(', ');
    return `Unsupported file type. Allowed: ${allowed}`;
  }

  if (mediaType === 'video' && !isVideoFile(file)) {
    return 'Please select a valid video file.';
  }

  if (mediaType === 'image' && !isImageFile(file)) {
    return 'Please select a valid image file (JPEG, PNG, or WebP).';
  }

  return undefined;
}

export const MediaSelector = forwardRef<HTMLDivElement, MediaSelectorProps>(
  ({ label, accept, mediaType, onChange, disabled = false, currentFile, helperText, error: propError, required, id: providedId, resetKey = 0 }, ref) => {
    const [inputError, setInputError] = useState<string | undefined>(undefined);
    const generatedId = useId();
    const id = providedId || generatedId;
    const inputId = `${id}-input`;
    const errorId = `${id}-error`;
    const helperId = `${id}-helper`;
    const previewId = `${id}-preview`;

    const combinedError = propError || inputError;
    const file = currentFile || null;

    // The parent owns the File and its object URL. Revoke the URL whenever that
    // selection is replaced, cleared, or this selector unmounts.
    useEffect(() => {
      setInputError(undefined);
    }, [resetKey]);

    useEffect(() => {
      const ownedPreviewUrl = currentFile?.previewUrl;
      return () => {
        if (ownedPreviewUrl) URL.revokeObjectURL(ownedPreviewUrl);
      };
    }, [currentFile?.previewUrl]);

    const handleFileSelect = useCallback((e: ChangeEvent<HTMLInputElement>) => {
      const selectedFile = e.target.files?.[0] || null;
      e.target.value = '';

      if (!selectedFile) {
        setInputError(undefined);
        onChange(null);
        return;
      }

      const validationError = validateFile(selectedFile, accept, mediaType);
      if (validationError) {
        setInputError(validationError);
        onChange(null);
        return;
      }

      const previewUrl = mediaType === 'image' ? URL.createObjectURL(selectedFile) : undefined;
      const mediaFile: MediaFile = {
        file: selectedFile,
        name: selectedFile.name,
        size: selectedFile.size,
        type: selectedFile.type,
        previewUrl,
      };

      setInputError(undefined);
      onChange(mediaFile);
    }, [accept, mediaType, onChange]);

    const handleRemove = useCallback(() => {
      setInputError(undefined);
      onChange(null);
    }, [onChange]);

    return (
      <div className="field-wrapper media-selector" ref={ref}>
        <label htmlFor={inputId} className="field-label">
          {label}
          {required && <span className="field-required" aria-hidden="true">*</span>}
        </label>

        <div className={`media-input-wrapper ${combinedError ? 'media-input-wrapper--error' : ''} ${disabled ? 'media-input-wrapper--disabled' : ''}`}>
          <input
            id={inputId}
            type="file"
            className="media-input"
            accept={accept}
            onChange={handleFileSelect}
            disabled={disabled}
            aria-describedby={combinedError ? errorId : helperId}
            aria-invalid={combinedError ? 'true' : 'false'}
            hidden
          />

          {!file && (
            <button
              type="button"
              className="media-select-btn"
              onClick={() => document.getElementById(inputId)?.click()}
              disabled={disabled}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="12" y1="18" x2="12" y2="12" />
                <line x1="9" y1="15" x2="15" y2="15" />
              </svg>
              <span>Select {mediaType === 'video' ? 'video' : 'image'}</span>
            </button>
          )}

          {file && (
            <div className="media-selected" id={previewId}>
              {mediaType === 'image' && file.previewUrl && (
                <div className="media-preview-image">
                  <img src={file.previewUrl} alt={`Preview of ${file.name}`} />
                </div>
              )}

              {mediaType === 'video' && (
                <div className="media-preview-video" aria-label="Video file preview placeholder">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polygon points="23 7 16 12 23 17 23 7" />
                    <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                  </svg>
                </div>
              )}

              <div className="media-file-info">
                <p className="media-file-name" title={file.name}>{file.name}</p>
                <p className="media-file-details">
                  {formatFileSize(file.size)} · {file.type || 'Unknown type'}
                </p>
              </div>

              <button
                type="button"
                className="media-remove-btn"
                onClick={handleRemove}
                disabled={disabled}
                aria-label={`Remove selected ${mediaType}`}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          )}
        </div>

        {combinedError && <p id={errorId} className="field-error" role="alert">{combinedError}</p>}
        {helperText && !combinedError && <p id={helperId} className="field-helper">{helperText}</p>}
        <p className="media-note" aria-live="polite">
          Selected file remains in this browser page's memory. It has not been uploaded or saved to the QFAT media library.
        </p>
      </div>
    );
  }
);

MediaSelector.displayName = 'MediaSelector';

export { formatFileSize, validateFile, isVideoFile, isImageFile };
