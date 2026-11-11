import { useState } from 'react';
import { TextInput, Textarea, TagInput, RadioGroup, type RadioOption } from './FieldPrimitives';

export interface YouTubeMetadata {
  title: string;
  description: string;
  tags: string[];
  contentIntent: 'video' | 'short';
}

export interface YouTubeEditorProps {
  initialMetadata?: Partial<YouTubeMetadata>;
  onChange: (metadata: YouTubeMetadata) => void;
  disabled?: boolean;
}

const YOUTUBE_TITLE_MAX = 100;
const YOUTUBE_DESCRIPTION_MAX = 5000;
const YOUTUBE_TAGS_MAX = 500;
const YOUTUBE_MAX_TAGS = 30;

const contentIntentOptions: RadioOption[] = [
  { value: 'video', label: 'Standard video', description: 'Horizontal or any aspect ratio; full-length content' },
  { value: 'short', label: 'Shorts', description: 'Vertical (9:16), up to 3 minutes; auto-detected by YouTube' },
];

export function YouTubeEditor({ initialMetadata = {}, onChange, disabled = false }: YouTubeEditorProps) {
  const [title, setTitle] = useState(initialMetadata.title || '');
  const [description, setDescription] = useState(initialMetadata.description || '');
  const [tags, setTags] = useState(initialMetadata.tags || []);
  const [contentIntent, setContentIntent] = useState<'video' | 'short'>(initialMetadata.contentIntent || 'video');

  const validateTitle = (value: string) => {
    if (!value.trim()) return 'Title is required';
    if (value.length > YOUTUBE_TITLE_MAX) return `Title must be ${YOUTUBE_TITLE_MAX} characters or fewer`;
    return undefined;
  };

  const validateDescription = (value: string) => {
    if (value.length > YOUTUBE_DESCRIPTION_MAX) return `Description must be ${YOUTUBE_DESCRIPTION_MAX} characters or fewer`;
    return undefined;
  };

  const validateTags = (tagList: string[]) => {
    if (tagList.length > YOUTUBE_MAX_TAGS) return `Maximum ${YOUTUBE_MAX_TAGS} tags allowed`;
    if (tagList.some((t) => t.length > YOUTUBE_TAGS_MAX)) return `Each tag must be ${YOUTUBE_TAGS_MAX} characters or fewer`;
    return undefined;
  };

  const handleTitleChange = (value: string) => {
    setTitle(value);
    onChange({ title: value, description, tags, contentIntent });
  };

  const handleDescriptionChange = (value: string) => {
    setDescription(value);
    onChange({ title, description: value, tags, contentIntent });
  };

  const handleTagsChange = (newTags: string[]) => {
    setTags(newTags);
    onChange({ title, description, tags: newTags, contentIntent });
  };

  const handleContentIntentChange = (value: 'video' | 'short') => {
    setContentIntent(value);
    onChange({ title, description, tags, contentIntent: value });
  };

  const titleError = validateTitle(title);
  const descriptionError = validateDescription(description);
  const tagsError = validateTags(tags);

  const isValid = !titleError && !descriptionError && !tagsError && title.trim().length > 0;

  return (
    <div className="editor-section youtube-editor">
      <div className="editor-header">
        <div className="platform-badge platform-badge--youtube">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M23.498 6.186a3.166 3.166 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.173 3.173 0 0 0 .504 6.186a33.2 33.2 0 0 0 0 11.628c.003.106.55 1.594 2.125 2.133 1.874.505 9.376.505 9.376.505s7.503 0 9.377-.505a3.159 3.159 0 0 0 2.124-2.133c.003-.106.55-1.594.55-1.594v-1.001a33.326 33.326 0 0 0-.001-11.627ZM9.545 15.568V8.432L15.818 12l-6.273 3.568Z" />
          </svg>
          <span>YouTube</span>
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
        <TextInput
          label="Title"
          value={title}
          onChange={handleTitleChange}
          placeholder="Enter video title"
          maxLength={YOUTUBE_TITLE_MAX}
          showCharCount
          error={titleError}
          helperText="Required. Shown in search results and on the watch page."
          required
          disabled={disabled}
        />

        <Textarea
          label="Description"
          value={description}
          onChange={handleDescriptionChange}
          placeholder="Tell viewers about your video"
          rows={5}
          maxLength={YOUTUBE_DESCRIPTION_MAX}
          showCharCount
          error={descriptionError}
          helperText="Supports line breaks, hashtags, and links. First two lines appear before 'Show more'."
          disabled={disabled}
        />

        <TagInput
          label="Tags"
          tags={tags}
          onChange={handleTagsChange}
          placeholder="Add a tag and press Enter"
          maxTags={YOUTUBE_MAX_TAGS}
          maxTagLength={YOUTUBE_TAGS_MAX}
          error={tagsError}
          helperText="Descriptive keywords help discovery. Separate with commas or press Enter."
          disabled={disabled}
        />

        <RadioGroup
          label="Content intent"
          value={contentIntent}
          onChange={handleContentIntentChange}
          options={contentIntentOptions}
          orientation="vertical"
          helperText="YouTube classifies Shorts automatically based on aspect ratio and duration. This field adds a #Shorts hint to the description when set to Shorts."
          disabled={disabled}
        />
      </div>
    </div>
  );
}