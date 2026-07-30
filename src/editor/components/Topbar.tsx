import { useAuth } from '../../auth';
import { useEditor } from '../state/editorStore';
import type { Breakpoint } from '../model/siteDocument';

const breakpoints: Array<{ id: Breakpoint; label: string }> = [
  { id: 'desktop', label: 'Bureau' },
  { id: 'tablet', label: 'Tablette' },
  { id: 'mobile', label: 'Mobile' },
];

function SaveState() {
  const { state } = useEditor();
  const { mode } = useAuth();

  let label = 'Brouillon local';
  let tone = '';
  let title = 'Le brouillon est enregistré dans ce navigateur.';

  if (mode === 'signed-in') {
    if (state.cloud.status === 'loading') label = 'Chargement du brouillon…';
    if (state.cloud.status === 'saving' || state.dirty) label = 'Synchronisation…';
    if (state.cloud.status === 'saved' && !state.dirty) label = 'Sauvegardé dans Tresh';
    if (state.cloud.status === 'error') {
      label = 'Erreur de synchronisation';
      tone = 'is-error';
      title = state.cloud.message ?? label;
    }
    if (state.cloud.status === 'conflict') {
      label = 'Conflit de version';
      tone = 'is-error';
      title = state.cloud.message ?? label;
    }
  } else {
    label = state.dirty ? 'Sauvegarde locale…' : state.savedAt ? 'Sauvegardé localement' : 'Brouillon local';
  }

  return (
    <div className={`save-state ${tone}`} title={title}>
      <span className={`status-dot ${state.dirty ? 'is-dirty' : ''}`} aria-hidden="true" />
      {label}
    </div>
  );
}

export function Topbar() {
  const { state, dispatch } = useEditor();
  const { mode, user, signOut } = useAuth();

  return (
    <header className="topbar">
      <div className="topbar__left">
        <div className="editor-brand">
          <span className="editor-brand__dot" aria-hidden="true" />
          TRESH <strong>éditeur</strong>
        </div>
        <div className="breadcrumbs">
          Site : <em>Atelier Expression</em> / Accueil
        </div>
      </div>

      <div className="breakpoint-switch" aria-label="Format d’aperçu">
        {breakpoints.map(({ id, label }) => (
          <button
            type="button"
            className={state.breakpoint === id ? 'is-active' : ''}
            onClick={() => dispatch({ type: 'breakpoint/set', breakpoint: id })}
            key={id}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="topbar__right">
        <SaveState />
        {mode === 'signed-in' && (
          <button
            type="button"
            className="account-chip"
            title={`${user?.email ?? 'Compte Tresh'} — cliquer pour se déconnecter`}
            onClick={() => void signOut()}
          >
            {user?.email?.split('@')[0] ?? 'Compte'}
          </button>
        )}
        <button
          type="button"
          className="editor-button editor-button--ghost"
          disabled={state.past.length === 0}
          onClick={() => dispatch({ type: 'history/undo' })}
        >
          Annuler
        </button>
        <button
          type="button"
          className="editor-button editor-button--ghost"
          disabled={state.future.length === 0}
          onClick={() => dispatch({ type: 'history/redo' })}
        >
          Rétablir
        </button>
        <button
          type="button"
          className="editor-button editor-button--publish"
          onClick={() => dispatch({ type: 'publish-notice/open' })}
        >
          Publier
        </button>
      </div>
    </header>
  );
}
