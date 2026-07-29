import { useEditor } from '../state/editorStore';

export function PublishNotice() {
  const { state, dispatch } = useEditor();
  if (!state.publishNoticeOpen) return null;

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onPointerDown={(event) => {
        if (event.currentTarget === event.target) dispatch({ type: 'publish-notice/close' });
      }}
    >
      <section className="publish-modal" role="dialog" aria-modal="true" aria-labelledby="publish-title">
        <div className="publish-modal__icon" aria-hidden="true">↗</div>
        <h2 id="publish-title">Publication pas encore branchée</h2>
        <p>
          Le bouton ne simule rien. Le brouillon est sauvegardé localement, mais la publication nécessitera
          Supabase, une release immuable et le workflow GitHub Actions d’Atelier Expression.
        </p>
        <div className="publish-readiness">
          <div className="is-ready"><span>✓</span> Éditeur React fonctionnel</div>
          <div className="is-ready"><span>✓</span> Brouillon local réel</div>
          <div><span>○</span> Authentification Supabase</div>
          <div><span>○</span> Releases et publication GitHub</div>
        </div>
        <div className="publish-modal__actions">
          <button
            type="button"
            className="editor-button editor-button--publish"
            onClick={() => dispatch({ type: 'publish-notice/close' })}
          >
            Compris
          </button>
        </div>
      </section>
    </div>
  );
}
