import { useEditor } from '../state/editorStore';
import type { Breakpoint } from '../model/siteDocument';

const breakpoints: Array<{ id: Breakpoint; label: string }> = [
  { id: 'desktop', label: 'Bureau' },
  { id: 'tablet', label: 'Tablette' },
  { id: 'mobile', label: 'Mobile' },
];

function SaveState() {
  const { state } = useEditor();
  const label = state.dirty
    ? 'Sauvegarde locale…'
    : state.savedAt
      ? 'Sauvegardé localement'
      : 'Brouillon local';

  return (
    <div className="save-state" title="Le brouillon est enregistré uniquement dans ce navigateur pour le moment.">
      <span className={`status-dot ${state.dirty ? 'is-dirty' : ''}`} aria-hidden="true" />
      {label}
    </div>
  );
}

export function Topbar() {
  const { state, dispatch } = useEditor();

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
