import {
  type FormEvent,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useAuth } from '../../auth';
import {
  cloneSiteDocumentForNewSite,
  createBlankSiteDocument,
  normalizeSiteSlug,
  useSiteWorkspace,
} from '../../sites';
import { useEditor } from '../state/editorStore';
import './siteManager.css';

interface SiteManagerModalProps {
  open: boolean;
  onClose: () => void;
}

type SiteTemplate = 'blank' | 'duplicate';

export function SiteManagerModal({
  open,
  onClose,
}: SiteManagerModalProps) {
  const { mode } = useAuth();
  const {
    status,
    sites,
    activeSite,
    message,
    selectSite,
    createSite,
    refreshSites,
  } = useSiteWorkspace();
  const { state, saveNow } = useEditor();

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [template, setTemplate] =
    useState<SiteTemplate>('blank');
  const [busy, setBusy] = useState(false);
  const [localMessage, setLocalMessage] =
    useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setName('');
      setSlug('');
      setSlugTouched(false);
      setTemplate('blank');
      setLocalMessage(null);
      setBusy(false);
    }
  }, [open]);

  useEffect(() => {
    if (!slugTouched) {
      setSlug(normalizeSiteSlug(name));
    }
  }, [name, slugTouched]);

  const createDisabled = useMemo(
    () =>
      busy ||
      mode !== 'signed-in' ||
      name.trim().length < 2 ||
      normalizeSiteSlug(slug).length === 0,
    [busy, mode, name, slug],
  );

  if (!open) return null;

  const switchSite = async (siteId: string) => {
    if (siteId === activeSite?.id || busy) return;

    setBusy(true);
    setLocalMessage(null);

    try {
      if (state.dirty) {
        await saveNow();
      }

      selectSite(siteId);
      onClose();
    } catch (error: unknown) {
      setLocalMessage(
        error instanceof Error
          ? error.message
          : 'Impossible de changer de site.',
      );
    } finally {
      setBusy(false);
    }
  };

  const submit = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    if (createDisabled) return;

    setBusy(true);
    setLocalMessage(null);

    try {
      if (state.dirty && activeSite) {
        await saveNow();
      }

      const normalizedName = name.trim();
      const document =
        template === 'duplicate'
          ? cloneSiteDocumentForNewSite(
              state.document,
              normalizedName,
            )
          : createBlankSiteDocument(normalizedName);

      await createSite({
        name: normalizedName,
        slug: normalizeSiteSlug(slug),
        document,
      });

      onClose();
    } catch (error: unknown) {
      setLocalMessage(
        error instanceof Error
          ? error.message
          : 'Impossible de créer ce site.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onPointerDown={(event) => {
        if (
          event.currentTarget === event.target &&
          !busy
        ) {
          onClose();
        }
      }}
    >
      <section
        className="site-manager-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="site-manager-title"
      >
        <div className="site-manager-modal__header">
          <div>
            <p className="site-manager-modal__eyebrow">
              Compte Tresh
            </p>
            <h2 id="site-manager-title">Mes sites</h2>
            <p>
              Chaque site possède son propre brouillon,
              ses pages et son historique.
            </p>
          </div>

          <button
            type="button"
            className="site-manager-modal__close"
            aria-label="Fermer"
            disabled={busy}
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <div className="site-manager-layout">
          <section className="site-manager-list">
            <div className="site-manager-section-heading">
              <strong>{sites.length} site{sites.length === 1 ? '' : 's'}</strong>
              <button
                type="button"
                disabled={busy || status === 'loading'}
                onClick={() => {
                  void refreshSites();
                }}
              >
                Actualiser
              </button>
            </div>

            {status === 'loading' ? (
              <p className="site-manager-empty">
                Chargement des sites…
              </p>
            ) : sites.length === 0 ? (
              <p className="site-manager-empty">
                Aucun site n’est encore associé à ce compte.
              </p>
            ) : (
              <div className="site-manager-cards">
                {sites.map((site) => {
                  const current = site.id === activeSite?.id;

                  return (
                    <article
                      className={`site-manager-card ${
                        current ? 'is-current' : ''
                      }`}
                      key={site.id}
                    >
                      <div>
                        <span className="site-manager-card__status">
                          {current ? 'Ouvert' : 'Disponible'}
                        </span>
                        <h3>{site.name}</h3>
                        <code>{site.slug}</code>
                        <p>
                          {site.publicUrl
                            ? site.publicUrl
                            : 'Aucune cible de publication configurée'}
                        </p>
                      </div>

                      <button
                        type="button"
                        disabled={busy || current}
                        onClick={() => {
                          void switchSite(site.id);
                        }}
                      >
                        {current ? 'Site actuel' : 'Ouvrir'}
                      </button>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <form
            className="site-create-panel"
            onSubmit={submit}
          >
            <div>
              <p className="site-manager-modal__eyebrow">
                Nouveau projet
              </p>
              <h3>Créer un site</h3>
            </div>

            {mode !== 'signed-in' && (
              <p className="site-manager-warning">
                Connecte-toi pour associer un nouveau site
                à ton compte et le synchroniser.
              </p>
            )}

            <label>
              <span>Nom du site</span>
              <input
                value={name}
                maxLength={120}
                placeholder="Mon nouveau site"
                disabled={busy || mode !== 'signed-in'}
                onChange={(event) =>
                  setName(event.currentTarget.value)
                }
              />
            </label>

            <label>
              <span>Adresse interne</span>
              <input
                value={slug}
                maxLength={63}
                placeholder="mon-nouveau-site"
                disabled={busy || mode !== 'signed-in'}
                spellCheck={false}
                onChange={(event) => {
                  setSlugTouched(true);
                  setSlug(
                    normalizeSiteSlug(
                      event.currentTarget.value,
                    ),
                  );
                }}
              />
              <small>
                Sert à distinguer ce projet dans Tresh.
                Le domaine public sera configuré plus tard.
              </small>
            </label>

            <fieldset>
              <legend>Point de départ</legend>

              <label className="site-template-choice">
                <input
                  type="radio"
                  name="site-template"
                  value="blank"
                  checked={template === 'blank'}
                  disabled={busy || mode !== 'signed-in'}
                  onChange={() => setTemplate('blank')}
                />
                <span>
                  <strong>Site vierge</strong>
                  <small>
                    Une page d’accueil propre et minimale.
                  </small>
                </span>
              </label>

              <label className="site-template-choice">
                <input
                  type="radio"
                  name="site-template"
                  value="duplicate"
                  checked={template === 'duplicate'}
                  disabled={
                    busy ||
                    mode !== 'signed-in' ||
                    !activeSite
                  }
                  onChange={() => setTemplate('duplicate')}
                />
                <span>
                  <strong>Dupliquer le site actuel</strong>
                  <small>
                    Copie toutes les pages et le design,
                    sans toucher à l’original.
                  </small>
                </span>
              </label>
            </fieldset>

            {(localMessage || message) && (
              <p
                className="site-manager-error"
                role="alert"
              >
                {localMessage ?? message}
              </p>
            )}

            <button
              type="submit"
              className="editor-button editor-button--publish editor-button--full"
              disabled={createDisabled}
            >
              {busy ? 'Création…' : 'Créer et ouvrir'}
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
