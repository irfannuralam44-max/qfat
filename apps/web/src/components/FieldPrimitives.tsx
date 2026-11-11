import { useId, type ChangeEvent, type FocusEvent, type KeyboardEvent, type RefObject, forwardRef } from 'react';

interface BaseFieldProps {
  id?: string;
  label: string;
  helperText?: string;
  error?: string;
  disabled?: boolean;
  required?: boolean;
  'aria-describedby'?: string;
}

interface TextInputProps extends BaseFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: 'text' | 'email' | 'url' | 'password';
  maxLength?: number;
  showCharCount?: boolean;
  autoComplete?: string;
  inputRef?: RefObject<HTMLInputElement>;
}

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(
  ({ id: providedId, label, helperText, error, disabled, required, placeholder, type = 'text', value, onChange, maxLength, showCharCount, autoComplete, 'aria-describedby': ariaDescribedBy, inputRef }) => {
    const generatedId = useId();
    const id = providedId || generatedId;
    const errorId = `${id}-error`;
    const helperId = `${id}-helper`;
    const countId = `${id}-count`;
    const describedBy = [error && errorId, helperText && helperId, showCharCount && maxLength && countId, ariaDescribedBy].filter(Boolean).join(' ') || undefined;

    return (
      <div className="field-wrapper">
        <label htmlFor={id} className="field-label">
          {label}
          {required && <span className="field-required" aria-hidden="true">*</span>}
        </label>
        <input
          ref={inputRef}
          id={id}
          type={type}
          className={`field-input ${error ? 'field-input--error' : ''} ${disabled ? 'field-input--disabled' : ''}`}
          value={value}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
          onBlur={(e: FocusEvent<HTMLInputElement>) => e.target.dispatchEvent(new Event('blur', { bubbles: true }))}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          maxLength={maxLength}
          autoComplete={autoComplete}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={describedBy}
          aria-required={required}
        />
        {error && <p id={errorId} className="field-error" role="alert">{error}</p>}
        {helperText && !error && <p id={helperId} className="field-helper">{helperText}</p>}
        {showCharCount && maxLength && (
          <p id={countId} className="field-char-count" aria-live="polite">
            {value.length} / {maxLength}
          </p>
        )}
      </div>
    );
  }
);

TextInput.displayName = 'TextInput';

interface TextareaProps extends BaseFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  maxLength?: number;
  showCharCount?: boolean;
  textareaRef?: RefObject<HTMLTextAreaElement>;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ id: providedId, label, helperText, error, disabled, required, placeholder, value, onChange, rows = 4, maxLength, showCharCount, 'aria-describedby': ariaDescribedBy, textareaRef }) => {
    const generatedId = useId();
    const id = providedId || generatedId;
    const errorId = `${id}-error`;
    const helperId = `${id}-helper`;
    const countId = `${id}-count`;
    const describedBy = [error && errorId, helperText && helperId, showCharCount && maxLength && countId, ariaDescribedBy].filter(Boolean).join(' ') || undefined;

    return (
      <div className="field-wrapper">
        <label htmlFor={id} className="field-label">
          {label}
          {required && <span className="field-required" aria-hidden="true">*</span>}
        </label>
        <textarea
          ref={textareaRef}
          id={id}
          className={`field-textarea ${error ? 'field-textarea--error' : ''} ${disabled ? 'field-textarea--disabled' : ''}`}
          value={value}
          onChange={(e: ChangeEvent<HTMLTextAreaElement>) => onChange(e.target.value)}
          onBlur={(e: FocusEvent<HTMLTextAreaElement>) => e.target.dispatchEvent(new Event('blur', { bubbles: true }))}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          rows={rows}
          maxLength={maxLength}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={describedBy}
          aria-required={required}
        />
        {error && <p id={errorId} className="field-error" role="alert">{error}</p>}
        {helperText && !error && <p id={helperId} className="field-helper">{helperText}</p>}
        {showCharCount && maxLength && (
          <p id={countId} className="field-char-count" aria-live="polite">
            {value.length} / {maxLength}
          </p>
        )}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';

interface TagInputProps extends BaseFieldProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  maxTags?: number;
  maxTagLength?: number;
  inputRef?: RefObject<HTMLInputElement>;
}

export const TagInput = forwardRef<HTMLDivElement, TagInputProps>(
  ({ id: providedId, label, helperText, error, disabled, required, tags, onChange, placeholder = 'Add a tag and press Enter', maxTags, maxTagLength = 50, 'aria-describedby': ariaDescribedBy, inputRef }, ref) => {
    const generatedId = useId();
    const id = providedId || generatedId;
    const inputId = `${id}-input`;
    const errorId = `${id}-error`;
    const helperId = `${id}-helper`;
    const listId = `${id}-list`;
    const describedBy = [error && errorId, helperText && helperId, ariaDescribedBy].filter(Boolean).join(' ') || undefined;

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
      if (disabled) return;
      const value = e.currentTarget.value.trim();
      if (e.key === 'Enter' && value) {
        e.preventDefault();
        const newTag = maxTagLength ? value.slice(0, maxTagLength) : value;
        if (!tags.includes(newTag) && (!maxTags || tags.length < maxTags)) {
          onChange([...tags, newTag]);
        }
        e.currentTarget.value = '';
      } else if (e.key === 'Backspace' && !value && tags.length > 0) {
        e.preventDefault();
        onChange(tags.slice(0, -1));
      }
    };

    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
      if (!disabled) {
        e.currentTarget.value = e.target.value;
      }
    };

    const removeTag = (index: number) => {
      if (!disabled) {
        onChange(tags.filter((_, i) => i !== index));
      }
    };

    return (
      <div className="field-wrapper" ref={ref}>
        <label htmlFor={inputId} className="field-label">
          {label}
          {required && <span className="field-required" aria-hidden="true">*</span>}
        </label>
        <div className={`tag-input-wrapper ${error ? 'tag-input-wrapper--error' : ''} ${disabled ? 'tag-input-wrapper--disabled' : ''}`} role="listbox" aria-label={label} aria-multiselectable="true" id={listId} aria-describedby={describedBy}>
          <ul className="tag-list" role="presentation">
            {tags.map((tag, index) => (
              <li key={tag} className="tag-item" role="option" aria-selected="true">
                <span className="tag-text">{tag}</span>
                <button
                  type="button"
                  className="tag-remove"
                  onClick={() => removeTag(index)}
                  disabled={disabled}
                  aria-label={`Remove tag: ${tag}`}
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                    <path d="M1 1L13 13M13 1L1 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
          <input
            ref={inputRef}
            id={inputId}
            type="text"
            className="tag-input"
            placeholder={tags.length > 0 && !placeholder ? '' : placeholder}
            onKeyDown={handleKeyDown}
            onChange={handleChange}
            disabled={disabled}
            maxLength={maxTagLength}
            aria-activedescendant={tags.length > 0 ? `${listId}-option-0` : undefined}
            aria-autocomplete="list"
            aria-controls={listId}
          />
        </div>
        {error && <p id={errorId} className="field-error" role="alert">{error}</p>}
        {helperText && !error && <p id={helperId} className="field-helper">{helperText}</p>}
        {(maxTags || maxTagLength) && (
          <p className="field-helper" aria-live="polite">
            {maxTags && `Maximum ${maxTags} tags`}{maxTags && maxTagLength ? ' · ' : ''}{maxTagLength && `Each tag up to ${maxTagLength} characters`}
          </p>
        )}
      </div>
    );
  }
);

TagInput.displayName = 'TagInput';

interface SelectOption {
  value: string;
  label: string;
  description?: string;
}

interface SelectProps extends BaseFieldProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  selectRef?: RefObject<HTMLSelectElement>;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ id: providedId, label, helperText, error, disabled, required, value, onChange, options, placeholder, 'aria-describedby': ariaDescribedBy, selectRef }) => {
    const generatedId = useId();
    const id = providedId || generatedId;
    const errorId = `${id}-error`;
    const helperId = `${id}-helper`;
    const describedBy = [error && errorId, helperText && helperId, ariaDescribedBy].filter(Boolean).join(' ') || undefined;

    return (
      <div className="field-wrapper">
        <label htmlFor={id} className="field-label">
          {label}
          {required && <span className="field-required" aria-hidden="true">*</span>}
        </label>
        <select
          ref={selectRef}
          id={id}
          className={`field-select ${error ? 'field-select--error' : ''} ${disabled ? 'field-select--disabled' : ''}`}
          value={value}
          onChange={(e: ChangeEvent<HTMLSelectElement>) => onChange(e.target.value)}
          disabled={disabled}
          required={required}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={describedBy}
          aria-required={required}
        >
          {placeholder && <option value="" disabled>{placeholder}</option>}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {error && <p id={errorId} className="field-error" role="alert">{error}</p>}
        {helperText && !error && <p id={helperId} className="field-helper">{helperText}</p>}
      </div>
    );
  }
);

Select.displayName = 'Select';

export interface RadioOption {
  value: string;
  label: string;
  description?: string;
}

interface RadioGroupProps<T extends string = string> extends BaseFieldProps {
  value: T;
  onChange: (value: T) => void;
  options: RadioOption[];
  orientation?: 'horizontal' | 'vertical';
}

export const RadioGroup = <T extends string = string>({ id: providedId, label, helperText, error, disabled, required, value, onChange, options, orientation = 'vertical', 'aria-describedby': ariaDescribedBy }: RadioGroupProps<T>) => {
  const generatedId = useId();
  const groupId = providedId || generatedId;
  const errorId = `${groupId}-error`;
  const helperId = `${groupId}-helper`;
  const describedBy = [error && errorId, helperText && helperId, ariaDescribedBy].filter(Boolean).join(' ') || undefined;

  return (
    <fieldset className={`radio-group radio-group--${orientation} ${disabled ? 'radio-group--disabled' : ''}`} aria-describedby={describedBy} disabled={disabled}>
      <legend className="radio-group-label">
        {label}
        {required && <span className="field-required" aria-hidden="true">*</span>}
      </legend>
      <div className="radio-options" role="radiogroup" aria-label={label} aria-required={required} aria-invalid={error ? 'true' : 'false'} aria-describedby={describedBy}>
        {options.map((option) => (
          <label key={option.value} className="radio-option">
            <input
              type="radio"
              id={`${groupId}-${option.value}`}
              name={groupId}
              value={option.value}
              checked={value === option.value}
              onChange={() => !disabled && onChange(option.value as T)}
              disabled={disabled}
              className="radio-input"
              aria-describedby={option.description ? `${groupId}-${option.value}-desc` : undefined}
            />
            <span className="radio-custom" aria-hidden="true" />
            <span className="radio-option-label">{option.label}</span>
            {option.description && (
              <p id={`${groupId}-${option.value}-desc`} className="radio-option-description">{option.description}</p>
            )}
          </label>
        ))}
      </div>
      {error && <p id={errorId} className="field-error" role="alert">{error}</p>}
      {helperText && !error && <p id={helperId} className="field-helper">{helperText}</p>}
    </fieldset>
  );
};