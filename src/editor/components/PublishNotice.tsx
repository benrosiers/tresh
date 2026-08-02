import { useEffect, useState } from 'react';
import { useAuth } from '../../auth';
import { useSiteWorkspace } from '../../sites';
import {
  publishSiteRelease,
  type PublishedRelease,
} from '../../releases';
import { useEditor } from '../state/editorStore';

type PublishPhase =
  | 'idle'
  | 'saving'
  | 'publishing';

type PublishStep =
  | 'warning'
  | 'confirm';

export function PublishNotice() {
  const {
    state,
    dispatch,
    saveNow,
  } = useEditor();

  const { mode } = useAuth();
  const { activeSite } = useSiteWorkspace();
  const publicationConfigured =
    activeSite?.slug === 'atelier-expression';

  const [phase, setPhase] =
    useState<PublishPhase>('idle');

  const [step, setStep] =
    useState<PublishStep>('warning');

  const [error, setError] =
    useState<string | null>(null);

  const [release, setRelease] =
    useState<PublishedRelease | null>(null);

  const busy = phase !== 'idle';

  useEffect(() => {
    if (!state.publishNoticeOpen) {
      setPhase('idle');
      setStep('warning');
      setError(null);
      setRelease(null);
    }
  }, [state.publishNoticeOpen]);

  if (!state.publishNoticeOpen) {
    return null;
  }

  const cloudReady =
    mode === 'signed-in' &&
    publicationConfigured &&
    Boolean(state.cloud.pageId);

  const draftSaved =
    cloudReady &&
    state.cloud.status === 'saved' &&
    !state.dirty;

  const hasConflict =
    state.cloud.status === 'conflict';

  const cloudLoading =
    state.cloud.status === 'loading';

  const canContinue =
    cloudReady &&
    !cloudLoading &&
    !hasConflict &&
    !busy &&
    !release;

  const publish = async () => {
    if (!canContinue) return;

    setPhase('saving');
    setError(null);

    try {
      const lockVersion = await saveNow();

      if (lockVersion === null) {
        throw new Error(
          'Le brouillon doit être synchronisé dans Tresh avant la publication.',
        );
      }

      setPhase('publishing');

      if (!activeSite) {
        throw new Error('Aucun site actif.');
      }

      const result = await publishSiteRelease(
        activeSite.slug,
        lockVersion,
      );

      setRelease(result);
    } catch (publishError: unknown) {
      setError(
        publishError instanceof Error
          ? publishError.message
          : 'La publication a échoué.',
      );
    } finally {
      setPhase('idle');
    }
  };

  const close = () => {
    if (busy) return;

    dispatch({
      type: 'publish-notice/close',
    });
  };

  const publishButtonLabel =
    phase === 'saving'
      ? 'Sauvegarde…'
      : phase === 'publishing'
        ? 'Publication…'
        : 'Confirmer la publication';

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onPointerDown={(event) => {
        if (
          event.currentTarget === event.target &&
          !busy
        ) {
          close();
        }
      }}
    >
      <section
        className="publish-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="publish-title"
      >
        <div
          className="publish-modal__icon"
          aria-hidden="true"
        >
          ↗
        </div>

        {release ? (
          <>
            <h2 id="publish-title">
              Publication lancée
            </h2>

            <p>
              La version {release.revisionNumber} est
              immuable et le déploiement GitHub a été
              demandé.
            </p>

            <p>
              Le site public sera remplacé uniquement si
              la validation et le build réussissent.
            </p>

            <div
              className="publish-success"
              role="status"
            >
              <strong>Release</strong>

              <code>{release.releaseId}</code>

              <span>
                Statut :{' '}
                {release.status === 'dispatched'
                  ? 'envoyée à GitHub'
                  : 'créée'}
              </span>
            </div>
          </>
        ) : step === 'warning' ? (
          <>
            <h2 id="publish-title">
              Avant de publier
            </h2>

            <p>
              Tresh va créer une version immuable du
              brouillon actuel et demander à GitHub
              Actions de remplacer le site public.
            </p>

            <div className="publish-readiness">
              <div className="is-ready">
                <span>✓</span>
                Sauvegarde automatique avant publication
              </div>

              <div
                className={
                  cloudReady ? 'is-ready' : ''
                }
              >
                <span>
                  {cloudReady ? '✓' : '○'}
                </span>
                Compte et brouillon Supabase
              </div>

              <div
                className={
                  draftSaved || state.dirty
                    ? 'is-ready'
                    : ''
                }
              >
                <span>
                  {draftSaved || state.dirty
                    ? '✓'
                    : '○'}
                </span>
                Brouillon prêt à être figé
              </div>

              <div className="is-ready">
                <span>✓</span>
                Release immuable
              </div>

              <div className="is-ready">
                <span>✓</span>
                Déploiement GitHub Actions
              </div>
            </div>

            <p className="publish-warning">
              La prochaine étape demandera une dernière
              confirmation avant de toucher au site public.
            </p>

            {!publicationConfigured && (
              <p className="publish-warning">
                Ce site n’a pas encore de cible de
                publication publique. Son brouillon reste
                sauvegardé dans Tresh.
              </p>
            )}

            {!cloudReady && publicationConfigured && (
              <p className="publish-warning">
                Connecte-toi à Tresh et attends que le
                brouillon Supabase soit chargé.
              </p>
            )}

            {cloudLoading && (
              <p className="publish-warning">
                Le brouillon Tresh est encore en cours de
                chargement.
              </p>
            )}

            {hasConflict && (
              <p className="publish-warning">
                Un conflit de brouillon doit être résolu
                avant la publication.
              </p>
            )}
          </>
        ) : (
          <>
            <h2 id="publish-title">
              Confirmer la publication
            </h2>

            <p className="publish-warning" role="alert">
              Tu es sur le point de demander le
              remplacement du site public
              atelierexpression.ca.
            </p>

            <p>
              Les changements actuels seront d’abord
              sauvegardés, puis figés dans une release
              immuable.
            </p>

            <p>
              Cette action déclenchera réellement le
              workflow GitHub Actions de production.
            </p>

            <div className="publish-readiness">
              <div className="is-ready">
                <span>✓</span>
                Dernière sauvegarde forcée
              </div>

              <div className="is-ready">
                <span>✓</span>
                Version exacte verrouillée
              </div>

              <div className="is-ready">
                <span>✓</span>
                Déploiement du site public
              </div>
            </div>
          </>
        )}

        {error && !release && (
          <p
            className="auth-message auth-message--error"
            role="alert"
          >
            {error}
          </p>
        )}

        <div className="publish-modal__actions">
          {release ? (
            <button
              type="button"
              className="editor-button editor-button--ghost"
              onClick={close}
            >
              Fermer
            </button>
          ) : step === 'warning' ? (
            <>
              <button
                type="button"
                className="editor-button editor-button--ghost"
                disabled={busy}
                onClick={close}
              >
                Annuler
              </button>

              <button
                type="button"
                className="editor-button editor-button--publish"
                disabled={!canContinue}
                onClick={() => {
                  setError(null);
                  setStep('confirm');
                }}
              >
                Continuer
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="editor-button editor-button--ghost"
                disabled={busy}
                onClick={() => {
                  setError(null);
                  setStep('warning');
                }}
              >
                Retour
              </button>

              <button
                type="button"
                className="editor-button editor-button--publish"
                disabled={!canContinue}
                onClick={() => {
                  void publish();
                }}
              >
                {publishButtonLabel}
              </button>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
