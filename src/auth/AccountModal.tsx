import { type ChangeEvent, type FormEvent, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthProvider';

interface AccountModalProps {
  open: boolean;
  onClose: () => void;
}

type AccountTab = 'profile' | 'password';

function initials(value: string): string {
  const words = value.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 'T';
  return words.slice(0, 2).map((word) => word[0]?.toUpperCase() ?? '').join('');
}

export function AccountModal({ open, onClose }: AccountModalProps) {
  const {
    user,
    profile,
    passwordRecovery,
    updateDisplayName,
    uploadAvatar,
    changePassword,
    dismissPasswordRecovery,
    signOut,
  } = useAuth();
  const [tab, setTab] = useState<AccountTab>('profile');
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDisplayName(profile.displayName);
  }, [profile.displayName]);

  useEffect(() => {
    if (passwordRecovery) setTab('password');
  }, [passwordRecovery]);

  useEffect(() => {
    if (!avatarFile) {
      setAvatarPreview(null);
      return;
    }
    const url = URL.createObjectURL(avatarFile);
    setAvatarPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [avatarFile]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !passwordRecovery) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, open, passwordRecovery]);

  const visibleAvatar = avatarPreview ?? profile.avatarUrl;
  const avatarLabel = useMemo(() => initials(displayName || profile.displayName), [displayName, profile.displayName]);

  if (!open) return null;

  const clearFeedback = () => {
    setMessage(null);
    setError(null);
  };

  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    clearFeedback();
    setBusy(true);

    const nameError = await updateDisplayName(displayName);
    if (nameError) {
      setError(nameError);
      setBusy(false);
      return;
    }

    if (avatarFile) {
      const avatarError = await uploadAvatar(avatarFile);
      if (avatarError) {
        setError(avatarError);
        setBusy(false);
        return;
      }
      setAvatarFile(null);
    }

    setMessage('Profil enregistré.');
    setBusy(false);
  };

  const chooseAvatar = (event: ChangeEvent<HTMLInputElement>) => {
    clearFeedback();
    setAvatarFile(event.currentTarget.files?.[0] ?? null);
  };

  const savePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    clearFeedback();

    if (newPassword !== confirmPassword) {
      setError('Les deux nouveaux mots de passe ne sont pas identiques.');
      return;
    }

    setBusy(true);
    const passwordError = await changePassword(currentPassword, newPassword);
    setBusy(false);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setMessage('Mot de passe changé. Chrome ou Windows peut maintenant proposer de le mettre à jour.');
    window.history.replaceState(window.history.state, '', window.location.pathname);
  };

  const close = () => {
    if (passwordRecovery) dismissPasswordRecovery();
    clearFeedback();
    onClose();
  };

  return (
    <div
      className="modal-backdrop account-backdrop"
      role="presentation"
      onPointerDown={(event) => {
        if (event.currentTarget === event.target && !passwordRecovery) close();
      }}
    >
      <section className="account-modal" role="dialog" aria-modal="true" aria-labelledby="account-title">
        <header className="account-modal__header">
          <div>
            <p className="account-modal__kicker">Compte Tresh</p>
            <h2 id="account-title">Mon profil</h2>
          </div>
          <button type="button" className="account-modal__close" aria-label="Fermer" onClick={close}>×</button>
        </header>

        <div className="account-tabs" role="tablist" aria-label="Paramètres du compte">
          <button type="button" className={tab === 'profile' ? 'is-active' : ''} onClick={() => { setTab('profile'); clearFeedback(); }}>
            Profil
          </button>
          <button type="button" className={tab === 'password' ? 'is-active' : ''} onClick={() => { setTab('password'); clearFeedback(); }}>
            Mot de passe
          </button>
        </div>

        {tab === 'profile' ? (
          <form className="account-form" onSubmit={saveProfile}>
            <div className="account-avatar-row">
              <div className="account-avatar account-avatar--large" aria-hidden="true">
                {visibleAvatar ? <img src={visibleAvatar} alt="" /> : <span>{avatarLabel}</span>}
              </div>
              <label className="account-file-button" htmlFor="tresh-avatar">
                Choisir une photo
                <input
                  id="tresh-avatar"
                  name="avatar"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={chooseAvatar}
                />
              </label>
            </div>

            <label htmlFor="tresh-display-name">
              Nom affiché
              <input
                id="tresh-display-name"
                name="name"
                type="text"
                value={displayName}
                onChange={(event) => setDisplayName(event.currentTarget.value)}
                autoComplete="name"
                minLength={2}
                maxLength={80}
                required
              />
            </label>

            <label htmlFor="tresh-account-email">
              Courriel
              <input id="tresh-account-email" type="email" value={user?.email ?? ''} readOnly autoComplete="username" />
            </label>

            {error && <p className="auth-message auth-message--error" role="alert">{error}</p>}
            {message && <p className="auth-message auth-message--success" role="status">{message}</p>}

            <button type="submit" className="editor-button editor-button--publish editor-button--full" disabled={busy}>
              {busy ? 'Enregistrement…' : 'Enregistrer le profil'}
            </button>
          </form>
        ) : (
          <form
            className="account-form"
            name="tresh-change-password"
            action="/account/password"
            method="post"
            onSubmit={savePassword}
          >
            <input
              className="visually-hidden"
              name="username"
              type="email"
              value={user?.email ?? ''}
              readOnly
              autoComplete="username"
              tabIndex={-1}
            />

            {passwordRecovery ? (
              <p className="account-recovery-note">Choisis maintenant ton nouveau mot de passe.</p>
            ) : (
              <label htmlFor="tresh-current-password">
                Mot de passe actuel
                <input
                  id="tresh-current-password"
                  name="current-password"
                  type="password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.currentTarget.value)}
                  autoComplete="current-password"
                  required
                />
              </label>
            )}

            <label htmlFor="tresh-new-password">
              Nouveau mot de passe
              <input
                id="tresh-new-password"
                name="new-password"
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.currentTarget.value)}
                autoComplete="new-password"
                minLength={12}
                aria-describedby="tresh-password-rules"
                required
              />
            </label>
            <p id="tresh-password-rules" className="account-help">Au moins 12 caractères. Chrome peut proposer un mot de passe fort.</p>

            <label htmlFor="tresh-confirm-password">
              Confirmer le nouveau mot de passe
              <input
                id="tresh-confirm-password"
                name="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.currentTarget.value)}
                autoComplete="new-password"
                minLength={12}
                required
              />
            </label>

            {error && <p className="auth-message auth-message--error" role="alert">{error}</p>}
            {message && <p className="auth-message auth-message--success" role="status">{message}</p>}

            <button type="submit" className="editor-button editor-button--publish editor-button--full" disabled={busy}>
              {busy ? 'Modification…' : 'Changer mon mot de passe'}
            </button>
          </form>
        )}

        <footer className="account-modal__footer">
          <button type="button" className="editor-button editor-button--danger" onClick={() => void signOut()}>
            Se déconnecter
          </button>
        </footer>
      </section>
    </div>
  );
}
