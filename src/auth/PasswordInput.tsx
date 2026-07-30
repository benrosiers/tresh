import { type InputHTMLAttributes, useId, useState } from 'react';

type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>;

function EyeIcon({ crossed }: { crossed: boolean }) {
  return crossed ? (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 3l18 18" />
      <path d="M10.6 10.7a2 2 0 0 0 2.7 2.7" />
      <path d="M9.9 4.2A10.8 10.8 0 0 1 12 4c5.5 0 9 5.1 9 5.1a16 16 0 0 1-3 3.7" />
      <path d="M6.6 6.6C4.3 8 3 10 3 10s3.5 5 9 5a10.5 10.5 0 0 0 3.1-.5" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M2.5 12S6 6.5 12 6.5 21.5 12 21.5 12 18 17.5 12 17.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="2.75" />
    </svg>
  );
}

export function PasswordInput({ id, ...props }: PasswordInputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const [visible, setVisible] = useState(false);
  const actionLabel = visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe';

  return (
    <div className="password-input">
      <input id={inputId} {...props} type={visible ? 'text' : 'password'} />
      <button
        type="button"
        className="password-input__toggle"
        aria-label={actionLabel}
        aria-controls={inputId}
        aria-pressed={visible}
        title={actionLabel}
        onClick={() => setVisible((value) => !value)}
      >
        <EyeIcon crossed={visible} />
      </button>
    </div>
  );
}
