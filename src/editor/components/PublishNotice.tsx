import { useEffect, useState } from 'react';
import { useAuth } from '../../auth';
import { publishSiteRelease, type PublishedRelease } from '../../releases';
import { useEditor } from '../state/editorStore';

export function PublishNotice() {
  const { state, dispatch } = useEditor();
  const { mode } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [release, setRelease] = useState<PublishedRelease | null>(null);

  useEffect(() => {
    if (!state.publishNoticeOpen) {
      setBusy(false);
      setError(null);
      setRelease(null);
    }
  }, [state.publishNoticeOpen]);

  if (!state.publishNoticeOpen) return null;

  const cloudReady = mode === 'signed-in' && Boolean(state.cloud.pageId);
  const draftSaved = cloudReady && state.cloud.status === 'saved' && !state.dirty;
  const canPublish = draftSaved && !busy && !release;

  const publish = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await publishSiteRelease(state.cloud.lockVersion);
      setRelease(result);
    } catch (publishError) {
      setError(publishError instanceof Error ? publishError.message : 'La publication a échoué.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onPointerDown={(event) => {
        if (event.currentTarget === event.target && !busy) dispatch({ type: 'publish-notice/close' });
      }}
    >
      <section className="publish-modal" role="dialog" aria-modal="true" aria-labelledby="publish-title">
        <div className="publish-modal__icon" aria-hidden="true">↗</div>
        <h2 id="publish-title">{release ? 'Publication lancée' : 'Publier Atelier Expression'}</h2>

        {release ? (
          <>
            <p>
              La version {release.revisionNumber} est immuable et le déploiement GitHub a été demandé.
              Le site public sera remplacé seulement si la validation et le build réussissent.
            </p>
            <div className="publish-success" role="status">
              <strong>Release</strong>
              <code>{release.releaseId}</code>
              <span>Statut : {release.status === 'dispatched' ? 'envoyée à GitHub' : 'créée'}</span>
            </div>
          </>
        ) : (
          <>
            <p>
              Tresh va figer le brouillon actuel dans une release immuable, puis demander à GitHub Actions
              de valider, construire et déployer atelierexpression.ca.
            </p>
            <div className="publish-readiness">
              <div className="is-ready"><span>✓</span> Éditeur React fonctionnel</div>
              <div className="is-ready"><span>✓</span> Profil et mot de passe gérés dans Tresh</div>
              <div className={cloudReady ? 'is-ready' : ''}>
                <span>{cloudReady ? '✓' : '○'}</span> Compte et brouillon Supabase
              </div>
              <div className={draftSaved ? 'is-ready' : ''}>
                <span>{draftSaved ? '✓' : '○'}</span> Brouillon entièrement synchronisé
              </div>
              <div className="is-ready"><span>✓</span> Release immuable et fonction de publication</div>
            </div>
            {!draftSaved && (
              <p className="publish-warning">
                Attends que l’indicateur affiche « Sauvegardé dans Tresh » avant de publier.
              </p>
            )}
            {error && <p className="auth-message auth-message--error" role="alert">{error}</p>}
          </>
        )}

        <div className="publish-modal__actions">
          <button
            type="button"
            className="editor-button editor-button--ghost"
            disabled={busy}
            onClick={() => dispatch({ type: 'publish-notice/close' })}
          >
            {release ? 'Fermer' : 'Annuler'}
          </button>
          {!release && (
            <button
              type="button"
              className="editor-button editor-button--publish"
              disabled={!canPublish}
              onClick={() => void publish()}
            >
              {busy ? 'Publication…' : 'Publier maintenant'}
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
