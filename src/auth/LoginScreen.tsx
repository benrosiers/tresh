import { type FormEvent, useState } from 'react';
import { useAuth } from './AuthProvider';
import { PasswordInput } from './PasswordInput';
import './auth.css';

export function LoginScreen() {
  const { signInWithPassword, sendMagicLink, requestPasswordReset } = useAuth();
  const [method, setMethod] = useState<'magic-link' | 'password'>('magic-link');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    setError(null);

    const authError = method === 'magic-link'
      ? await sendMagicLink(email)
      : await signInWithPassword(email, password);

    if (authError) {
      setError(authError);
    } else if (method === 'magic-link') {
      setMessage('Lien envoyé. Ouvre ton courriel pour entrer dans Tresh.');
    }
    setBusy(false);
  };

  const forgotPassword = async () => {
    setMessage(null);
    setError(null);
    if (!email.trim()) {
      setError('Entre d’abord ton adresse courriel.');
      return;
    }
    setBusy(true);
    const resetError = await requestPasswordReset(email);
    setBusy(false);
    if (resetError) setError(resetError);
    else setMessage('Courriel de réinitialisation envoyé.');
  };

  return (
    <main className="auth-screen">
      <section className="auth-card" aria-labelledby="auth-title">
        <div className="auth-brand"><span aria-hidden="true" /> TRESH</div>
        <p className="auth-kicker">Atelier Expression</p>
        <h1 id="auth-title">Modifier le site</h1>
        <p className="auth-intro">Connecte-toi pour retrouver les brouillons enregistrés dans Tresh.</p>

        <div className="auth-methods" role="tablist" aria-label="Méthode de connexion">
          <button
            type="button"
            className={method === 'magic-link' ? 'is-active' : ''}
            onClick={() => setMethod('magic-link')}
          >
            Lien par courriel
          </button>
          <button
            type="button"
            className={method === 'password' ? 'is-active' : ''}
            onClick={() => setMethod('password')}
          >
            Mot de passe
          </button>
        </div>

        <form name="tresh-login" method="post" action="/" onSubmit={submit}>
          <label htmlFor="tresh-login-email">
            Courriel
            <input
              id="tresh-login-email"
              name="username"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.currentTarget.value)}
              autoComplete="username"
              inputMode="email"
              required
            />
          </label>
          {method === 'password' && (
            <div className="password-field">
              <label htmlFor="tresh-login-password">Mot de passe</label>
              <PasswordInput
                id="tresh-login-password"
                name="password"
                value={password}
                onChange={(event) => setPassword(event.currentTarget.value)}
                autoComplete="current-password"
                minLength={8}
                required
              />
            </div>
          )}
          {method === 'password' && (
            <button type="button" className="auth-link" disabled={busy} onClick={() => void forgotPassword()}>
              Mot de passe oublié?
            </button>
          )}
          {error && <p className="auth-message auth-message--error" role="alert">{error}</p>}
          {message && <p className="auth-message auth-message--success" role="status">{message}</p>}
          <button type="submit" className="auth-submit" disabled={busy}>
            {busy ? 'Connexion…' : method === 'magic-link' ? 'Recevoir mon lien' : 'Se connecter'}
          </button>
        </form>
      </section>
    </main>
  );
}
