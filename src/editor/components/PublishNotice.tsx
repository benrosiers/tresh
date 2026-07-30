import { useAuth } from '../../auth';
import { useEditor } from '../state/editorStore';

export function PublishNotice() {
  const { state, dispatch } = useEditor();
  const { mode } = useAuth();
  if (!state.publishNoticeOpen) return null;

  const cloudReady = mode === 'signed-in' && Boolean(state.cloud.pageId);

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
          Le bouton ne simule rien. L’éditeur et la sauvegarde de brouillons sont prêts; la prochaine frontière
          est une release immuable déclenchant le workflow GitHub Actions d’Atelier Expression.
        </p>
        <div className="publish-readiness">
          <div className="is-ready"><span>✓</span> Éditeur React fonctionnel</div>
          <div className="is-ready"><span>✓</span> Suppression et historique des sections</div>
          <div className={cloudReady ? 'is-ready' : ''}>
            <span>{cloudReady ? '✓' : '○'}</span> Authentification et brouillon Supabase
          </div>
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
